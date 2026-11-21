import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CheckCircle,
  PencilSimple,
  Plus,
  Sword,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import {
  createAdminBattleWordApi,
  deleteAdminBattleWordApi,
  listAdminBattleWordsApi,
  updateAdminBattleWordApi,
} from '../../services/adminService'
import type { AdminBattlePart, AdminBattleWord, BattleWordPayload, CefrLevel } from '../../types/admin'
import { BATTLE_PARTS_OF_SPEECH, CEFR_LEVELS } from '../../types/admin'
import { AdminDialog } from './AdminDialog'
import { AdminAsyncState } from './AdminAsyncState'

const PART_LABEL: Record<AdminBattlePart, string> = {
  noun: 'Danh từ',
  verb: 'Động từ',
  adjective: 'Tính từ',
  adverb: 'Trạng từ',
  pronoun: 'Đại từ',
  preposition: 'Giới từ',
  conjunction: 'Liên từ',
  interjection: 'Thán từ',
}

interface WordDraft {
  mode: 'create' | 'edit'
  id?: number
  wordEn: string
  translationVi: string
  partOfSpeech: AdminBattlePart
  cefrLevel: CefrLevel
  explanationVi: string
  exampleEn: string
  exampleVi: string
  imageUrl: string
}

const EMPTY_DRAFT: WordDraft = {
  mode: 'create',
  wordEn: '',
  translationVi: '',
  partOfSpeech: 'noun',
  cefrLevel: 'A2',
  explanationVi: '',
  exampleEn: '',
  exampleVi: '',
  imageUrl: '',
}

function draftFrom(word: AdminBattleWord): WordDraft {
  return {
    mode: 'edit',
    id: word.id,
    wordEn: word.word_en,
    translationVi: word.translation_vi,
    partOfSpeech: word.part_of_speech,
    cefrLevel: word.cefr_level,
    explanationVi: word.explanation_vi,
    exampleEn: word.example_en,
    exampleVi: word.example_vi,
    imageUrl: word.image_url ?? '',
  }
}

function payloadFrom(draft: WordDraft): BattleWordPayload {
  return {
    word_en: draft.wordEn.trim(),
    translation_vi: draft.translationVi.trim(),
    part_of_speech: draft.partOfSpeech,
    cefr_level: draft.cefrLevel,
    explanation_vi: draft.explanationVi.trim(),
    example_en: draft.exampleEn.trim(),
    example_vi: draft.exampleVi.trim(),
    image_url: draft.imageUrl.trim() || null,
  }
}

export function AdminArenaPanel() {
  const { t } = useI18n()
  const [words, setWords] = useState<AdminBattleWord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [draft, setDraft] = useState<WordDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listAdminBattleWordsApi()
      .then((loaded) => {
        if (cancelled) return
        setWords(loaded)
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

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return words
    return words.filter((word) =>
      [word.word_en, word.translation_vi, word.cefr_level, word.part_of_speech]
        .some((field) => field.toLowerCase().includes(query)),
    )
  }, [words, search])

  function reload() {
    setLoading(true)
    setReloadKey((key) => key + 1)
  }

  function openCreate() {
    setFormError(null)
    setDraft({ ...EMPTY_DRAFT })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    const payload = payloadFrom(draft)
    if (!payload.word_en || !payload.translation_vi || !payload.explanation_vi
      || !payload.example_en || !payload.example_vi) {
      setFormError('Vui lòng điền đầy đủ từ, nghĩa, giải thích và hai câu ví dụ.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (draft.mode === 'edit' && draft.id) {
        const updated = await updateAdminBattleWordApi(draft.id, payload)
        setWords((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
      } else {
        const created = await createAdminBattleWordApi(payload)
        setWords((current) => [...current, created])
      }
      setDraft(null)
      setNotice({ tone: 'ok', text: 'Đã lưu từ vựng đấu trường.' })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t.adminSaveError)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(word: AdminBattleWord) {
    if (!window.confirm(`Xóa từ "${word.word_en}" khỏi đấu trường?`)) return
    setBusyId(word.id)
    try {
      await deleteAdminBattleWordApi(word.id)
      setWords((current) => current.filter((entry) => entry.id !== word.id))
      setNotice({ tone: 'ok', text: `Đã xóa "${word.word_en}".` })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : t.adminSaveError })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="admin-panel" aria-labelledby="admin-arena-title">
      <div className="admin-toolbar">
        <div className="admin-toolbar-copy">
          <h2 id="admin-arena-title">Từ vựng đấu trường ({words.length})</h2>
          <p>Bộ từ dùng để sinh câu hỏi Word Battle, lấy trực tiếp từ cơ sở dữ liệu.</p>
        </div>
        <div className="admin-shop-toolbar-actions">
          <input
            type="search"
            className="admin-shop-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm từ, nghĩa, CEFR…"
            aria-label="Tìm từ vựng"
          />
          <button type="button" className="video-primary-btn" onClick={openCreate}>
            <Plus size={16} weight="bold" />
            <span>Thêm từ</span>
          </button>
        </div>
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

      <AdminAsyncState
        loading={loading}
        error={loadError}
        onRetry={reload}
        empty={!loading && !loadError && filtered.length === 0}
        emptyIcon={<Sword size={22} weight="fill" aria-hidden="true" />}
        emptyText="Chưa có từ vựng nào khớp."
        rows={6}
        thumb
      >

      
        <ul className="admin-list is-video">
          {filtered.map((word) => (
            <li className="admin-row" key={word.id}>
              <div className="admin-row-main">
                <strong>{word.word_en} <span className="admin-arena-translation">· {word.translation_vi}</span></strong>
                <div className="admin-row-meta">
                  <span className="admin-chip">{PART_LABEL[word.part_of_speech]}</span>
                  <span className="admin-chip">{word.cefr_level}</span>
                  <span className="admin-row-meta-text">{word.explanation_vi}</span>
                </div>
                <div className="admin-arena-example">
                  <span>{word.example_en}</span>
                  <small>{word.example_vi}</small>
                </div>
              </div>
              <div className="admin-row-actions">
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => {
                    setFormError(null)
                    setDraft(draftFrom(word))
                  }}
                  aria-label={t.adminEdit}
                  title={t.adminEdit}
                >
                  <PencilSimple size={16} />
                </button>
                <button
                  type="button"
                  className="admin-icon-btn is-danger"
                  onClick={() => void handleDelete(word)}
                  disabled={busyId === word.id}
                  aria-label={t.adminDelete}
                  title={t.adminDelete}
                >
                  <Trash size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </AdminAsyncState>

      <AdminDialog
        open={draft !== null}
        title={draft?.mode === 'edit' ? 'Sửa từ vựng' : 'Thêm từ vựng đấu trường'}
        description="Từ này sẽ xuất hiện trong các trận Word Battle."
        busy={saving}
        onClose={() => setDraft(null)}
        footer={(
          <div className="admin-dialog-actions">
            <button type="button" className="video-ghost-btn" onClick={() => setDraft(null)} disabled={saving}>
              <span>{t.cancel}</span>
            </button>
            <button type="submit" form="admin-arena-form" className="video-primary-btn" disabled={saving}>
              {saving ? <span className="video-spinner is-small" aria-hidden="true" /> : <Sword size={16} weight="fill" />}
              <span>{t.save}</span>
            </button>
          </div>
        )}
      >
        {draft && (
          <form id="admin-arena-form" className="admin-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="admin-section">
              <h4 className="admin-section-title">Từ và nghĩa</h4>
              <div className="admin-field-row">
                <label className="admin-field">
                  <span>Từ tiếng Anh</span>
                  <input
                    type="text"
                    data-autofocus
                    value={draft.wordEn}
                    maxLength={64}
                    onChange={(event) => setDraft({ ...draft, wordEn: event.target.value })}
                    disabled={saving}
                  />
                </label>
                <label className="admin-field">
                  <span>Nghĩa tiếng Việt</span>
                  <input
                    type="text"
                    value={draft.translationVi}
                    maxLength={160}
                    onChange={(event) => setDraft({ ...draft, translationVi: event.target.value })}
                    disabled={saving}
                  />
                </label>
              </div>
              <div className="admin-field-row">
                <label className="admin-field">
                  <span>Từ loại</span>
                  <select
                    value={draft.partOfSpeech}
                    onChange={(event) => setDraft({ ...draft, partOfSpeech: event.target.value as AdminBattlePart })}
                    disabled={saving}
                  >
                    {BATTLE_PARTS_OF_SPEECH.map((part) => <option key={part} value={part}>{PART_LABEL[part]}</option>)}
                  </select>
                </label>
                <label className="admin-field">
                  <span>CEFR</span>
                  <select
                    value={draft.cefrLevel}
                    onChange={(event) => setDraft({ ...draft, cefrLevel: event.target.value as CefrLevel })}
                    disabled={saving}
                  >
                    {CEFR_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                </label>
              </div>
              <label className="admin-field">
                <span>Giải thích (tiếng Việt)</span>
                <textarea
                  value={draft.explanationVi}
                  maxLength={500}
                  rows={2}
                  onChange={(event) => setDraft({ ...draft, explanationVi: event.target.value })}
                  disabled={saving}
                />
              </label>
            </div>

            <div className="admin-section">
              <h4 className="admin-section-title">Ví dụ</h4>
              <label className="admin-field">
                <span>Câu ví dụ tiếng Anh</span>
                <input
                  type="text"
                  value={draft.exampleEn}
                  maxLength={300}
                  onChange={(event) => setDraft({ ...draft, exampleEn: event.target.value })}
                  disabled={saving}
                />
              </label>
              <label className="admin-field">
                <span>Câu ví dụ tiếng Việt</span>
                <input
                  type="text"
                  value={draft.exampleVi}
                  maxLength={300}
                  onChange={(event) => setDraft({ ...draft, exampleVi: event.target.value })}
                  disabled={saving}
                />
              </label>
              <label className="admin-field">
                <span>Ảnh minh họa (URL, không bắt buộc)</span>
                <input
                  type="url"
                  value={draft.imageUrl}
                  maxLength={500}
                  onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })}
                  disabled={saving}
                />
              </label>
            </div>

            {formError && <p className="video-import-error" role="alert">{formError}</p>}
          </form>
        )}
      </AdminDialog>
    </section>
  )
}
