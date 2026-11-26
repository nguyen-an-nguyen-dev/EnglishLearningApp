import {
  ChartBar,
  Flag,
  GridFour,
  SignOut,
  Storefront,
  Sword,
  UsersThree,
  VideoCamera,
} from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { Avatar } from '../components/Avatar'
import { useI18n } from '../i18n'
import { AdminLessonsPanel } from '../components/admin/AdminLessonsPanel'
import { AdminVideoPanel } from '../components/admin/AdminVideoPanel'
import { AdminShopPanel } from '../components/admin/AdminShopPanel'
import { AdminArenaPanel } from '../components/admin/AdminArenaPanel'
import { AdminUsersPanel } from '../components/admin/AdminUsersPanel'
import logoUrl from '../assets/logo.png'
import { AdminOverview } from './AdminOverview'
import { AdminStats } from './AdminStats'

import { adminPath, type AdminViewId } from './adminRoute'
import { interceptLink, navigate } from '../utils/browserNavigation'

export type { AdminViewId } from './adminRoute'

export function AdminLayout({ view, onLogoutDone }: { view: AdminViewId; onLogoutDone: () => void }) {
  const { t } = useI18n()
  const { user, logout } = useAuth()
  const setView = (next: AdminViewId) => navigate(adminPath(next))

  const items: Array<{ id: AdminViewId; label: string; short: string; icon: typeof GridFour }> = [
    { id: 'overview', label: t.consoleNavOverview, short: 'Tổng quan', icon: GridFour },
    { id: 'content', label: t.consoleNavContent, short: 'Nội dung', icon: Flag },
    { id: 'videos', label: t.consoleNavVideos, short: 'Video', icon: VideoCamera },
    { id: 'shop', label: 'Cửa hàng', short: 'Shop', icon: Storefront },
    { id: 'arena', label: 'Đấu trường', short: 'Arena', icon: Sword },
    { id: 'users', label: 'Người dùng', short: 'User', icon: UsersThree },
    { id: 'stats', label: t.consoleNavStats, short: 'Thống kê', icon: ChartBar },
  ]

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
          <img src={logoUrl} alt="Engorace" />
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
              <a
                key={item.id}
                href={adminPath(item.id)}
                className={`admin-sider-link${active ? ' is-active' : ''}`}
                onClick={(event) => interceptLink(event, () => setView(item.id))}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </a>
            )
          })}
        </nav>

        <div className="admin-sider-foot">
          <div className="admin-sider-user">
            <Avatar src={user?.avatar_url} size={36} className="admin-sider-avatar" />
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
              {view === 'shop' && 'Quản lý vật phẩm Gara, giá, độ hiếm và hiệu ứng tiêu hao.'}
              {view === 'arena' && 'Quản lý từ vựng dùng để sinh câu hỏi Word Battle.'}
              {view === 'users' && 'Quản lý tiến độ người học mà không đụng tới mật khẩu hay thông tin đăng nhập.'}
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
          {view === 'shop' && (
            <div className="admin-card admin-panel-card">
              <AdminShopPanel />
            </div>
          )}
          {view === 'arena' && (
            <div className="admin-card admin-panel-card">
              <AdminArenaPanel />
            </div>
          )}
          {view === 'users' && (
            <div className="admin-card admin-panel-card">
              <AdminUsersPanel />
            </div>
          )}
          {view === 'stats' && <AdminStats />}
        </main>

        <nav className="admin-mobile-nav" aria-label={t.consoleTitle}>
          {items.map((item) => {
            const Icon = item.icon
            const active = view === item.id
            return (
              <a
                key={item.id}
                href={adminPath(item.id)}
                className={active ? 'is-active' : ''}
                onClick={(event) => interceptLink(event, () => setView(item.id))}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={20} />
                <span>{item.short}</span>
              </a>
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
          <img src={logoUrl} alt="Engorace" />
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
