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
    <button type="button" className="parrot-cover" onClick={onPlay}>
      {poster && (
        <span
          className="parrot-cover-poster"
          aria-hidden="true"
          style={{ backgroundImage: `url("${poster}")` }}
        />
      )}
      <span className="parrot-cover-play">
        <Play size={22} weight="fill" />
      </span>
      <span className="parrot-cover-label">{label}</span>
    </button>
  )
}

function YouTubePracticePlayer({ video, segment, playToken, onPlay }: PracticePlayerProps) {
  const { t } = useI18n()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YouTubePlayerInstance | null>(null)
  const tickerRef = useRef<number | null>(null)
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
    player.seekTo(current.start_ms / 1000, true)
    player.playVideo()
    startTicker()
  }, [startTicker])

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
              // Pin 720p and drop the caption renderer so nothing can turn it back on.
              player.setPlaybackQualityRange?.('hd720', 'hd720')
              player.setPlaybackQuality?.('hd720')
              player.unloadModule?.('captions')
              player.unloadModule?.('cc')
              setReady(true)
            },
            onStateChange: (event) => {
              if (event.data === 1) {
                setPlaying(true)
                startTicker()
                return
              }
              setPlaying(false)
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
      try {
        playerRef.current?.destroy()
      } catch {
        /* the iframe can already be detached */
      }
      playerRef.current = null
    }
  }, [startTicker, stopTicker, video.video_url])

  useEffect(() => {
    if (!ready || playToken === 0) return
    playSegment()
  }, [playSegment, playToken, ready])

  if (failed || !embedUrl) {
    return (
      <div className="video-stage parrot-stage">
        {embedUrl && (
          <iframe
            className="video-frame"
            src={embedUrl}
            title={video.title}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          />
        )}
        <div className="video-fallback-note">
          <p>{t.videoYoutubeFallback}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="video-stage parrot-stage">
      <div className="video-youtube-host" ref={hostRef} />
      {!playing && (
        <StageCover
          poster={poster}
          label={playToken === 0 ? t.parrotStart : t.parrotReplay}
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
    <div className="video-stage parrot-stage">
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
          label={playToken === 0 ? t.parrotStart : t.parrotReplay}
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

interface ParrotPracticeViewProps {
  video: VideoLessonDetail
  savedWords: SavedWord[]
  onSavedWord: (word: SavedWord) => void
  onBack: () => void
}

function normalizeSavedWord(value: string): string {
  return value.toLocaleLowerCase('en').replace(/[^a-z0-9]/g, '')
}

export function ParrotPracticeView({ video, savedWords, onSavedWord, onBack }: ParrotPracticeViewProps) {
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
        setSaveNote({ tone: 'ok', text: t.parrotWordSaved(saved.word) })
      } else {
        setSaveNote({ tone: 'info', text: t.parrotWordSaving(token.raw) })
        const lookup = await lookupWordApi(token.raw)
        const saved = await saveWordApi({
          word: lookup.word || token.raw,
          ipa: lookup.phonetic || undefined,
          meaningVi: lookup.meaning || undefined,
          detailVi: [lookup.partOfSpeech, lookup.example].filter(Boolean).join(' · ') || undefined,
          videoId: video.id,
        })
        onSavedWord(saved)
        setSaveNote({ tone: 'ok', text: t.parrotWordSaved(saved.word) })
      }
    } catch {
      setSaveNote({ tone: 'error', text: t.parrotWordSaveFailed })
    } finally {
      setSavingWord(null)
    }
  }

  if (!segment) {
    return (
      <div className="parrot-unavailable">
        <span className="parrot-unavailable-icon"><Headphones size={44} weight="regular" /></span>
        <p>{t.videoListeningUnavailable}</p>
        <button type="button" className="parrot-ghost-btn" onClick={onBack}>
          <span>{t.videoBack}</span>
        </button>
      </div>
    )
  }

  if (finished) {
    return (
      <div className="parrot-practice">
        <div className="parrot-done">
          <span className="parrot-done-star is-a" aria-hidden="true">*</span>
          <span className="parrot-done-star is-b" aria-hidden="true">*</span>
          <span className="parrot-done-star is-c" aria-hidden="true">*</span>
          <span className="parrot-done-icon"><Trophy size={64} weight="regular" /></span>
          <span className="parrot-done-eyebrow">{t.parrotDoneEyebrow}</span>
          <h2>{t.parrotDoneTitle}</h2>
          <p>{t.parrotDoneDesc(segments.length)}</p>
          <div className="parrot-done-actions">
            <button type="button" className="parrot-solid-btn" onClick={restart}>
              <ArrowClockwise size={16} weight="bold" />
              <span>{t.parrotRestart}</span>
            </button>
            <button type="button" className="parrot-ghost-btn" onClick={onBack}>
              <span>{t.parrotBackToLibrary}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="parrot-practice">
      <div className="parrot-layout">
        <div className="parrot-media-column">
          <div className="parrot-player-card">
            <div className="parrot-player-head">
              <span className="parrot-player-index">{paddedIndex} / {paddedTotal}</span>
              <span className="parrot-player-time">
                {formatClock(segment.start_ms / 1000)} – {formatClock(segment.end_ms / 1000)}
              </span>
              <button
                type="button"
                className="parrot-head-replay"
                onClick={replaySegment}
                aria-label={playToken === 0 ? t.parrotStart : t.parrotReplay}
                title={playToken === 0 ? t.parrotStart : t.parrotReplay}
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

            <div className="parrot-ticks is-on-media" aria-hidden="true">
              {segments.map((entry, tick) => (
                <span
                  key={entry.id}
                  className={`parrot-tick${tick < index ? ' is-done' : ''}${tick === index ? ' is-current' : ''}`}
                />
              ))}
            </div>

            <p className="parrot-player-note">{t.parrotControlHint}</p>
          </div>
        </div>

        <section className="parrot-board" aria-label={t.parrotTitle}>
          <div className="parrot-board-head">
            <h2 className="parrot-board-title">
              <Headphones size={18} weight="bold" />
              {t.parrotTitle}
            </h2>
          </div>

          <div className="parrot-script" aria-label={t.parrotScript}>
            {scriptTokens.map((token, tokenIndex) => {
              const isRevealed = revealed.has(tokenIndex)
              const prefixLength = match.prefixes.get(tokenIndex) ?? 0
              const isSaved = isRevealed && savedKeys.has(token.clean)
              const canSave = isRevealed && token.clean.length >= 3 && !isSaved
              return (
                <button
                  key={`${token.clean}-${tokenIndex}`}
                  type="button"
                  className={`parrot-word${isRevealed ? ' is-revealed' : prefixLength > 0 ? ' is-partial' : ' is-hidden'}${isSaved ? ' is-saved' : ''}`}
                  aria-label={isRevealed ? undefined : t.parrotHiddenWord(token.raw.length)}
                  title={canSave ? t.parrotSaveWordHint : undefined}
                  disabled={!canSave}
                  onClick={canSave ? () => void saveScriptWord(token) : undefined}
                >
                  {isRevealed
                    ? token.raw
                    : (
                      <>
                        {prefixLength > 0 && (
                          <span className="parrot-prefix" aria-hidden="true">{token.raw.slice(0, prefixLength)}</span>
                        )}
                        <span aria-hidden="true">{'*'.repeat(token.raw.length - prefixLength)}</span>
                      </>
                    )}
                  {isSaved && <CheckCircle className="parrot-word-saved" size={12} weight="fill" aria-hidden="true" />}
                  {savingWord === token.clean && <span className="parrot-save-spinner" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
          <p className="parrot-save-hint">
            <CheckCircle size={13} weight="regular" />
            <span>{t.parrotSaveWordHint}</span>
          </p>
          {saveNote && (
            <p className={`parrot-save-note is-${saveNote.tone}`} role="status">
              {saveNote.tone === 'info'
                ? <span className="parrot-save-spinner" aria-hidden="true" />
                : <CheckCircle size={14} weight="fill" />}
              <span>{saveNote.text}</span>
            </p>
          )}

          <div className="parrot-progress-row">
            <span>{t.parrotRevealed(revealed.size, scriptTokens.length)}</span>
            <strong>{percent}%</strong>
          </div>
          <div className="parrot-meter" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </div>

          <label className="parrot-input-label" htmlFor="parrot-answer">{t.parrotInputLabel}</label>
          <textarea
            id="parrot-answer"
            className={`parrot-input${complete ? ' is-complete' : ''}`}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                if (complete) goNext()
              }
            }}
            placeholder={t.parrotPlaceholder}
            rows={3}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
          />

          {complete ? (
            <p className="parrot-success" role="status">
              <CheckCircle size={17} weight="fill" />
              <span>{t.parrotSuccess}</span>
            </p>
          ) : (
            <p className="parrot-hint">{t.parrotLockedHint}</p>
          )}

          <button
            type="button"
            className="parrot-next"
            disabled={!complete}
            onClick={goNext}
          >
            <span>{index + 1 >= segments.length ? t.parrotFinish : t.parrotNext}</span>
            <ArrowRight size={17} weight="bold" />
          </button>
        </section>
      </div>
    </div>
  )
}
