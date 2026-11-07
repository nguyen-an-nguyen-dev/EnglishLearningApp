import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowClockwise,
  CaretDown,
  CaretUp,
  CheckCircle,
  LinkSimple,
  PencilSimple,
  Plus,
  Sparkle,
  Trash,
  VideoCamera,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import {
  deleteAdminVideoApi,
  importAdminVideoApi,
  listAdminVideosApi,
  moveAdminVideoApi,
  updateAdminVideoApi,
} from '../../services/adminService'
import type { AdminSharedVideo, CefrLevel, VideoAnalysisModel } from '../../types/admin'
import { CEFR_LEVELS } from '../../types/admin'
import { videoImportErrorMessage } from '../../utils/videoImportErrors'
import { formatClock, youtubeThumbnailUrl } from '../../utils/videoPlayback'
import { AdminDialog } from './AdminDialog'
import { AdminSkeleton } from './AdminSkeleton'

interface EditDraft {
  title: string
  topic: string
  description: string
  cefrLevel: CefrLevel
  xpReward: string
}

function draftFrom(video: AdminSharedVideo): EditDraft {
  return {
    title: video.title,
    topic: video.topic,
    description: video.description ?? '',
    cefrLevel: (CEFR_LEVELS as readonly string[]).includes(video.cefr_level)
      ? video.cefr_level as CefrLevel
      : 'B1',
    xpReward: String(video.xp_reward),
  }
}

export function AdminVideoPanel() {
  const { t } = useI18n()
  const [videos, setVideos] = useState<AdminSharedVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [analysisModel, setAnalysisModel] = useState<VideoAnalysisModel>('bolt')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const [editing, setEditing] = useState<AdminSharedVideo | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listAdminVideosApi()
      .then((loaded) => {
        if (cancelled) return
        setVideos(loaded)
        setLoading(false)
        setLoadError(null)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : t.adminLoadError)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [reloadKey, t.adminLoadError])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5_000)
    return () => window.clearTimeout(timer)
  }, [notice])

  function reload() {
    setLoading(true)
    setReloadKey((key) => key + 1)
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const url = importUrl.trim()
    if (!url || importing) return
    setImporting(true)
    setImportError(null)
    try {
      const video = await importAdminVideoApi(url, analysisModel)
      setImportUrl('')
      setImportOpen(false)
      setNotice({ tone: 'ok', text: t.adminVideoAdded(video.title) })
      reload()
    } catch (error) {
      setImportError(videoImportErrorMessage(error, t))
    } finally {
      setImporting(false)
    }
  }

  function openEdit(video: AdminSharedVideo) {
    setEditing(video)
    setEditDraft(draftFrom(video))
    setEditError(null)
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || !editDraft) return
    const title = editDraft.title.trim()
    const topic = editDraft.topic.trim()
    if (!title || !topic) {
      setEditError(t.adminRequired)
      return
    }
    const xpReward = Number(editDraft.xpReward)
    if (!Number.isInteger(xpReward) || xpReward < 0 || xpReward > 100) {
      setEditError(t.adminVideoXpLabel)
      return
    }

    setSavingEdit(true)
    setEditError(null)
    try {
      const updated = await updateAdminVideoApi(editing.id, {
        title,
        topic,
        description: editDraft.description.trim(),
        cefr_level: editDraft.cefrLevel,
        xp_reward: xpReward,
      })
      setVideos((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
      setEditing(null)
      setEditDraft(null)
      setNotice({ tone: 'ok', text: t.adminVideoSaved })
    } catch (error) {
      setEditError(error instanceof Error ? error.message : t.adminSaveError)
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDelete(video: AdminSharedVideo) {
    if (!window.confirm(t.adminVideoDeleteConfirm(video.title))) return
    setBusyId(video.id)
    try {
      await deleteAdminVideoApi(video.id)
      setVideos((current) => current.filter((entry) => entry.id !== video.id))
      setNotice({ tone: 'ok', text: t.adminVideoDeleted(video.title) })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : t.adminSaveError })
    } finally {
      setBusyId(null)
    }
  }

  async function handleMove(video: AdminSharedVideo, direction: 'up' | 'down') {
    setBusyId(video.id)
    try {
      await moveAdminVideoApi(video.id, direction)
      reload()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : t.adminSaveError })
    } finally {
      setBusyId(null)
    }
  }

  const analysisModels: Array<{ id: VideoAnalysisModel; label: string; hint: string }> = [
    { id: 'bolt', label: t.videoModelBolt, hint: t.videoModelBoltHint },
    { id: 'gemini', label: t.videoModelGemini, hint: t.videoModelGeminiHint },
  ]

  return (
    <section className="admin-panel" aria-labelledby="admin-videos-title">
      <div className="admin-toolbar">
        <div className="admin-toolbar-copy">
          <h2 id="admin-videos-title">{t.adminSharedCount(videos.length)}</h2>
        </div>
        <button
          type="button"
          className="video-primary-btn"
          onClick={() => {
            setImportError(null)
            setImportOpen(true)
          }}
        >
          <Plus size={16} weight="bold" />
          <span>{t.adminAddVideo}</span>
        </button>
      </div>

      {notice && (
        <div className={`video-toast is-${notice.tone}`} role="status">
          {notice.tone === 'ok' ? <CheckCircle size={16} weight="fill" /> : <WarningCircle size={16} weight="fill" />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={t.close}>
            <X size={14} />
          </button>
        </div>
      )}

      {loading && <AdminSkeleton rows={4} thumb />}

      {!loading && loadError && (
        <div className="video-state-card">
          <p>{loadError}</p>
          <button type="button" className="video-ghost-btn" onClick={reload}>
            <ArrowClockwise size={16} />
            <span>{t.retry}</span>
          </button>
        </div>
      )}

      {!loading && !loadError && videos.length === 0 && (
        <div className="admin-empty">
          <VideoCamera size={22} weight="fill" aria-hidden="true" />
          <p className="admin-empty-hint">{t.adminVideoEmpty}</p>
          <button
            type="button"
            className="admin-link-btn"
            onClick={() => {
              setImportError(null)
              setImportOpen(true)
            }}
          >
            <Plus size={14} weight="bold" />
            <span>{t.adminAddVideo}</span>
          </button>
        </div>
      )}

      {!loading && !loadError && videos.length > 0 && (
        <ul className="admin-list is-video">
          {videos.map((video, index) => {
            const thumb = video.thumbnail_url ?? youtubeThumbnailUrl(video.video_url)
            return (
              <li className="admin-row" key={video.id}>
                <span className="admin-row-thumb">
                  {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className="admin-row-thumb-fallback" />}
                </span>
                <div className="admin-row-main">
                  <strong>{video.title}</strong>
                  <div className="admin-row-meta">
                    <span className="admin-chip">{video.cefr_level}</span>
                    <span className="admin-chip">{video.topic}</span>
                    <span className="admin-row-meta-text">
                      {formatClock(video.duration_seconds)}
                      {' · '}
                      {t.adminVideoSegments(video.segment_count)}
                    </span>
                    <span className="admin-chip is-xp">+{video.xp_reward} XP</span>
                  </div>
                </div>
                <div className="admin-row-actions">
                  <button
                    type="button"
                    className="admin-icon-btn"
                    onClick={() => void handleMove(video, 'up')}
                    disabled={busyId === video.id || index === 0}
                    aria-label={t.adminMoveUp}
                    title={t.adminMoveUp}
                  >
                    <CaretUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="admin-icon-btn"
                    onClick={() => void handleMove(video, 'down')}
                    disabled={busyId === video.id || index === videos.length - 1}
                    aria-label={t.adminMoveDown}
                    title={t.adminMoveDown}
                  >
                    <CaretDown size={16} />
                  </button>
                  <button
                    type="button"
                    className="admin-icon-btn"
                    onClick={() => openEdit(video)}
                    aria-label={t.adminEdit}
                    title={t.adminEdit}
                  >
                    <PencilSimple size={16} />
                  </button>
                  <button
                    type="button"
                    className="admin-icon-btn is-danger"
                    onClick={() => void handleDelete(video)}
                    disabled={busyId === video.id}
                    aria-label={t.adminDelete}
                    title={t.adminDelete}
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <AdminDialog
        open={importOpen}
        title={t.adminVideoDialogTitle}
        description={t.adminVideoDialogDesc}
        busy={importing}
        onClose={() => setImportOpen(false)}
        footer={(
          <div className="admin-dialog-actions">
            <button type="button" className="video-ghost-btn" onClick={() => setImportOpen(false)} disabled={importing}>
              <span>{t.cancel}</span>
            </button>
            <button
              type="submit"
              form="admin-video-import-form"
              className="video-primary-btn"
              disabled={importing || !importUrl.trim()}
            >
              {importing ? <span className="video-spinner is-small" aria-hidden="true" /> : <Plus size={16} weight="bold" />}
              <span>{importing ? t.adminVideoImporting : t.adminVideoImportAction}</span>
            </button>
          </div>
        )}
      >
        <form id="admin-video-import-form" className="admin-form" onSubmit={(event) => void handleImport(event)}>
          <label className="admin-field">
            <span>{t.videoImportTitle}</span>
            <span className="admin-input">
              <LinkSimple size={16} />
              <input
                type="url"
                data-autofocus
                value={importUrl}
                onChange={(event) => setImportUrl(event.target.value)}
                placeholder={t.videoImportPlaceholder}
                disabled={importing}
              />
            </span>
          </label>

          <div className="admin-field">
            <span>{t.videoModelLabel}</span>
            <div className="video-model-switch" role="radiogroup" aria-label={t.videoModelLabel}>
              {analysisModels.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  role="radio"
                  aria-checked={analysisModel === model.id}
                  className={`video-model-option${analysisModel === model.id ? ' is-active' : ''}`}
                  onClick={() => setAnalysisModel(model.id)}
                  disabled={importing}
                >
                  <span className="video-model-radio" aria-hidden="true" />
                  <span className="video-model-copy">
                    <strong>{model.label}</strong>
                    <small>{model.hint}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {importing && (
            <div className="video-import-status" role="status" aria-live="polite">
              <span className="video-spinner" aria-hidden="true" />
              <div className="video-import-status-copy">
                <strong>{t.videoAnalyzing}</strong>
                <small>{t.videoAnalyzingHint(analysisModel === 'gemini' ? t.videoModelGemini : t.videoModelBolt)}</small>
              </div>
            </div>
          )}

          {importError && <p className="video-import-error" role="alert">{importError}</p>}
        </form>
      </AdminDialog>

      <AdminDialog
        open={editing !== null && editDraft !== null}
        title={t.adminVideoEdit}
        busy={savingEdit}
        onClose={() => {
          setEditing(null)
          setEditDraft(null)
        }}
        footer={(
          <div className="admin-dialog-actions">
            <button
              type="button"
              className="video-ghost-btn"
              onClick={() => {
                setEditing(null)
                setEditDraft(null)
              }}
              disabled={savingEdit}
            >
              <span>{t.cancel}</span>
            </button>
            <button type="submit" form="admin-video-edit-form" className="video-primary-btn" disabled={savingEdit}>
              {savingEdit ? <span className="video-spinner is-small" aria-hidden="true" /> : <Sparkle size={16} weight="fill" />}
              <span>{t.save}</span>
            </button>
          </div>
        )}
      >
        {editDraft && (
          <form id="admin-video-edit-form" className="admin-form" onSubmit={(event) => void handleSaveEdit(event)}>
            <div className="admin-section">
              <h4 className="admin-section-title">{t.adminSectionInfo}</h4>
              <label className="admin-field">
                <span>{t.adminVideoTitleLabel}</span>
                <input
                  type="text"
                  data-autofocus
                  value={editDraft.title}
                  maxLength={160}
                  onChange={(event) => setEditDraft({ ...editDraft, title: event.target.value })}
                  disabled={savingEdit}
                />
              </label>
              <label className="admin-field">
                <span>{t.adminVideoTopicLabel}</span>
                <input
                  type="text"
                  value={editDraft.topic}
                  maxLength={100}
                  onChange={(event) => setEditDraft({ ...editDraft, topic: event.target.value })}
                  disabled={savingEdit}
                />
              </label>
              <label className="admin-field">
                <span>{t.adminVideoDescLabel}</span>
                <textarea
                  value={editDraft.description}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })}
                  disabled={savingEdit}
                />
              </label>
            </div>
            <div className="admin-section">
              <h4 className="admin-section-title">{t.adminSectionVideoMeta}</h4>
              <div className="admin-field-row">
                <label className="admin-field">
                  <span>{t.adminVideoLevelLabel}</span>
                  <select
                    value={editDraft.cefrLevel}
                    onChange={(event) => setEditDraft({ ...editDraft, cefrLevel: event.target.value as CefrLevel })}
                    disabled={savingEdit}
                  >
                    {CEFR_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                </label>
                <label className="admin-field">
                  <span>{t.adminVideoXpLabel}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editDraft.xpReward}
                    onChange={(event) => setEditDraft({ ...editDraft, xpReward: event.target.value })}
                    disabled={savingEdit}
                  />
                </label>
              </div>
            </div>
            {editError && <p className="video-import-error" role="alert">{editError}</p>}
          </form>
        )}
      </AdminDialog>
    </section>
  )
}
