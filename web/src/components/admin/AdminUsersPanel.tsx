import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowClockwise,
  CheckCircle,
  PencilSimple,
  UsersThree,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import { listAdminUsersApi, updateAdminUserApi } from '../../services/adminService'
import type { AdminManagedRole, AdminManagedUser, AdminUserPatchPayload } from '../../types/admin'
import { formatCompact } from '../../utils/format'
import { AdminDialog } from './AdminDialog'
import { AdminAsyncState } from './AdminAsyncState'

const ROLE_LABEL: Record<AdminManagedRole, string> = {
  learner: 'Học viên',
  admin: 'Quản trị viên',
}

interface UserDraft {
  id: number
  name: string
  email: string
  role: AdminManagedRole
  xp: string
  coins: string
  streak: string
  racePoints: string
}

function draftFrom(user: AdminManagedUser): UserDraft {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    xp: String(user.xp),
    coins: String(user.coins),
    streak: String(user.streak),
    racePoints: String(user.race_points),
  }
}

function formatDate(value: string | null): string {
  if (!value) return 'Chưa hoạt động'
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function AdminUsersPanel() {
  const { t } = useI18n()
  const [users, setUsers] = useState<AdminManagedUser[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<'' | AdminManagedRole>('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [draft, setDraft] = useState<UserDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listAdminUsersApi({ search: search.trim(), role, limit: 100 })
      .then((result) => {
        if (cancelled) return
        setUsers(result.users)
        setTotal(result.total)
        setLoading(false)
        setLoadError(null)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : t.adminLoadError)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [search, role, reloadKey, t.adminLoadError])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5_000)
    return () => window.clearTimeout(timer)
  }, [notice])

  function reload() {
    setLoading(true)
    setReloadKey((key) => key + 1)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    const values = {
      xp: Number(draft.xp),
      coins: Number(draft.coins),
      streak: Number(draft.streak),
      racePoints: Number(draft.racePoints),
    }
    if (!Number.isInteger(values.xp) || values.xp < 0
      || !Number.isInteger(values.coins) || values.coins < 0
      || !Number.isInteger(values.streak) || values.streak < 0
      || !Number.isInteger(values.racePoints) || values.racePoints < 0) {
      setFormError('XP, RC, chuỗi và điểm đua phải là số nguyên không âm.')
      return
    }

    const payload: AdminUserPatchPayload = {
      xp: values.xp,
      coins: values.coins,
      streak: values.streak,
      race_points: values.racePoints,
      role: draft.role,
    }
    setSaving(true)
    setFormError(null)
    try {
      const updated = await updateAdminUserApi(draft.id, payload)
      setUsers((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
      setDraft(null)
      setNotice({ tone: 'ok', text: `Đã cập nhật ${updated.name}.` })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t.adminSaveError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="admin-panel" aria-labelledby="admin-users-title">
      <div className="admin-toolbar">
        <div className="admin-toolbar-copy">
          <h2 id="admin-users-title">Tài khoản người dùng ({total})</h2>
          <p>Chỉ quản lý tiến độ: XP, RC, chuỗi ngày, điểm đua và vai trò. Mật khẩu và email không bị lộ hay chỉnh sửa.</p>
        </div>
        <div className="admin-shop-toolbar-actions">
          <input
            type="search"
            className="admin-shop-search"
            value={search}
            onChange={(event) => {
              setLoading(true)
              setSearch(event.target.value)
            }}
            placeholder="Tìm theo tên hoặc email…"
            aria-label="Tìm người dùng"
          />
          <select
            className="admin-shop-search"
            value={role}
            onChange={(event) => {
              setLoading(true)
              setRole(event.target.value as '' | AdminManagedRole)
            }}
            aria-label="Lọc vai trò"
          >
            <option value="">Mọi vai trò</option>
            <option value="learner">Học viên</option>
            <option value="admin">Quản trị viên</option>
          </select>
          <button type="button" className="admin-btn is-quiet" onClick={reload} aria-label={t.retry}>
            <ArrowClockwise size={15} />
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
        empty={!loading && !loadError && users.length === 0}
        emptyIcon={<UsersThree size={22} weight="fill" aria-hidden="true" />}
        emptyText="Không có tài khoản nào khớp."
        rows={6}
        thumb
      >

      
        <ul className="admin-list is-video">
          {users.map((user) => (
            <li className="admin-row" key={user.id}>
              <span className="admin-user-avatar" aria-hidden="true">
                {user.name.trim().slice(0, 1).toUpperCase() || '?'}
              </span>
              <div className="admin-row-main">
                <strong>{user.name}</strong>
                <div className="admin-row-meta">
                  <span className="admin-chip">{user.email}</span>
                  <span className={`admin-chip${user.role === 'admin' ? ' is-warn' : ''}`}>{ROLE_LABEL[user.role]}</span>
                  <span className="admin-chip">Cấp {user.level}</span>
                  <span className="admin-chip is-xp">{formatCompact(user.xp)} XP</span>
                  <span className="admin-chip is-xp">{formatCompact(user.coins)} RC</span>
                  <span className="admin-chip">Chuỗi {user.streak} ngày</span>
                  <span className="admin-chip">{formatCompact(user.race_points)} RP</span>
                  <span className="admin-chip">{user.provider_count} liên kết MXH</span>
                </div>
                <div className="admin-user-meta">
                  <span>{user.lessons_completed} bài xong · {user.videos_completed} video xong</span>
                  <span>Tham gia {formatDate(user.created_at)} · Hoạt động cuối {formatDate(user.last_activity_at)}</span>
                </div>
              </div>
              <div className="admin-row-actions">
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => {
                    setFormError(null)
                    setDraft(draftFrom(user))
                  }}
                  aria-label={t.adminEdit}
                  title={t.adminEdit}
                >
                  <PencilSimple size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </AdminAsyncState>

      <AdminDialog
        open={draft !== null}
        title="Điều chỉnh tiến độ người dùng"
        description="Mật khẩu, email và tên đăng nhập không hiển thị và không thể sửa tại đây."
        busy={saving}
        onClose={() => setDraft(null)}
        footer={(
          <div className="admin-dialog-actions">
            <button type="button" className="video-ghost-btn" onClick={() => setDraft(null)} disabled={saving}>
              <span>{t.cancel}</span>
            </button>
            <button type="submit" form="admin-user-form" className="video-primary-btn" disabled={saving}>
              {saving ? <span className="video-spinner is-small" aria-hidden="true" /> : <UsersThree size={16} weight="fill" />}
              <span>{t.save}</span>
            </button>
          </div>
        )}
      >
        {draft && (
          <form id="admin-user-form" className="admin-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="admin-user-summary">
              <strong>{draft.name}</strong>
              <span>{draft.email}</span>
              <small>Chỉ số bên dưới là dữ liệu tiến độ, không phải thông tin đăng nhập.</small>
            </div>

            <div className="admin-section">
              <h4 className="admin-section-title">Tiến độ</h4>
              <div className="admin-field-row">
                <label className="admin-field">
                  <span>Kinh nghiệm (XP)</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    data-autofocus
                    value={draft.xp}
                    onChange={(event) => setDraft({ ...draft, xp: event.target.value })}
                    disabled={saving}
                  />
                </label>
                <label className="admin-field">
                  <span>Race Coin (RC)</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={draft.coins}
                    onChange={(event) => setDraft({ ...draft, coins: event.target.value })}
                    disabled={saving}
                  />
                </label>
              </div>
              <div className="admin-field-row">
                <label className="admin-field">
                  <span>Chuỗi ngày học</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={draft.streak}
                    onChange={(event) => setDraft({ ...draft, streak: event.target.value })}
                    disabled={saving}
                  />
                  <small className="admin-field-hint">Đặt 0 để xoá chuỗi; đặt số dương sẽ tính từ hôm nay.</small>
                </label>
                <label className="admin-field">
                  <span>Điểm đua mùa này (RP)</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={draft.racePoints}
                    onChange={(event) => setDraft({ ...draft, racePoints: event.target.value })}
                    disabled={saving}
                  />
                </label>
              </div>
            </div>

            <div className="admin-section">
              <h4 className="admin-section-title">Vai trò</h4>
              <label className="admin-field">
                <span>Quyền tài khoản</span>
                <select
                  value={draft.role}
                  onChange={(event) => setDraft({ ...draft, role: event.target.value as AdminManagedRole })}
                  disabled={saving}
                >
                  <option value="learner">Học viên</option>
                  <option value="admin">Quản trị viên</option>
                </select>
                <small className="admin-field-hint">Không thể tự bỏ quyền admin của chính mình hoặc hạ cấp admin cuối cùng.</small>
              </label>
            </div>

            {formError && <p className="video-import-error" role="alert">{formError}</p>}
          </form>
        )}
      </AdminDialog>
    </section>
  )
}
