import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import {
  ArrowClockwise,
  ArrowRight,
  CheckCircle,
  Headphones,
  Play,
  Trophy,
} from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import { saveWordApi } from '../../services/videoService'
import { lookupWordApi } from '../../services/translationService'
import type { SavedWord, VideoLessonDetail, VideoSegment } from '../../types/video'
import { matchDictation, tokenizeDictation, type DictationToken } from '../../utils/dictation'
import { formatClock, youtubeEmbedUrl, youtubeThumbnailUrl, YOUTUBE_LOCKED_VARS } from '../../utils/videoPlayback'
import { loadYouTubeApi, type YouTubePlayerInstance } from '../../utils/youtube'

const SEGMENT_END_MARGIN_S = 0.12
const SEGMENT_START_DRIFT_S = 0.5

/**
 * `cc_load_policy=0` only means "don't force captions on" — YouTube can still
 * render auto captions from the viewer's own preference. Clear the track and
 * unload the renderer as soon as the module exists, then repeat on every
 * player event because the module is loaded lazily and can remount after a
 * seek. The picture stays fully visible: we only turn the captions off, we do
 * not hide the video (the learner explicitly wants to watch it).
 */
function stripCaptions(player: YouTubePlayerInstance) {
  try {
    player.setOption?.('captions', 'track', {})
  } catch {
    /* the captions module is not mounted yet — the next pass will catch it */
  }
  try {
    player.unloadModule?.('captions')
    player.unloadModule?.('cc')
  } catch {
    /* ignore a module that was never loaded */
  }
}

const CAPTION_GUARD_MS = 400

interface PracticePlayerProps {
  video: VideoLessonDetail
  segment: VideoSegment
  playToken: number
  onPlay: () => void
}

/**
 * Our own poster. The YouTube embed paints a title bar, a "Watch on YouTube"
 * badge and a related-video grid whenever it is idle, so the frame stays covered
 * until sound is actually coming out of it.
 */
function StageCover({
  poster,
  label,
  onPlay,
}: {
  poster: string | null
  label: string
  onPlay: () => void
}) {
  return (
    <button type="button" className="practice-cover" onClick={onPlay}>
      {poster && (
        <span
          className="practice-cover-poster"
          aria-hidden="true"
          style={{ backgroundImage: `url("${poster}")` }}
        />
      )}
      <span className="practice-cover-play">
        <Play size={22} weight="fill" />
      </span>
      <span className="practice-cover-label">{label}</span>
    </button>
  )
}

function YouTubePracticePlayer({ video, segment, playToken, onPlay }: PracticePlayerProps) {
  const { t } = useI18n()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YouTubePlayerInstance | null>(null)
  const tickerRef = useRef<number | null>(null)
  const captionGuardRef = useRef<number | null>(null)
  const hasStartedRef = useRef(false)
  const segmentRef = useRef<VideoSegment>(segment)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const embedUrl = youtubeEmbedUrl(video.video_url)
  const poster = video.thumbnail_url ?? youtubeThumbnailUrl(video.video_url)

  useEffect(() => {
    segmentRef.current = segment
  }, [segment])

  const stopTicker = useCallback(() => {
    if (tickerRef.current !== null) {
      window.clearInterval(tickerRef.current)
      tickerRef.current = null
    }
  }, [])

  /**
   * The captions module can remount at any time (seek, quality change, ad
   * break). While sound is playing we keep clearing it on a short timer, on
   * top of the one-shot passes triggered by player events.
   */
  const startCaptionGuard = useCallback((player: YouTubePlayerInstance) => {
    if (captionGuardRef.current !== null) return
    stripCaptions(player)
    captionGuardRef.current = window.setInterval(() => stripCaptions(player), CAPTION_GUARD_MS)
  }, [])

  const stopCaptionGuard = useCallback(() => {
    if (captionGuardRef.current !== null) {
      window.clearInterval(captionGuardRef.current)
      captionGuardRef.current = null
    }
  }, [])

  /**
   * Keeps the playhead inside the current segment: pauses on the last beat and
   * pulls it back if the player ever lands outside the script window.
   */
  const startTicker = useCallback(() => {
    if (tickerRef.current !== null) return
    tickerRef.current = window.setInterval(() => {
      const player = playerRef.current
      const current = segmentRef.current
      if (!player || !current) return
      const now = player.getCurrentTime()
      const start = current.start_ms / 1000
      const end = current.end_ms / 1000
      if (now >= end - SEGMENT_END_MARGIN_S) {
        player.pauseVideo()
        stopTicker()
        return
      }
      if (now < start - SEGMENT_START_DRIFT_S) player.seekTo(start, true)
    }, 200)
  }, [stopTicker])

  const playSegment = useCallback(() => {
    const player = playerRef.current
    const current = segmentRef.current
    if (!player || !current) return
    hasStartedRef.current = true
    player.seekTo(current.start_ms / 1000, true)
    player.playVideo()
    startCaptionGuard(player)
    startTicker()
  }, [startCaptionGuard, startTicker])

  useEffect(() => {
    let cancelled = false
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return
        const videoId = video.video_url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/)?.[1]
        if (!videoId) {
          setFailed(true)
          return
        }
        playerRef.current = new YT.Player(hostRef.current, {
          videoId,
          playerVars: { ...YOUTUBE_LOCKED_VARS, origin: window.location.origin },
          events: {
            onReady: (event) => {
              if (cancelled) return
              const player = event.target as YouTubePlayerInstance
              player.setPlaybackQualityRange?.('hd720', 'hd720')
              player.setPlaybackQuality?.('hd720')
              stripCaptions(player)
              setReady(true)
            },
            onApiChange: (event) => {
              // Fired when a module (notably `captions`) is loaded or unloaded.
              if (!cancelled) stripCaptions(event.target as YouTubePlayerInstance)
            },
            onStateChange: (event) => {
              if (cancelled) return
              const player = event.target as YouTubePlayerInstance
              stripCaptions(player)
              // 1 = playing, 3 = buffering. Buffering only counts as "playing"
              // after the learner has started a segment, otherwise the cover
              // would flash away during the initial cue.
              if (event.data === 1 || (event.data === 3 && hasStartedRef.current)) {
                startCaptionGuard(player)
                window.setTimeout(() => { if (!cancelled) stripCaptions(player) }, 350)
                setPlaying(true)
                startTicker()
                return
              }
              if (event.data === 3) return
              setPlaying(false)
              stopCaptionGuard()
              stopTicker()
            },
          },
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      stopTicker()
      stopCaptionGuard()
      try {
        playerRef.current?.destroy()
      } catch {
        /* the iframe can already be detached */
      }
      playerRef.current = null
    }
  }, [startCaptionGuard, startTicker, stopCaptionGuard, stopTicker, video.video_url])

  useEffect(() => {
    if (!ready || playToken === 0) return
    playSegment()
  }, [playSegment, playToken, ready])

  if (failed || !embedUrl) {
    return (
      <div className="video-stage practice-stage">
        {embedUrl && (
          <iframe
            className="video-frame"
            src={embedUrl}
            title={video.title}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          />
        )}
        {/* No IFrame API here: cc_load_policy=0 is the only caption guard, but
            the video itself stays visible like everywhere else. */}
        <div className="video-fallback-note">
          <p>{t.videoYoutubeFallback}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`video-stage practice-stage${playing ? ' is-playing' : ''}`}>
      <div className="video-youtube-host" ref={hostRef} />
      {/* YouTube shows its own pause overlay (history, related videos, logo)
          whenever the iframe is paused. A custom cover keeps that chrome hidden
          and still gives the learner a clear replay button. */}
      {!playing && (
        <StageCover
          poster={poster}
          label={playToken === 0 ? t.practiceStart : t.practiceReplay}
          onPlay={onPlay}
        />
      )}
    </div>
  )
}

function FilePracticePlayer({ video, segment, playToken, onPlay }: PracticePlayerProps) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (playToken === 0) return
    const element = videoRef.current
    if (!element) return
    const start = Math.min(segment.start_ms / 1000, Math.max(0, (element.duration || 0) - 0.1))
    element.currentTime = Math.max(0, start)
    void element.play().catch(() => {
      /* a blocked autoplay leaves the cover in place, so the learner can retry */
    })
  }, [playToken, segment])

  function handleTimeUpdate(event: SyntheticEvent<HTMLVideoElement>) {
    const element = event.currentTarget
    if (element.currentTime * 1000 >= segment.end_ms - 100) element.pause()
  }

  return (
    <div className="video-stage practice-stage">
      <video
        className="video-file"
        ref={videoRef}
        playsInline
        preload="metadata"
        poster={video.thumbnail_url ?? undefined}
        src={video.video_url}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
      />
      {!playing && (
        <StageCover
          poster={video.thumbnail_url ?? null}
          label={playToken === 0 ? t.practiceStart : t.practiceReplay}
          onPlay={onPlay}
        />
      )}
    </div>
  )
}

function PracticePlayer(props: PracticePlayerProps) {
  return props.video.provider === 'youtube'
    ? <YouTubePracticePlayer {...props} />
    : <FilePracticePlayer {...props} />
}

interface PracticeViewProps {
  video: VideoLessonDetail
  savedWords: SavedWord[]
  onSavedWord: (word: SavedWord) => void
  onBack: () => void
}

function normalizeSavedWord(value: string): string {
  return value.toLocaleLowerCase('en').replace(/[^a-z0-9]/g, '')
}

export function PracticeView({ video, savedWords, onSavedWord, onBack }: PracticeViewProps) {
  const { t } = useI18n()
  const segments = video.segments
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [playToken, setPlayToken] = useState(0)
  const [finished, setFinished] = useState(false)
  const [savingWord, setSavingWord] = useState<string | null>(null)
  const [saveNote, setSaveNote] = useState<{ tone: 'info' | 'ok' | 'error'; text: string } | null>(null)
  const savedKeys = useMemo(
    () => new Set(savedWords.map((word) => normalizeSavedWord(word.word))),
    [savedWords],
  )

  useEffect(() => {
    if (!saveNote) return
    const timer = window.setTimeout(() => setSaveNote(null), 3_200)
    return () => window.clearTimeout(timer)
  }, [saveNote])

  const segment = segments[index]
  const scriptTokens = useMemo(
    () => tokenizeDictation(segment?.text_en ?? ''),
    [segment?.text_en],
  )
  const typedTokens = useMemo(() => tokenizeDictation(typed), [typed])
  const match = useMemo(
    () => matchDictation(scriptTokens, typedTokens),
    [scriptTokens, typedTokens],
  )
  const revealed = match.revealed
  const complete = scriptTokens.length > 0 && revealed.size === scriptTokens.length
  const percent = scriptTokens.length > 0
    ? Math.round((revealed.size / scriptTokens.length) * 100)
    : 0
  const paddedIndex = String(index + 1).padStart(2, '0')
  const paddedTotal = String(segments.length).padStart(2, '0')

  function replaySegment() {
    setPlayToken((token) => token + 1)
  }

  function goNext() {
    if (!complete) return
    if (index + 1 >= segments.length) {
      setFinished(true)
      return
    }
    setIndex((value) => value + 1)
    setTyped('')
    setPlayToken((token) => token + 1)
  }

  function restart() {
    setIndex(0)
    setTyped('')
    setPlayToken(0)
    setFinished(false)
    setSaveNote(null)
  }

  async function saveScriptWord(token: DictationToken) {
    if (token.clean.length < 3 || savingWord || savedKeys.has(token.clean)) return
    setSavingWord(token.clean)
    setSaveNote(null)
    try {
      const known = video.vocabulary.find((entry) => normalizeSavedWord(entry.word) === token.clean)
      if (known) {
        const saved = await saveWordApi({
          word: token.raw,
          ipa: known.ipa || undefined,
          meaningVi: known.meaning_vi || undefined,
          detailVi: known.detail_vi || undefined,
          videoId: video.id,
        })
        onSavedWord(saved)
        setSaveNote({ tone: 'ok', text: t.practiceWordSaved(saved.word) })
      } else {
        setSaveNote({ tone: 'info', text: t.practiceWordSaving(token.raw) })
        const lookup = await lookupWordApi(token.raw)
        const saved = await saveWordApi({
          word: lookup.word || token.raw,
          ipa: lookup.phonetic || undefined,
          meaningVi: lookup.meaning || undefined,
          detailVi: [lookup.partOfSpeech, lookup.example].filter(Boolean).join(' · ') || undefined,
          videoId: video.id,
        })
        onSavedWord(saved)
        setSaveNote({ tone: 'ok', text: t.practiceWordSaved(saved.word) })
      }
    } catch {
      setSaveNote({ tone: 'error', text: t.practiceWordSaveFailed })
    } finally {
      setSavingWord(null)
    }
  }

  if (!segment) {
    return (
      <div className="practice-unavailable">
        <span className="practice-unavailable-icon"><Headphones size={44} weight="regular" /></span>
        <p>{t.videoListeningUnavailable}</p>
        <button type="button" className="practice-ghost-btn" onClick={onBack}>
          <span>{t.videoBack}</span>
        </button>
      </div>
    )
  }

  if (finished) {
    return (
      <div className="practice-practice">
        <div className="practice-done">
          <span className="practice-done-star is-a" aria-hidden="true">*</span>
          <span className="practice-done-star is-b" aria-hidden="true">*</span>
          <span className="practice-done-star is-c" aria-hidden="true">*</span>
          <span className="practice-done-icon"><Trophy size={64} weight="regular" /></span>
          <span className="practice-done-eyebrow">{t.practiceDoneEyebrow}</span>
          <h2>{t.practiceDoneTitle}</h2>
          <p>{t.practiceDoneDesc(segments.length)}</p>
          <div className="practice-done-actions">
            <button type="button" className="practice-solid-btn" onClick={restart}>
              <ArrowClockwise size={16} weight="bold" />
              <span>{t.practiceRestart}</span>
            </button>
            <button type="button" className="practice-ghost-btn" onClick={onBack}>
              <span>{t.practiceBackToLibrary}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="practice-practice">
      <div className="practice-layout">
        <div className="practice-media-column">
          <div className="practice-player-card">
            <div className="practice-player-head">
              <span className="practice-player-index">{paddedIndex} / {paddedTotal}</span>
              <span className="practice-player-time">
                {formatClock(segment.start_ms / 1000)} – {formatClock(segment.end_ms / 1000)}
              </span>
              <button
                type="button"
                className="practice-head-replay"
                onClick={replaySegment}
                aria-label={playToken === 0 ? t.practiceStart : t.practiceReplay}
                title={playToken === 0 ? t.practiceStart : t.practiceReplay}
              >
                <ArrowClockwise size={15} weight="bold" />
              </button>
            </div>

            <PracticePlayer
              video={video}
              segment={segment}
              playToken={playToken}
              onPlay={replaySegment}
            />

            <div className="practice-ticks is-on-media" aria-hidden="true">
              {segments.map((entry, tick) => (
                <span
                  key={entry.id}
                  className={`practice-tick${tick < index ? ' is-done' : ''}${tick === index ? ' is-current' : ''}`}
                />
              ))}
            </div>

            <p className="practice-player-note">{t.practiceControlHint}</p>
          </div>
        </div>

        <section className="practice-board" aria-label={t.practiceTitle}>
          <div className="practice-board-head">
            <h2 className="practice-board-title">
              <Headphones size={18} weight="bold" />
              {t.practiceTitle}
            </h2>
          </div>

          <div className="practice-script" aria-label={t.practiceScript}>
            {scriptTokens.map((token, tokenIndex) => {
              const isRevealed = revealed.has(tokenIndex)
              const prefixLength = match.prefixes.get(tokenIndex) ?? 0
              const isSaved = isRevealed && savedKeys.has(token.clean)
              const canSave = isRevealed && token.clean.length >= 3 && !isSaved
              return (
                <button
                  key={`${token.clean}-${tokenIndex}`}
                  type="button"
                  className={`practice-word${isRevealed ? ' is-revealed' : prefixLength > 0 ? ' is-partial' : ' is-hidden'}${isSaved ? ' is-saved' : ''}`}
                  aria-label={isRevealed ? undefined : t.practiceHiddenWord(token.raw.length)}
                  title={canSave ? t.practiceSaveWordHint : undefined}
                  disabled={!canSave}
                  onClick={canSave ? () => void saveScriptWord(token) : undefined}
                >
                  {isRevealed
                    ? token.raw
                    : (
                      <>
                        {prefixLength > 0 && (
                          <span className="practice-prefix" aria-hidden="true">{token.raw.slice(0, prefixLength)}</span>
                        )}
                        <span aria-hidden="true">{'*'.repeat(token.raw.length - prefixLength)}</span>
                      </>
                    )}
                  {isSaved && <CheckCircle className="practice-word-saved" size={12} weight="fill" aria-hidden="true" />}
                  {savingWord === token.clean && <span className="practice-save-spinner" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
          <p className="practice-save-hint">
            <CheckCircle size={13} weight="regular" />
            <span>{t.practiceSaveWordHint}</span>
          </p>
          {saveNote && (
            <p className={`practice-save-note is-${saveNote.tone}`} role="status">
              {saveNote.tone === 'info'
                ? <span className="practice-save-spinner" aria-hidden="true" />
                : <CheckCircle size={14} weight="fill" />}
              <span>{saveNote.text}</span>
            </p>
          )}

          <div className="practice-progress-row">
            <span>{t.practiceRevealed(revealed.size, scriptTokens.length)}</span>
            <strong>{percent}%</strong>
          </div>
          <div className="practice-meter" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </div>

          <label className="practice-input-label" htmlFor="practice-answer">{t.practiceInputLabel}</label>
          <textarea
            id="practice-answer"
            className={`practice-input${complete ? ' is-complete' : ''}`}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                if (complete) goNext()
              }
            }}
            placeholder={t.practicePlaceholder}
            rows={3}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
          />

          {complete ? (
            <p className="practice-success" role="status">
              <CheckCircle size={17} weight="fill" />
              <span>{t.practiceSuccess}</span>
            </p>
          ) : (
            <p className="practice-hint">{t.practiceLockedHint}</p>
          )}

          <button
            type="button"
            className="practice-next"
            disabled={!complete}
            onClick={goNext}
          >
            <span>{index + 1 >= segments.length ? t.practiceFinish : t.practiceNext}</span>
            <ArrowRight size={17} weight="bold" />
          </button>
        </section>
      </div>
    </div>
  )
}
