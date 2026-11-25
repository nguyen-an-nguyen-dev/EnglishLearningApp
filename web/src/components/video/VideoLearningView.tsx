import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowClockwise,
  ArrowLeft,
  Check,
  BookOpenText,
  CheckCircle,
  Clock,
  Headphones,
  LinkSimple,
  MagnifyingGlass,
  Play,
  Plus,
  Sparkle,
  Trash,
  Trophy,
  X,
  YoutubeLogo,
} from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import { LoadingDots } from '../LoadingDots'
import { videoImportErrorMessage } from '../../utils/videoImportErrors'
import { PracticeView } from './PracticeView'
import { VideoNotebookView } from './VideoNotebookView'
import { VideoCarousel } from './VideoCarousel'
import {
  deleteVideoApi,
  getSavedWordsApi,
  getVideoApi,
  getVideosApi,
  importVideoApi,
  saveWordApi,
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
  /** Notifies the library shell so its counters can refresh. */
  onCompleted: () => void
}

function VideoLessonView({
  videoId,
  onBack,
  onOpenNotebook,
  savedWords,
  onSavedWord,
  onCompleted,
}: VideoLessonViewProps) {
  const { t } = useI18n()
  const [video, setVideo] = useState<VideoLessonDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [savingWord, setSavingWord] = useState<string | null>(null)
  const [vocabNote, setVocabNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

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
        <LoadingDots label={t.videoLoading} />
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
  const savedWordNames = new Set(savedWords.map((entry) => entry.word.trim().toLowerCase()))

  async function handleSaveVocabulary(entry: VideoLessonDetail['vocabulary'][number]) {
    if (!video || savingWord) return
    setSavingWord(entry.word)
    setVocabNote(null)
    try {
      const saved = await saveWordApi({
        word: entry.word,
        ipa: entry.ipa || undefined,
        meaningVi: entry.meaning_vi || undefined,
        detailVi: entry.detail_vi || undefined,
        videoId: video.id,
      })
      onSavedWord(saved)
      setVocabNote({ tone: 'ok', text: t.videoVocabSaved })
    } catch (saveError) {
      setVocabNote({
        tone: 'error',
        text: saveError instanceof Error ? saveError.message : t.saveFailed,
      })
    } finally {
      setSavingWord(null)
    }
  }

  return (
    <div
      className="video-detail"
      data-video-title={video.title}
      data-video-topic={video.topic}
      data-video-level={video.cefr_level}
      data-video-desc={video.description || ''}
      data-video-segments={video.segments.slice(0, 8).map((s) => s.text_en).filter(Boolean).join(' / ')}
    >
      <div className="practice-topbar">
        <button type="button" className="practice-back-btn" onClick={onBack}>
          <ArrowLeft size={19} weight="regular" />
          <span>{t.videoBack}</span>
        </button>
        <div className="practice-topbar-meta">
          <span className="practice-meta is-solid">{video.cefr_level}</span>
          <span className="practice-meta">{video.topic}</span>
          <span className="practice-meta"><Clock size={12} weight="bold" /> {formatClock(video.duration_seconds)}</span>
          {hasSegments && (
            <span className="practice-meta"><Headphones size={12} weight="bold" /> {t.videoSegmentsCount(video.segments.length)}</span>
          )}
          {completed && (
            <span className="practice-meta is-solid"><CheckCircle size={12} weight="fill" /> {t.videoCompleted}</span>
          )}
          <button type="button" className="practice-notebook-btn" onClick={onOpenNotebook}>
            <BookOpenText size={13} />
            <span>{t.videoNotebook}</span>
          </button>
        </div>
      </div>

      <header className="practice-hero">
        <div className="practice-hero-copy">
          <span className="practice-eyebrow">
            <Headphones size={14} weight="bold" />
            {t.practiceEyebrow}
          </span>
          <h1>{video.title}</h1>
          {video.description && <p>{video.description}</p>}
        </div>
        {hasSegments && (
          <div className="practice-hero-mark" aria-hidden="true">
            <span>{t.practiceSegmentsUnit}</span>
            <strong>{segmentNumber}</strong>
            <small>* * *</small>
          </div>
        )}
      </header>

      {hasSegments ? (
        <PracticeView
          video={video}
          savedWords={savedWords}
          onSavedWord={onSavedWord}
          onBack={onBack}
          onVideoCompleted={onCompleted}
        />
      ) : (
        <div className="practice-unavailable">
          <span className="practice-unavailable-icon"><Headphones size={44} weight="regular" /></span>
          <p>{t.videoListeningUnavailable}</p>
          <button type="button" className="practice-ghost-btn" onClick={onBack}>
            <span>{t.videoBack}</span>
          </button>
        </div>
      )}

      {video.vocabulary.length > 0 && (
        <section className="video-vocab" aria-labelledby="video-vocab-title">
          <header className="video-vocab-head">
            <span className="video-section-label"><Sparkle size={13} weight="fill" /> {t.videoVocabTitle}</span>
            <h2 id="video-vocab-title">{t.videoVocabTitle}</h2>
            <p>{t.videoVocabDesc}</p>
          </header>
          <ul className="video-vocab-list">
            {video.vocabulary.map((entry) => {
              const saved = savedWordNames.has(entry.word.trim().toLowerCase())
              return (
                <li key={entry.id} className="video-vocab-item">
                  <div className="video-vocab-word">
                    <strong>{entry.word}</strong>
                    {entry.ipa && <span>{entry.ipa}</span>}
                  </div>
                  <p className="video-vocab-meaning">{entry.meaning_vi}</p>
                  {entry.detail_vi && <p className="video-vocab-detail">{entry.detail_vi}</p>}
                  <button
                    type="button"
                    className="video-ghost-btn video-vocab-save"
                    disabled={saved || savingWord === entry.word}
                    onClick={() => void handleSaveVocabulary(entry)}
                  >
                    {saved ? <Check size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
                    <span>{saved ? t.videoVocabSaved : t.videoVocabSave}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {vocabNote && (
            <p className={`video-vocab-note is-${vocabNote.tone}`} role="status">
              {vocabNote.text}
            </p>
          )}
        </section>
      )}
    </div>
  )
}

interface VideoLearningViewProps {
  /** Deep-link from the buddy: open one video or the vocabulary notebook. */
  videoRequest?: { kind: 'video' | 'notebook'; videoId?: number; nonce: number } | null
  onVideoRequestHandled?: () => void
}

export function VideoLearningView({ videoRequest, onVideoRequestHandled }: VideoLearningViewProps) {
  const { t } = useI18n()
  const [videos, setVideos] = useState<VideoLessonSummary[]>([])
  const [levelFilter, setLevelFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    document.documentElement.dataset.videoMono = 'true'
    return () => {
      delete document.documentElement.dataset.videoMono
    }
  }, [])

  const [savedWords, setSavedWords] = useState<SavedWord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'library' | 'notebook'>('library')
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [importOpen, setImportOpen] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importStage, setImportStage] = useState<'extract' | 'segment'>('extract')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const importDialogRef = useRef<HTMLDialogElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  // Apply a buddy deep-link, then tell the parent it has been consumed.
  // This is a one-shot external navigation signal (not derived state), so the
  // setState-in-effect rule does not apply here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!videoRequest) return
    if (videoRequest.kind === 'notebook') {
      setView('notebook')
      setSelectedVideoId(null)
    } else if (videoRequest.videoId) {
      setView('library')
      setSelectedVideoId(videoRequest.videoId)
    }
    onVideoRequestHandled?.()
  }, [videoRequest, onVideoRequestHandled])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    let cancelled = false
    // The video library is the primary content and the vocabulary notebook is
    // secondary, so a failed word list must not blank out the library.
    Promise.allSettled([getVideosApi(), getSavedWordsApi()])
      .then(([videosResult, wordsResult]) => {
        if (cancelled) return
        if (wordsResult.status === 'fulfilled') setSavedWords(wordsResult.value)
        if (videosResult.status === 'fulfilled') {
          setVideos(videosResult.value)
          setError(null)
        } else {
          const loadError = videosResult.reason
          setError(loadError instanceof Error ? loadError.message : t.videoLoadError)
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [reloadKey, t.videoLoadError])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5_000)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const dialog = importDialogRef.current
    if (!dialog) return
    if (importOpen && !dialog.open) {
      dialog.showModal()
      importInputRef.current?.focus()
    }
    if (!importOpen && dialog.open) dialog.close()
  }, [importOpen])

  // The server can't report which pipeline stage it is in; the timeline is
  // honest enough to show "captions" first, then "AI splitting".
  useEffect(() => {
    if (!importing) return
    const timer = window.setTimeout(() => setImportStage('segment'), 1800)
    return () => window.clearTimeout(timer)
  }, [importing])

  const completedCount = videos.filter((video) => video.progress?.completed).length
  const earnedXp = videos
    .filter((video) => video.progress?.completed)
    .reduce((sum, video) => sum + video.xp_reward, 0)

  const sharedVideos = videos.filter((video) => !video.is_owned)
  const ownedVideos = videos.filter((video) => video.is_owned)
  const levels = Array.from(new Set(sharedVideos.map((video) => video.cefr_level))).sort()
  const query = searchQuery.trim().toLowerCase()
  const visibleShared = sharedVideos.filter((video) => {
    const matchesLevel = levelFilter === 'all' || video.cefr_level === levelFilter
    const matchesQuery = query === '' || `${video.title} ${video.topic} ${video.description ?? ''}`.toLowerCase().includes(query)
    return matchesLevel && matchesQuery
  })

  function importErrorMessage(importFailure: unknown): string {
    return videoImportErrorMessage(importFailure, t)
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const url = importUrl.trim()
    if (!url || importing) return
    setImporting(true)
    setImportStage('extract')
    setImportError(null)
    try {
      const video = await importVideoApi(url)
      setVideos((current) => [
        video,
        ...current.filter((entry) => entry.id !== video.id),
      ])
      setImportUrl('')
      setImportOpen(false)
      setNotice({ tone: 'ok', text: t.videoImportDone(video.title) })
      setSelectedVideoId(video.id)
    } catch (importFailure) {
      setImportError(importErrorMessage(importFailure))
    } finally {
      setImporting(false)
      setImportStage('extract')
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

  function renderVideoCard(video: VideoLessonSummary) {
            const thumb = video.thumbnail_url ?? youtubeThumbnailUrl(video.video_url)
            const completed = Boolean(video.progress?.completed)
            const ratio = videoCompletionRatio(
              video.duration_seconds,
              video.progress?.watched_seconds ?? 0,
            )
            return (
              <article className={`video-card${completed ? ' is-completed' : ''}${video.is_owned ? ' is-owned' : ''}`} key={video.id} data-buddy-target={`video:${video.id}`}>
                <button
                  type="button"
                  className="video-thumb"
                  onClick={() => setSelectedVideoId(video.id)}
                  aria-label={t.videoOpen(video.title)}
                >
                  {thumb
                    ? <img src={thumb} alt="" loading="lazy" decoding="async" />
                    : <span className="video-thumb-fallback" />}
                  <span className="video-thumb-shade" />
                  <span className="video-thumb-play"><Play size={24} weight="fill" /></span>
                  <span className="video-thumb-duration">{formatClock(video.duration_seconds)}</span>
                  {video.is_owned && (
                    <span className="video-thumb-owned">{t.videoOwnedBadge}</span>
                  )}
                  {completed && (
                    <span className="video-thumb-done">
                      <CheckCircle size={16} weight="fill" /> {t.videoCompleted}
                    </span>
                  )}
                  {ratio > 0 && (
                    <span className="video-thumb-progress" aria-hidden="true">
                      <span style={{ width: `${ratio}%` }} />
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
                  </div>
                  <h3>{video.title}</h3>
                  {video.description && <p>{video.description}</p>}
                  <div className="video-card-footer">
                    <span className="video-card-progress-text">
                      {completed ? t.videoCompleted : t.videoProgressLabel(ratio)}
                    </span>
                    <span className={`video-card-badge ${video.xp_reward > 0 ? 'is-xp' : 'is-practice'}`}>
                      {video.xp_reward > 0
                        ? <><Sparkle size={11} weight="fill" /><span>+{video.xp_reward} XP</span></>
                        : <><Headphones size={11} weight="bold" /><span>{t.videoPractice}</span></>}
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
          onCompleted={() => setReloadKey((key) => key + 1)}
        />
      </div>
    )
  }

  return (
    <div className="tab-view-container video-page">
      <div className="page-heading page-heading-row">
        <div>
          <span className="page-eyebrow">{t.videosEyebrow}</span>
          <h1>{t.videosTitle}</h1>
          <p>{t.videosDesc}</p>
        </div>
        <div className="video-heading-actions">
          <button
            type="button"
            className="video-add-btn"
            onClick={() => {
              setImportError(null)
              setImportOpen(true)
            }}
          >
            <Plus size={15} weight="bold" />
            <span>{t.videoAddAction}</span>
          </button>
          <button type="button" className="video-notebook-link" data-buddy-target="control:notebook" onClick={() => setView('notebook')}>
            <BookOpenText size={15} />
            <span>{t.videoNotebook}</span>
          </button>
        </div>
      </div>

      <section className="video-hero">
        <div className="video-hero-copy">
          <h2>{t.videosHeroTitle}</h2>
          <p>{t.videosHeroDesc}</p>
          <div className="video-hero-actions">
            <span><Play size={15} weight="fill" /> {t.videosHeroStat(videos.length)}</span>
            <span><CheckCircle size={15} weight="fill" /> {t.videosHeroDone(completedCount)}</span>
            <span><Trophy size={15} weight="fill" /> +{earnedXp} XP</span>
          </div>
        </div>
        <div className="video-hero-visual" aria-hidden="true">
          <svg className="video-hero-tv" viewBox="0 0 280 200" role="img" aria-label="">
            <path className="video-tv-line" d="M110 44L82 10M170 44L198 10M60 182L50 198M220 182L230 198" fill="none" />
            <circle className="video-tv-line" cx="82" cy="10" r="5" fill="#ff5a5f" />
            <circle className="video-tv-line" cx="198" cy="10" r="5" fill="#ff5a5f" />
            <rect className="video-tv-line" x="10" y="44" width="260" height="140" rx="22" fill="#ffd23f" />
            <rect className="video-tv-line" x="26" y="58" width="196" height="112" rx="12" fill="#14203a" />
            <circle className="video-tv-line" cx="124" cy="96" r="24" fill="#fff" />
            <path d="M117 83l20 13-20 13z" fill="#14203a" />
            <rect x="40" y="144" width="14" height="12" rx="4" fill="#19b6f0" />
            <rect x="62" y="135" width="14" height="21" rx="4" fill="#ffd23f" />
            <rect x="84" y="141" width="14" height="15" rx="4" fill="#ff5a5f" />
            <rect x="106" y="130" width="14" height="26" rx="4" fill="#38c98a" />
            <rect x="128" y="139" width="14" height="17" rx="4" fill="#19b6f0" />
            <rect x="150" y="133" width="14" height="23" rx="4" fill="#ffd23f" />
            <rect x="172" y="143" width="14" height="13" rx="4" fill="#ff5a5f" />
            <rect x="194" y="137" width="14" height="19" rx="4" fill="#38c98a" />
            <circle className="video-tv-line" cx="246" cy="86" r="9" fill="#ff5a5f" />
            <circle className="video-tv-line" cx="246" cy="114" r="9" fill="#38c98a" />
            <path className="video-tv-line" d="M236 140H256M236 148H256M236 156H256" fill="none" strokeWidth="3" />
          </svg>
        </div>
      </section>

      <dialog
        ref={importDialogRef}
        className="video-import-dialog"
        aria-labelledby="video-import-dialog-title"
        aria-busy={importing}
        onCancel={(event) => {
          if (importing) event.preventDefault()
        }}
        onClose={() => setImportOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget && !importing) setImportOpen(false)
        }}
      >
        <div className={`video-import-dialog-panel${importing ? ' is-analyzing' : ''}`}>
          <div className="video-import-dialog-head">
            <div className="video-import-dialog-copy">
              <span className="video-section-label"><YoutubeLogo size={16} weight="fill" /> {t.videoImportTitle}</span>
              <h2 id="video-import-dialog-title">{t.videoImportDialogTitle}</h2>
              <p className="video-import-desc">{t.videoImportDesc}</p>
            </div>
            <button
              type="button"
              className="video-import-dialog-close"
              onClick={() => setImportOpen(false)}
              disabled={importing}
              aria-label={t.close}
            >
              <X size={18} />
            </button>
          </div>

          <form className="video-import-dialog-form" onSubmit={(event) => void handleImport(event)}>
            {importing ? (
              <ol className="video-import-steps" role="status" aria-live="polite">
                <li className={`video-import-step${importStage === 'segment' ? ' is-done' : ' is-active'}`}>
                  <span className="video-import-step-dot" aria-hidden="true">
                    {importStage === 'segment' ? <Check size={11} weight="bold" /> : <span className="video-spinner is-tiny" />}
                  </span>
                  <span className="video-import-step-text">{t.videoImportStepExtract}</span>
                </li>
                <li className={`video-import-step${importStage === 'segment' ? ' is-active' : ''}`}>
                  <span className="video-import-step-dot" aria-hidden="true">
                    {importStage === 'segment' ? <span className="video-spinner is-tiny" /> : null}
                  </span>
                  <span className="video-import-step-text">{t.videoImportStepSegment}</span>
                </li>
              </ol>
            ) : (
              <label className="video-import-field is-dialog">
                <LinkSimple size={17} />
                <input
                  ref={importInputRef}
                  type="url"
                  value={importUrl}
                  onChange={(event) => setImportUrl(event.target.value)}
                  placeholder={t.videoImportPlaceholder}
                  aria-label={t.videoImportTitle}
                />
                {importUrl.trim() !== '' && (
                  <button
                    type="button"
                    className="video-import-field-clear"
                    onClick={() => {
                      setImportUrl('')
                      importInputRef.current?.focus()
                    }}
                    aria-label={t.videoImportClear}
                  >
                    <X size={15} />
                  </button>
                )}
              </label>
            )}

            {importError && <p className="video-import-error" role="alert">{importError}</p>}

            <div className="video-import-dialog-footer">
              <div className="video-import-dialog-actions">
                <button
                  type="button"
                  className="video-ghost-btn"
                  onClick={() => setImportOpen(false)}
                  disabled={importing}
                >
                  <span>{t.videoCancel}</span>
                </button>
                <button type="submit" className="video-primary-btn" disabled={importing || !importUrl.trim()}>
                  {importing ? <span className="video-spinner is-small" aria-hidden="true" /> : <Plus size={16} weight="bold" />}
                  <span>{importing ? t.videoImporting : t.videoImportAction}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </dialog>

      {notice && (
        <div className={`video-toast is-${notice.tone}`} role="status">
          <Sparkle size={16} weight="fill" />
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={t.close}>
            <X size={14} />
          </button>
        </div>
      )}

      {loading && (
        <div className="video-grid video-skeleton-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="video-card video-skeleton-card" key={index}>
              <div className="video-skeleton-thumb" />
              <div className="video-card-body">
                <div className="video-skeleton-chips">
                  <span className="video-skeleton-chip" />
                  <span className="video-skeleton-chip" />
                </div>
                <div className="video-skeleton-line video-skeleton-line-strong" />
                <div className="video-skeleton-line" />
                <div className="video-skeleton-line video-skeleton-line-short" />
                <div className="video-skeleton-footer">
                  <span className="video-skeleton-foot-l" />
                  <span className="video-skeleton-foot-r" />
                </div>
              </div>
            </div>
          ))}
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

      {!loading && !error && videos.length === 0 && (
        <div className="video-state-card">
          <p>{t.videoLibraryEmpty}</p>
        </div>
      )}

      {!loading && !error && videos.length > 0 && (
        <>
          <VideoCarousel
            title={t.videoSectionShared}
            description={t.videoSectionSharedDesc}
            countLabel={t.videoCount(sharedVideos.length)}
            items={visibleShared}
            getKey={(video) => video.id}
            renderItem={renderVideoCard}
            emptyText={t.videoSectionSharedEmpty}
            toolbar={
              <div className="video-filter-bar">
                <div className="video-filter-tabs" role="group" aria-label={t.videoFilterAria}>
                  <button
                    type="button"
                    className={levelFilter === 'all' ? 'is-active' : ''}
                    onClick={() => setLevelFilter('all')}
                  >
                    {t.videoFilterAll}
                  </button>
                  {levels.map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={levelFilter === level ? 'is-active' : ''}
                      onClick={() => setLevelFilter(level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <label className="video-search">
                  <MagnifyingGlass size={18} />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t.videoSearchPlaceholder}
                    aria-label={t.videoSearchAria}
                  />
                </label>
              </div>
            }
          />
          <VideoCarousel
            title={t.videoSectionOwned}
            description={t.videoSectionOwnedDesc}
            countLabel={t.videoCount(ownedVideos.length)}
            tone="sun"
            items={ownedVideos}
            getKey={(video) => video.id}
            renderItem={renderVideoCard}
            emptyText={t.videoSectionOwnedEmpty}
            trailing={
              <button
                type="button"
                className="video-add-card"
                onClick={() => { setImportError(null); setImportOpen(true) }}
                data-buddy-target="control:add-video"
              >
                <span className="video-add-card-icon"><Plus size={28} weight="bold" /></span>
                <strong>{t.videoAddCardTitle}</strong>
                <span className="video-add-card-desc">{t.videoAddCardDesc}</span>
              </button>
            }
          />
        </>
      )}
    </div>
  )
}