import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { AdminLogin } from './AdminLogin'
import { AdminLayout, AdminNoAccess } from './AdminLayout'
import type { AdminViewId } from './adminRoute'

// Admin shell entry — separate login + layout, never mixed with learner UI.
export function AdminApp({ view }: { view: AdminViewId }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const { t } = useI18n()
  const [loggedOut, setLoggedOut] = useState(false)

  if (isLoading) {
    return (
      <div className="admin-login">
        <div className="admin-loading-state">{t.consoleLoading}</div>
      </div>
    )
  }

  if (!isAuthenticated || loggedOut) {
    return (
      <AdminLogin
        onSuccess={() => {
          setLoggedOut(false)
          // Force a fresh read after login; AuthContext already updated.
          // The layout below will render once user.role is available.
        }}
      />
    )
  }

  if (user?.role !== 'admin') {
    return (
      <AdminNoAccess
        onLogout={() => {
          logout()
          setLoggedOut(true)
        }}
      />
    )
  }

  return (
    <AdminLayout
      view={view}
      onLogoutDone={() => {
        setLoggedOut(true)
        // Stay on /admin so the user sees the fresh login UI after sign-out.
      }}
    />
  )
}
