import { useState } from 'react'
import type { FormEvent } from 'react'
import { CircleNotch, EnvelopeSimple, Eye, EyeSlash, Lightning, LockKey } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { authStorage } from '../services/authStorage'
import { validateLogin } from '../utils/validation'
import logoUrl from '../assets/logo.png'

export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useI18n()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const issue = validateLogin({ email: email.trim(), password })
    if (issue) {
      setError(issue)
      return
    }
    setBusy(true)
    try {
      await login({ email: email.trim(), password })
      const cached = authStorage.getUser()
      if (cached && cached.role !== 'admin') {
        setError(t.consoleNoAccessDesc)
        return
      }
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.adminSaveError)
    } finally {
      setBusy(false)
    }
  }

  async function handleQuickLogin() {
    setError(null)
    setBusy(true)
    try {
      await login({ email: 'admin@engorace.demo', password: 'Engorace@2026' })
      const cached = authStorage.getUser()
      if (cached && cached.role !== 'admin') {
        setError(t.consoleNoAccessDesc)
        return
      }
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.adminSaveError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login-card" role="dialog" aria-label={t.consoleLoginTitle}>
        <div className="admin-login-head">
          <img src={logoUrl} alt="Engorace" />
          <h1>{t.consoleLoginTitle}</h1>
          <p>{t.consoleLoginDesc}</p>
        </div>
        <div className="admin-login-body">
          {error && (
            <div className="admin-error-state" role="alert">
              <span>{error}</span>
            </div>
          )}
          <form className="admin-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
            <label className="admin-field">
              <span>Email</span>
              <span className="admin-input">
                <EnvelopeSimple size={16} />
                <input
                  type="email"
                  data-autofocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@engorace.dev"
                  disabled={busy}
                  autoComplete="username"
                />
              </span>
            </label>
            <label className="admin-field">
              <span>{t.consolePassword}</span>
              <span className="admin-input">
                <LockKey size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  disabled={busy}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  disabled={busy}
                >
                  {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
            <button type="submit" className="admin-btn is-primary" disabled={busy} style={{ justifyContent: 'center' }}>
              {busy ? (
                <>
                  <CircleNotch className="spin-icon" size={16} />
                  <span>{t.consoleLoading}</span>
                </>
              ) : (
                <span>{t.consoleLoginTitle}</span>
              )}
            </button>
            <button
              type="button"
              className="admin-btn is-quiet"
              onClick={() => void handleQuickLogin()}
              disabled={busy}
              style={{ justifyContent: 'center' }}
            >
              <Lightning size={15} weight="fill" />
              <span>Đăng nhập nhanh (demo)</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
