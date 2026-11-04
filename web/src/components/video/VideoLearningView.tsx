import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowClockwise,
  ArrowLeft,
  BookOpenText,
  CheckCircle,
  Clock,
  Headphones,
  LinkSimple,
  Play,
  Plus,
  Sparkle,
  Trash,
  Trophy,
  X,
  YoutubeLogo,
} from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import { ApiError } from '../../services/apiClient'
import { ParrotPracticeView } from './ParrotPracticeView'
import { VideoNotebookView } from './VideoNotebookView'
import {
  deleteVideoApi,
  getSavedWordsApi,
  getVideoApi,
  getVideosApi,
  importVideoApi,
} from '../../services/videoService'
import type {
  SavedWord,
  VideoLessonDetail,
  VideoLessonSummary,
} from '../../types/video'
import {
  formatClock,
  videoCompletionRatio,
  youtubeThumbnailUrl,
} from '../../utils/videoPlayback'

interface VideoLessonViewProps {
  videoId: number
  onBack: () => void
  onOpenNotebook: () => void
  savedWords: SavedWord[]
  onSavedWord: (word: SavedWord) => void
}

function VideoLessonView({
  videoId,
  onBack,
  onOpenNotebook,
  savedWords,
  onSavedWord,
}: VideoLessonViewProps) {
  const { t } = useI18n()
  const [video, setVideo] = useState<VideoLessonDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    let cancelled = false
    getVideoApi(videoId)
      .then((detail) => {
        if (cancelled) return
        setVideo(detail)
        setLoading(false)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : t.videoLoadError)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [videoId, reloadKey, t.videoLoadError])

  if (loading) {
    return (
      <div className="video-state-card">
        <span className="video-spinner" aria-hidden="true" />
        <p>{t.videoLoading}</p>
      </div>
    )
  }

  if (error || !video) {
    return (
      <div className="video-state-card">
        <p>{error ?? t.videoLoadError}</p>
        <button type="button" className="video-ghost-btn" onClick={() => {
          setLoading(true)
          setError(null)
          setReloadKey((key) => key + 1)
        }}>
          <ArrowClockwise size={16} />
          <span>{t.retry}</span>
        </button>
      </div>
    )
  }

  const completed = Boolean(video.progress?.completed)
  const hasSegments = video.segments.length > 0
  const segmentNumber = String(video.segments.length).padStart(2, '0')

  return (
    <div className="video-detail">
      <div className="parrot-topbar">
        <button type="button" className="parrot-back-btn" onClick={onBack}>
          <ArrowLeft size={19} weight="regular" />
          <span>{t.videoBack}</span>
        </button>
        <div className="parrot-topbar-meta">
          <span className="parrot-meta is-solid">{video.cefr_level}</span>
          <span className="parrot-meta">{video.topic}</span>
          <span className="parrot-meta"><Clock size={12} weight="bold" /> {formatClock(video.duration_seconds)}</span>
          {hasSegments && (
            <span className="parrot-meta"><Headphones size={12} weight="bold" /> {t.videoSegmentsCount(video.segments.length)}</span>
          )}
          {completed && (
            <span className="parrot-meta is-solid"><CheckCircle size={12} weight="fill" /> {t.videoCompleted}</span>
          )}
          <button type="button" className="parrot-notebook-btn" onClick={onOpenNotebook}>
            <BookOpenText size={13} />
            <span>{t.videoNotebook}</span>
            <strong>{savedWords.length}</strong>
          </button>
        </div>
      </div>

      <header className="parrot-hero">
        <div className="parrot-hero-copy">
          <span className="parrot-eyebrow">
            <Headphones size={14} weight="bold" />
            {t.parrotEyebrow}
          </span>
          <h1>{video.title}</h1>
          {video.description && <p>{video.description}</p>}
        </div>
        {hasSegments && (
          <div className="parrot-hero-mark" aria-hidden="true">
            <span>{t.parrotSegmentsUnit}</span>
            <strong>{segmentNumber}</strong>
            <small>* * *</small>
          </div>
        )}
      </header>

      {hasSegments ? (
        <ParrotPracticeView
          video={video}
          savedWords={savedWords}
          onSavedWord={onSavedWord}
          onBack={onBack}
        />
      ) : (
        <div className="parrot-unavailable">
          <span className="parrot-unavailable-icon"><Headphones size={44} weight="regular" /></span>
          <p>{t.videoListeningUnavailable}</p>
          <button type="button" className="parrot-ghost-btn" onClick={onBack}>
            <span>{t.videoBack}</span>
          </button>
        </div>
      )}
    </div>
  )
}

type VideoScope = 'all' | 'library' | 'mine'

export function VideoLearningView() {
  const { t } = useI18n()
  const [videos, setVideos] = useState<VideoLessonSummary[]>([])

  useEffect(() => {
    document.documentElement.dataset.videoMono = 'true'
    return () => {
      delete document.documentElement.dataset.videoMono
    }
  }, [])

  const [savedWords, setSavedWords] = useState<SavedWord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState('all')
  const [scope, setScope] = useState<VideoScope>('all')
  const [view, setView] = useState<'library' | 'notebook'>('library')
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getVideosApi(), getSavedWordsApi()])
      .then(([loadedVideos, loadedWords]) => {
        if (cancelled) return
        setVideos(loadedVideos)
        setSavedWords(loadedWords)
        setLoading(false)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : t.videoLoadError)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [reloadKey, t.videoLoadError])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5_000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const scopedVideos = useMemo(() => {
    if (scope === 'mine') return videos.filter((video) => video.is_owned)
    if (scope === 'library') return videos.filter((video) => !video.is_owned)
    return videos
  }, [scope, videos])
  const levels = useMemo(
    () => Array.from(new Set(scopedVideos.map((video) => video.cefr_level))).sort(),
    [scopedVideos],
  )
  const filteredVideos = useMemo(
    () => level === 'all' ? scopedVideos : scopedVideos.filter((video) => video.cefr_level === level),
    [level, scopedVideos],
  )
  const completedCount = videos.filter((video) => video.progress?.completed).length
  const earnedXp = videos
    .filter((video) => video.progress?.completed)
    .reduce((sum, video) => sum + video.xp_reward, 0)

  function importErrorMessage(importFailure: unknown): string {
    if (importFailure instanceof ApiError) {
      const codes = importFailure.errors
      if (codes.includes('INVALID_YOUTUBE_URL')) return t.videoImportInvalid
      if (codes.includes('VIDEO_TOO_LONG')) return t.videoImportTooLong
      if (codes.includes('VIDEO_NO_CAPTIONS')) return t.videoImportNoCaptions
      if (codes.includes('VIDEO_UNAVAILABLE')) return t.videoImportUnavailable
      if (codes.includes('VIDEO_ALREADY_IMPORTED')) return t.videoImportDuplicate
      if (codes.includes('VIDEO_IMPORT_LIMIT')) return t.videoImportLimit
      if (codes.includes('VIDEO_IMPORT_TIMEOUT')) return t.videoImportTimeout
      if (codes.includes('VIDEO_IMPORT_UNAVAILABLE')) return t.videoImportUnavailable
    }
    return importFailure instanceof Error ? importFailure.message : t.videoImportError
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const url = importUrl.trim()
    if (!url || importing) return
    setImporting(true)
    setImportError(null)
    try {
      const video = await importVideoApi(url)
      setVideos((current) => [
        video,
        ...current.filter((entry) => entry.id !== video.id),
      ])
      setImportUrl('')
      setSelectedVideoId(video.id)
    } catch (importFailure) {
      setImportError(importErrorMessage(importFailure))
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(video: VideoLessonSummary) {
    if (!window.confirm(t.videoDeleteConfirm(video.title))) return
    setDeletingId(video.id)
    try {
      await deleteVideoApi(video.id)
      setVideos((current) => current.filter((entry) => entry.id !== video.id))
      setNotice({ tone: 'ok', text: t.videoDeleteDone(video.title) })
    } catch {
      setNotice({ tone: 'error', text: t.videoDeleteError })
    } finally {
      setDeletingId(null)
    }
  }

  if (view === 'notebook') {
    return (
      <VideoNotebookView
        words={savedWords}
        onBack={() => setView('library')}
        onWordsChange={setSavedWords}
      />
    )
  }

  if (selectedVideoId !== null) {
    return (
      <div className="tab-view-container">
        <VideoLessonView
          videoId={selectedVideoId}
          onBack={() => setSelectedVideoId(null)}
          onOpenNotebook={() => {
            setSelectedVideoId(null)
            setView('notebook')
          }}
          savedWords={savedWords}
          onSavedWord={(word) => {
            setSavedWords((current) => [word, ...current.filter((entry) => entry.id !== word.id)])
          }}
        />
      </div>
    )
  }

  return (
    <div className="tab-view-container">
      <div className="page-heading page-heading-row">
        <div>
          <span className="page-eyebrow">{t.videosEyebrow}</span>
          <h1>{t.videosTitle}</h1>
          <p>{t.videosDesc}</p>
        </div>
        <div className="video-heading-actions">
          <span className="page-note"><YoutubeLogo size={16} weight="duotone" /> {t.videosNote}</span>
          <button type="button" className="video-notebook-link" onClick={() => setView('notebook')}>
            <BookOpenText size={15} />
            <span>{t.videoNotebook}</span>
            <strong>{savedWords.length}</strong>
          </button>
        </div>
      </div>

      <section className="video-hero">
        <div className="video-hero-copy">
          <span className="video-section-label"><Sparkle size={14} weight="fill" /> {t.videosHeroKicker}</span>
          <h2>{t.videosHeroTitle}</h2>
          <p>{t.videosHeroDesc}</p>
          <div className="video-hero-actions">
            <span><Play size={15} weight="fill" /> {t.videosHeroStat(videos.length)}</span>
            <span><CheckCircle size={15} weight="fill" /> {t.videosHeroDone(completedCount)}</span>
            <span><Trophy size={15} weight="fill" /> +{earnedXp} XP</span>
          </div>
        </div>
        <div className="video-hero-visual" aria-hidden="true">
          <span className="video-hero-ring is-one" />
          <span className="video-hero-ring is-two" />
          <span className="video-hero-play"><Play size={34} weight="fill" /></span>
        </div>
      </section>

      <section className="video-import-card" aria-label={t.videoImportTitle}>
        <div className="video-import-head">
          <span className="video-section-label"><YoutubeLogo size={16} weight="fill" /> {t.videoImportTitle}</span>
          <span className="video-import-hint">{t.videoImportHint}</span>
        </div>
        <p className="video-import-desc">{t.videoImportDesc}</p>
        <form className="video-import-form" onSubmit={(event) => void handleImport(event)}>
          <label className="video-import-field">
            <LinkSimple size={17} />
            <input
              type="url"
              value={importUrl}
              onChange={(event) => setImportUrl(event.target.value)}
              placeholder={t.videoImportPlaceholder}
              aria-label={t.videoImportTitle}
              disabled={importing}
            />
          </label>
          <button type="submit" className="video-primary-btn" disabled={importing || !importUrl.trim()}>
            {importing ? <span className="video-spinner is-small" aria-hidden="true" /> : <Plus size={16} weight="bold" />}
            <span>{importing ? t.videoImporting : t.videoImportAction}</span>
          </button>
        </form>
        {importError && <p className="video-import-error" role="alert">{importError}</p>}
      </section>

      {notice && (
        <div className={`video-toast is-${notice.tone}`} role="status">
          <Sparkle size={16} weight="fill" />
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={t.close}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="video-scope-row">
        {([
          ['all', t.videoScopeAll],
          ['library', t.videoScopeLibrary],
          ['mine', t.videoScopeMine],
        ] as Array<[VideoScope, string]>).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`video-scope-chip${scope === value ? ' is-active' : ''}`}
            onClick={() => {
              setScope(value)
              setLevel('all')
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="video-filter-row">
        <button
          type="button"
          className={`video-filter-chip${level === 'all' ? ' is-active' : ''}`}
          onClick={() => setLevel('all')}
        >
          {t.videoAllLevels}
        </button>
        {levels.map((entry) => (
          <button
            key={entry}
            type="button"
            className={`video-filter-chip${level === entry ? ' is-active' : ''}`}
            onClick={() => setLevel(entry)}
          >
            {entry}
          </button>
        ))}
      </div>

      {loading && (
        <div className="video-state-card">
          <span className="video-spinner" aria-hidden="true" />
          <p>{t.videoLoading}</p>
        </div>
      )}

      {!loading && error && (
        <div className="video-state-card">
          <p>{error}</p>
          <button type="button" className="video-ghost-btn" onClick={() => {
            setLoading(true)
            setError(null)
            setReloadKey((key) => key + 1)
          }}>
            <ArrowClockwise size={16} />
            <span>{t.retry}</span>
          </button>
        </div>
      )}

      {!loading && !error && filteredVideos.length === 0 && (
        <div className="video-state-card">
          <p>{scope === 'mine' ? t.videoMineEmpty : t.videoEmpty}</p>
        </div>
      )}

      {!loading && !error && filteredVideos.length > 0 && (
        <div className="video-grid">
          {filteredVideos.map((video) => {
            const thumb = video.thumbnail_url ?? youtubeThumbnailUrl(video.video_url)
            const completed = Boolean(video.progress?.completed)
            const ratio = videoCompletionRatio(
              video.duration_seconds,
              video.progress?.watched_seconds ?? 0,
            )
            return (
              <article className={`video-card${completed ? ' is-completed' : ''}`} key={video.id}>
                <button
                  type="button"
                  className="video-thumb"
                  onClick={() => setSelectedVideoId(video.id)}
                  aria-label={t.videoOpen(video.title)}
                >
                  {thumb
                    ? <img src={thumb} alt="" loading="lazy" />
                    : <span className="video-thumb-fallback" />}
                  <span className="video-thumb-shade" />
                  <span className="video-thumb-play"><Play size={24} weight="fill" /></span>
                  <span className="video-thumb-duration">{formatClock(video.duration_seconds)}</span>
                  {completed && (
                    <span className="video-thumb-done">
                      <CheckCircle size={16} weight="fill" /> {t.videoCompleted}
                    </span>
                  )}
                </button>

                {video.is_owned && (
                  <button
                    type="button"
                    className="video-card-delete"
                    onClick={() => void handleDelete(video)}
                    disabled={deletingId === video.id}
                    aria-label={t.videoDelete}
                    title={t.videoDelete}
                  >
                    <Trash size={18} weight="regular" />
                  </button>
                )}

                <div className="video-card-body">
                  <div className="video-card-chips">
                    <span className="video-chip is-level">{video.cefr_level}</span>
                    <span className="video-chip">{video.topic}</span>
                    {video.is_owned && <span className="video-chip is-owned">{t.videoOwned}</span>}
                  </div>
                  <h3>{video.title}</h3>
                  {video.description && <p>{video.description}</p>}
                  <div className="video-card-footer">
                    <div className="video-card-progress">
                      <div className="video-meter-track" aria-hidden="true">
                        <span style={{ width: `${ratio}%` }} />
                      </div>
                      <small>{completed ? t.videoCompleted : t.videoProgressLabel(ratio)}</small>
                    </div>
                    <span className="video-card-xp">
                      {video.xp_reward > 0 ? `+${video.xp_reward} XP` : t.videoPractice}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="video-card-action"
                    onClick={() => setSelectedVideoId(video.id)}
                  >
                    <Play size={15} weight="fill" />
                    <span>{completed ? t.videoReview : t.videoStart}</span>
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
