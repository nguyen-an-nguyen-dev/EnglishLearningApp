import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpenText, CheckCircle, PencilSimple, Plus, Trash, WarningCircle, X } from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import {
  createAdminVideoVocabularyApi,
  deleteAdminVideoVocabularyApi,
  listAdminVideoVocabularyApi,
  updateAdminVideoVocabularyApi,
} from '../../services/adminService'
import type { AdminSharedVideo, AdminVideoVocabulary } from '../../types/admin'
import { AdminDialog } from './AdminDialog'

interface VocabDraft {
  id?: number
  word: string
  ipa: string
  meaningVi: string
  detailVi: string
}

const EMPTY: VocabDraft = { word: '', ipa: '', meaningVi: '', detailVi: '' }

export function AdminVideoVocabularyDialog({
  video,
  onClose,
}: {
  video: AdminSharedVideo | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const [entries, setEntries] = useState<AdminVideoVocabulary[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState<VocabDraft>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!video) return
    let cancelled = false
    listAdminVideoVocabularyApi(video.id)
      .then((loaded) => {
        if (cancelled) return
        setEntries(loaded)
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : t.adminLoadError)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [video, t.adminLoadError])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!video) return
    if (!draft.word.trim() || !draft.meaningVi.trim() || !draft.detailVi.trim()) {
      setNotice({ tone: 'error', text: 'Từ, nghĩa và giải thích là bắt buộc.' })
      return
    }
    setSaving(true)
    setNotice(null)
    try {
      if (draft.id) {
        const updated = await updateAdminVideoVocabularyApi(draft.id, {
          word: draft.word.trim(),
          ipa: draft.ipa.trim(),
          meaning_vi: draft.meaningVi.trim(),
          detail_vi: draft.detailVi.trim(),
        })
        setEntries((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
      } else {
        const created = await createAdminVideoVocabularyApi(video.id, {
          word: draft.word.trim(),
          ipa: draft.ipa.trim(),
          meaning_vi: draft.meaningVi.trim(),
          detail_vi: draft.detailVi.trim(),
        })
        setEntries((current) => [...current, created])
      }
      setDraft(EMPTY)
      setNotice({ tone: 'ok', text: 'Đã lưu từ vựng cho video.' })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : t.adminSaveError })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(entry: AdminVideoVocabulary) {
    if (!window.confirm(`Xóa từ "${entry.word}" khỏi video?`)) return
    setBusyId(entry.id)
    try {
      await deleteAdminVideoVocabularyApi(entry.id)
      setEntries((current) => current.filter((row) => row.id !== entry.id))
      setNotice({ tone: 'ok', text: 'Đã xóa từ vựng.' })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : t.adminSaveError })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminDialog
      open={video !== null}
      title="Từ vựng của video"
      description={video ? `${video.title} · ${video.cefr_level}` : undefined}
      busy={saving}
      onClose={onClose}
      footer={(
        <div className="admin-dialog-actions">
          <button type="button" className="video-ghost-btn" onClick={onClose} disabled={saving}>
            <span>{t.close}</span>
          </button>
        </div>
      )}
    >
      <div className="admin-vocab-layout">
        <form className="admin-form admin-vocab-form" onSubmit={(event) => void handleSubmit(event)}>
          <h4 className="admin-section-title">
            <BookOpenText size={15} weight="bold" />
            {draft.id ? 'Sửa từ' : 'Thêm từ mới'}
          </h4>
          <div className="admin-field-row">
            <label className="admin-field">
              <span>Từ</span>
              <input
                type="text"
                data-autofocus
                value={draft.word}
                maxLength={80}
                onChange={(event) => setDraft({ ...draft, word: event.target.value })}
                disabled={saving}
              />
            </label>
            <label className="admin-field">
              <span>Phiên âm</span>
              <input
                type="text"
                value={draft.ipa}
                maxLength={80}
                placeholder="/ˈwɜːrd/"
                onChange={(event) => setDraft({ ...draft, ipa: event.target.value })}
                disabled={saving}
              />
            </label>
          </div>
          <label className="admin-field">
            <span>Nghĩa tiếng Việt</span>
            <input
              type="text"
              value={draft.meaningVi}
              maxLength={160}
              onChange={(event) => setDraft({ ...draft, meaningVi: event.target.value })}
              disabled={saving}
            />
          </label>
          <label className="admin-field">
            <span>Giải thích / ví dụ</span>
            <textarea
              value={draft.detailVi}
              maxLength={500}
              rows={3}
              onChange={(event) => setDraft({ ...draft, detailVi: event.target.value })}
              disabled={saving}
            />
          </label>
          {notice && (
            <p className={`account-note is-${notice.tone}`} role="status">
              {notice.tone === 'ok' ? <CheckCircle size={14} weight="fill" /> : <WarningCircle size={14} weight="fill" />}
              <span>{notice.text}</span>
            </p>
          )}
          <div className="admin-dialog-actions">
            {draft.id && (
              <button type="button" className="video-ghost-btn" onClick={() => setDraft(EMPTY)} disabled={saving}>
                <X size={14} />
                <span>Hủy sửa</span>
              </button>
            )}
            <button type="submit" className="video-primary-btn" disabled={saving}>
              {saving ? <span className="video-spinner is-small" aria-hidden="true" /> : <Plus size={15} weight="bold" />}
              <span>{draft.id ? t.save : 'Thêm từ'}</span>
            </button>
          </div>
        </form>

        <div className="admin-vocab-list-wrap">
          <h4 className="admin-section-title">Danh sách ({entries.length})</h4>
          {loading && <p className="admin-field-hint">Đang tải…</p>}
          {!loading && loadError && <p className="video-import-error" role="alert">{loadError}</p>}
          {!loading && !loadError && entries.length === 0 && (
            <p className="admin-field-hint">Video này chưa có từ vựng. Thêm từ đầu tiên ở bên trái.</p>
          )}
          {!loading && !loadError && entries.length > 0 && (
            <ul className="admin-vocab-list">
              {entries.map((entry) => (
                <li key={entry.id} className={draft.id === entry.id ? 'is-editing' : ''}>
                  <div>
                    <strong>{entry.word}</strong>
                    {entry.ipa && <small>{entry.ipa}</small>}
                    <p>{entry.meaning_vi}</p>
                  </div>
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      className="admin-icon-btn"
                      onClick={() => setDraft({
                        id: entry.id,
                        word: entry.word,
                        ipa: entry.ipa,
                        meaningVi: entry.meaning_vi,
                        detailVi: entry.detail_vi,
                      })}
                      aria-label={t.adminEdit}
                      title={t.adminEdit}
                    >
                      <PencilSimple size={15} />
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn is-danger"
                      onClick={() => void handleDelete(entry)}
                      disabled={busyId === entry.id}
                      aria-label={t.adminDelete}
                      title={t.adminDelete}
                    >
                      <Trash size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminDialog>
  )
}
