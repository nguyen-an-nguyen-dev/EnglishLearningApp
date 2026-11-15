import { useEffect } from 'react'
import { useState } from 'react'
import {
  ChartBar,
  Flag,
  GridFour,
  SignOut,
  VideoCamera,
} from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { AdminLessonsPanel } from '../components/admin/AdminLessonsPanel'
import { AdminVideoPanel } from '../components/admin/AdminVideoPanel'
import { AdminOverview } from './AdminOverview'
import { AdminStats } from './AdminStats'

export type AdminViewId = 'overview' | 'content' | 'videos' | 'stats'

const VIEW_STORAGE_KEY = 'engorace_admin_view'

function readStoredView(): AdminViewId {
  try {
    const raw = sessionStorage.getItem(VIEW_STORAGE_KEY)
    if (raw === 'overview' || raw === 'content' || raw === 'videos' || raw === 'stats') return raw
  } catch {
    /* private mode */
  }
  // Deep-link from hash, e.g. #/admin/stats
  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  if (hash.includes('/stats')) return 'stats'
  if (hash.includes('/content')) return 'content'
  if (hash.includes('/videos')) return 'videos'
  return 'overview'
}

export function AdminLayout({ onLogoutDone }: { onLogoutDone: () => void }) {
  const { t } = useI18n()
  const { user, logout } = useAuth()
  const [view, setView] = useState<AdminViewId>(readStoredView)

  useEffect(() => {
    try {
      sessionStorage.setItem(VIEW_STORAGE_KEY, view)
      window.history.replaceState(null, '', `#/admin/${view}`)
    } catch {
      /* storage blocked */
    }
  }, [view])

  const items: Array<{ id: AdminViewId; label: string; short: string; icon: typeof GridFour }> = [
    { id: 'overview', label: t.consoleNavOverview, short: 'Tổng quan', icon: GridFour },
    { id: 'content', label: t.consoleNavContent, short: 'Nội dung', icon: Flag },
    { id: 'videos', label: t.consoleNavVideos, short: 'Video', icon: VideoCamera },
    { id: 'stats', label: t.consoleNavStats, short: 'Thống kê', icon: ChartBar },
  ]

  const initial = user?.name ? user.name.trim()[0].toUpperCase() : 'A'
  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })
  const todayLabel = today.charAt(0).toUpperCase() + today.slice(1)

  function handleLogout() {
    logout()
    onLogoutDone()
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sider" aria-label={t.consoleTitle}>
        <div className="admin-sider-brand">
          <img src="/logo.png" alt="Engorace" />
          <div className="admin-sider-brand-text">
            <strong>Engorace</strong>
            <span>{t.consoleTitle}</span>
          </div>
        </div>

        <nav className="admin-sider-nav" aria-label={t.consoleTitle}>
          {items.map((item) => {
            const Icon = item.icon
            const active = view === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`admin-sider-link${active ? ' is-active' : ''}`}
                onClick={() => setView(item.id)}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="admin-sider-foot">
          <div className="admin-sider-user">
            <span className="admin-sider-avatar">{initial}</span>
            <span className="admin-sider-user-copy">
              <strong>{user?.name}</strong>
              <small>{user?.email}</small>
            </span>
            <button
              type="button"
              className="admin-icon-btn"
              onClick={handleLogout}
              title={t.consoleLogout}
              aria-label={t.consoleLogout}
            >
              <SignOut size={17} />
            </button>
          </div>

          {/* Admins only manage — no link back to the learner UI. */}
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-copy">
            <h1>{items.find((i) => i.id === view)?.label}</h1>
            <p>
              {view === 'overview' && t.consoleOverviewDesc}
              {view === 'content' && t.adminDesc}
              {view === 'videos' && t.adminVideoDialogDesc}
              {view === 'stats' && 'Theo dõi người học, giữ chân và hiệu suất nội dung.'}
            </p>
          </div>
          <div className="admin-topbar-actions">
            <span className="admin-topbar-date">{todayLabel}</span>
            <span className="admin-role">Quản trị viên</span>
            <button type="button" className="admin-btn" onClick={handleLogout}>
              <SignOut size={15} /> {t.consoleLogout}
            </button>
          </div>
        </header>

        <main className="admin-content">
          {view === 'overview' && <AdminOverview onNavigate={setView} />}
          {view === 'content' && <AdminLessonsPanel />}
          {view === 'videos' && (
            <div className="admin-card admin-panel-card">
              <AdminVideoPanel />
            </div>
          )}
          {view === 'stats' && <AdminStats />}
        </main>

        <nav className="admin-mobile-nav" aria-label={t.consoleTitle}>
          {items.map((item) => {
            const Icon = item.icon
            const active = view === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={active ? 'is-active' : ''}
                onClick={() => setView(item.id)}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={20} />
                <span>{item.short}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* The admin dialogs render fixed; keep the panels' card frame */}
    </div>
  )
}

export function AdminNoAccess({ onLogout }: { onLogout: () => void }) {
  const { t } = useI18n()
  return (
    <div className="admin-login">
      <div className="admin-login-card" role="alert">
        <div className="admin-login-head">
          <img src="/logo.png" alt="Engorace" />
          <h1>{t.consoleNoAccessTitle}</h1>
          <p>{t.consoleNoAccessDesc}</p>
        </div>
        <div className="admin-login-body">
          <button type="button" className="admin-btn is-primary" onClick={onLogout} style={{ justifyContent: 'center' }}>
            <SignOut size={15} /> {t.consoleLogout}
          </button>
        </div>
      </div>
    </div>
  )
}
