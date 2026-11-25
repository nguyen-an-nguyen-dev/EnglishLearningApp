import { useEffect, useMemo, useState } from 'react'
import { Play, Plus, Trash } from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import {
  listAdminVideoSegmentsApi,
  saveAdminVideoSegmentsApi,
  setAdminVideoPublishedApi,
} from '../../services/adminService'
import type {
  AdminSharedVideo,
  AdminVideoSegment,
  AdminVideoSegmentPayload,
  AdminVideoSegmentsResult,
} from '../../types/admin'
import { formatClock, youtubeVideoId } from '../../utils/videoPlayback'
import { AdminDialog } from './AdminDialog'
import { AdminSkeleton } from './AdminSkeleton'

type Strings = ReturnType<typeof useI18n>['t']

/** Mirrors the server rules in admin.validation.ts so obvious mistakes show before saving. */
const MAX_SEGMENT_MS = 12_000
const MAX_SEGMENT_TEXT = 300
const NEW_LINE_MS = 2_000

/** One editable line. Times stay as text while typing and are parsed on validation. */
interface DraftRow {
  key: number
  start: string
  end: string
  text: string
}

let rowKeySeq = 0

function msToSeconds(ms: number): string {
  return String(Math.round(ms / 10) / 100)
}

function secondsToMs(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const seconds = Number(trimmed.replace(',', '.'))
  if (!Number.isFinite(seconds) || seconds < 0) return null
  return Math.round(seconds * 1000)
}

function toDraft(segments: AdminVideoSegment[]): DraftRow[] {
  return segments.map((segment) => ({
    key: ++rowKeySeq,
    start: msToSeconds(segment.start_ms),
    end: msToSeconds(segment.end_ms),
    text: segment.text_en,
  }))
}

function snapshotOf(rows: DraftRow[]): string {
  return JSON.stringify(rows.map((row) => [row.start, row.end, row.text]))
}

function validateRows(
  rows: DraftRow[],
  durationSeconds: number,
  t: Strings,
): { errors: Record<number, string>; payload: AdminVideoSegmentPayload[] | null } {
  const errors: Record<number, string> = {}
  const payload: AdminVideoSegmentPayload[] = []
  const durationMs = durationSeconds > 0 ? durationSeconds * 1000 : null
  let previousEnd = 0

  rows.forEach((row, index) => {
    const line = index + 1
    const startMs = secondsToMs(row.start)
    const endMs = secondsToMs(row.end)
    const text = row.text.trim()
    let reason: string | null = null

    if (startMs === null || endMs === null || endMs <= startMs) {
      reason = t.adminVideoErrTime
    } else if (endMs - startMs > MAX_SEGMENT_MS) {
      reason = t.adminVideoErrLength(MAX_SEGMENT_MS / 1000)
    } else if (startMs < previousEnd) {
      reason = t.adminVideoErrOverlap
    } else if (durationMs !== null && endMs > durationMs + 1000) {
      reason = t.adminVideoErrPastEnd
    } else if (!text || text.length > MAX_SEGMENT_TEXT) {
      reason = t.adminVideoErrText(MAX_SEGMENT_TEXT)
    }

    if (startMs !== null && endMs !== null) previousEnd = endMs
    if (reason) {
      errors[row.key] = t.adminVideoLineError(line, reason)
    } else if (startMs !== null && endMs !== null) {
      payload.push({ start_ms: startMs, end_ms: endMs, text_en: text })
    }
  })

  const valid = Object.keys(errors).length === 0 && rows.length > 0
  return { errors, payload: valid ? payload : null }
}

interface AdminVideoReviewDialogProps {
  video: AdminSharedVideo
  onClose: () => void
  onUpdated: (video: AdminSharedVideo, message: string) => void
}

/** Reviews a video's AI-generated lines: play, edit, add or remove lines, then save and publish. */
export function AdminVideoReviewDialog({ video: initialVideo, onClose, onUpdated }: AdminVideoReviewDialogProps) {
  const { t } = useI18n()
  const [video, setVideo] = useState(initialVideo)
  const [rows, setRows] = useState<DraftRow[]>([])
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState<'save' | 'publish' | 'unpublish' | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [player, setPlayer] = useState<{ start: number; autoplay: boolean }>({ start: 0, autoplay: false })

  const videoId = initialVideo.id

  useEffect(() => {
    let cancelled = false
    listAdminVideoSegmentsApi(videoId)
      .then((result) => {
        if (cancelled) return
        applyResult(result)
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : t.adminLoadError)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // Parent keys this dialog by video id, so the effect runs once per video.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  function applyResult(result: AdminVideoSegmentsResult) {
    const draft = toDraft(result.segments)
    setVideo(result.video)
    setRows(draft)
    setSavedSnapshot(snapshotOf(draft))
  }

  const { errors, payload } = useMemo(
    () => validateRows(rows, video.duration_seconds, t),
    [rows, video.duration_seconds, t],
  )

  const isDraft = video.published_at === null
  const dirty = savedSnapshot !== null && snapshotOf(rows) !== savedSnapshot
  const busy = pending !== null
  const canSave = !loading && !busy && dirty && payload !== null
  const canPublish = isDraft && !loading && !busy && !dirty && payload !== null

  const handleClose = () => {
    if (dirty && !window.confirm(t.adminVideoDiscardConfirm)) return
    onClose()
  }
  const youtubeId = youtubeVideoId(video.video_url)
  const playerSrc = youtubeId
    ? `https://www.youtube-nocookie.com/embed/${youtubeId}?start=${player.start}&rel=0&modestbranding=1${player.autoplay ? '&autoplay=1' : ''}`
    : null

  function updateRow(key: number, patch: Partial<Omit<DraftRow, 'key'>>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key))
  }

  function addRow() {
    setRows((current) => {
      const last = current[current.length - 1]
      const startMs = (last && secondsToMs(last.end)) ?? 0
      return [
        ...current,
        {
          key: ++rowKeySeq,
          start: msToSeconds(startMs),
          end: msToSeconds(startMs + NEW_LINE_MS),
          text: '',
        },
      ]
    })
  }

  function playLine(row: DraftRow) {
    const startMs = secondsToMs(row.start)
    if (startMs === null) return
    setPlayer({ start: Math.floor(startMs / 1000), autoplay: true })
  }

  async function handleSave() {
    if (!canSave || !payload) return
    setPending('save')
    setFormError(null)
    try {
      const result = await saveAdminVideoSegmentsApi(video.id, payload)
      applyResult(result)
      onUpdated(result.video, t.adminVideoSegmentsSaved)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t.adminSaveError)
    } finally {
      setPending(null)
    }
  }

  async function handlePublish() {
    if (!canPublish) return
    setPending('publish')
    setFormError(null)
    try {
      const updated = await setAdminVideoPublishedApi(video.id, true)
      onUpdated(updated, t.adminVideoPublished(updated.title))
      onClose()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t.adminSaveError)
      setPending(null)
    }
  }

  async function handleUnpublish() {
    if (busy || !window.confirm(t.adminVideoUnpublishConfirm(video.title))) return
    setPending('unpublish')
    setFormError(null)
    try {
      const updated = await setAdminVideoPublishedApi(video.id, false)
      setVideo(updated)
      onUpdated(updated, t.adminVideoUnpublished(updated.title))
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t.adminSaveError)
    } finally {
      setPending(null)
    }
  }

  const footer = (
    <>
      <span className={`admin-review-status${dirty ? ' is-dirty' : ''}`} role="status">
        {dirty ? t.adminVideoSegmentDirty : t.adminVideoSegments(rows.length)}
      </span>
      <button type="button" className="video-ghost-btn" onClick={() => void handleSave()} disabled={!canSave}>
        {pending === 'save' ? t.saving : t.adminVideoSaveLines}
      </button>
      {isDraft ? (
        <button
          type="button"
          className="video-primary-btn"
          onClick={() => void handlePublish()}
          disabled={!canPublish}
          title={dirty ? t.adminVideoSaveFirst : undefined}
        >
          {pending === 'publish' ? t.saving : t.adminVideoPublish}
        </button>
      ) : (
        <button type="button" className="video-ghost-btn" onClick={() => void handleUnpublish()} disabled={busy}>
          {pending === 'unpublish' ? t.saving : t.adminVideoUnpublish}
        </button>
      )}
    </>
  )

  return (
    <AdminDialog
      open
      title={t.adminVideoReviewTitle}
      scope={`${video.title} · ${video.cefr_level} · ${formatClock(video.duration_seconds)}`}
      busy={busy}
      onClose={handleClose}
      footer={footer}
      className="is-wide"
    >
      <div className="admin-form">
        <p className={`admin-review-note${isDraft ? '' : ' is-live'}`}>
          {isDraft ? t.adminVideoReviewDraftNote : t.adminVideoReviewPublishedNote}
        </p>

        {playerSrc ? (
          <iframe
            key={`${player.start}-${player.autoplay}`}
            className="admin-review-player"
            src={playerSrc}
            title={t.adminVideoPlayerTitle}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="admin-review-empty">{t.adminVideoNoPreview}</div>
        )}

        {loading && <AdminSkeleton rows={3} />}

        {!loading && loadError && (
          <div className="video-state-card">
            <p>{loadError}</p>
          </div>
        )}

        {!loading && !loadError && (
          <>
            {rows.length === 0 ? (
              <p className="admin-empty-hint">{t.adminVideoSegmentsEmpty}</p>
            ) : (
              <div className="admin-seg-list">
                <div className="admin-seg-head" aria-hidden="true">
                  <span />
                  <span>{t.adminVideoSegmentStart}</span>
                  <span>{t.adminVideoSegmentEnd}</span>
                  <span>{t.adminVideoSegmentText}</span>
                  <span />
                </div>
                {rows.map((row, index) => {
                  const error = errors[row.key]
                  const label = index + 1
                  return (
                    <div className={`admin-seg-row${error ? ' is-invalid' : ''}`} key={row.key}>
                      <span className="admin-seg-index">{label}</span>
                      <input
                        className="admin-seg-input"
                        inputMode="decimal"
                        aria-label={`${t.adminVideoSegmentStart} ${label}`}
                        aria-invalid={error ? true : undefined}
                        value={row.start}
                        onChange={(event) => updateRow(row.key, { start: event.target.value })}
                        disabled={busy}
                      />
                      <input
                        className="admin-seg-input"
                        inputMode="decimal"
                        aria-label={`${t.adminVideoSegmentEnd} ${label}`}
                        aria-invalid={error ? true : undefined}
                        value={row.end}
                        onChange={(event) => updateRow(row.key, { end: event.target.value })}
                        disabled={busy}
                      />
                      <div className="admin-seg-text">
                        <textarea
                          className="admin-seg-input"
                          rows={1}
                          aria-label={`${t.adminVideoSegmentText} ${label}`}
                          aria-invalid={error ? true : undefined}
                          value={row.text}
                          onChange={(event) => updateRow(row.key, { text: event.target.value })}
                          disabled={busy}
                        />
                      </div>
                      <div className="admin-seg-tools">
                        <button
                          type="button"
                          className="admin-icon-btn"
                          onClick={() => playLine(row)}
                          aria-label={t.adminVideoSegmentPlay}
                          title={t.adminVideoSegmentPlay}
                          disabled={busy}
                        >
                          <Play size={14} weight="fill" />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn is-danger"
                          onClick={() => removeRow(row.key)}
                          aria-label={t.adminVideoSegmentRemove}
                          title={t.adminVideoSegmentRemove}
                          disabled={busy}
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                      {error && <p className="admin-seg-error">{error}</p>}
                    </div>
                  )
                })}
              </div>
            )}
            <div>
              <button type="button" className="admin-link-btn" onClick={addRow} disabled={busy}>
                <Plus size={14} weight="bold" />
                <span>{t.adminVideoSegmentAdd}</span>
              </button>
            </div>
          </>
        )}

        {formError && (
          <p className="video-import-error" role="alert">
            {formError}
          </p>
        )}
      </div>
    </AdminDialog>
  )
}
