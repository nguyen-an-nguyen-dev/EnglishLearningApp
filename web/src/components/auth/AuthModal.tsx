import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from '@phosphor-icons/react'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { useAuth } from '../../context/AuthContext'
import { getProvidersApi, type ProviderConfig } from '../../services/authService'

export type AuthMode = 'login' | 'register'

interface AuthModalProps {
  isOpen: boolean;
  mode: AuthMode;
  onClose: () => void;
  onSwitchMode: (mode: AuthMode) => void;
  onSuccess?: () => void
}

interface GoogleAccounts {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleAccounts
    FB?: {
      init: (config: Record<string, unknown>) => void
      login: (cb: (r: { authResponse?: { accessToken?: string } }) => void, options: Record<string, unknown>) => void
    }
  }
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z" />
    </svg>
  )
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Không tải được SDK của nhà cung cấp.'))
    document.head.appendChild(script)
  })
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  mode,
  onClose,
  onSwitchMode,
  onSuccess,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const googleSlotRef = useRef<HTMLDivElement>(null)
  const { loginWithProvider } = useAuth()

  const [providers, setProviders] = useState<ProviderConfig | null>(null)
  const [socialError, setSocialError] = useState<string | null>(null)

  const loginRef = useRef(loginWithProvider)
  loginRef.current = loginWithProvider
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const finishSocial = useCallback(async (provider: 'google' | 'facebook', token: string) => {
    setSocialError(null)
    try {
      await loginRef.current(provider, token)
      onSuccessRef.current?.()
      onCloseRef.current()
    } catch (error) {
      setSocialError(error instanceof Error ? error.message : 'Đăng nhập thất bại.')
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      if (!dialog.open) {
        returnFocusRef.current = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
        dialog.showModal()
      }

      const focusFrame = window.requestAnimationFrame(() => {
        dialog.querySelector<HTMLInputElement>('input:not([disabled])')?.focus()
      })
      return () => window.cancelAnimationFrame(focusFrame)
    }

    if (dialog.open) dialog.close()
  }, [isOpen, mode])

  useEffect(() => {
    if (!isOpen) return
    setSocialError(null)
    let cancelled = false
    getProvidersApi().then((config) => {
      if (!cancelled) setProviders(config)
    })
    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !providers?.google || !providers.googleClientId) return
    let cancelled = false

    loadScript('https://accounts.google.com/gsi/client')
      .then(() => {
        const slot = googleSlotRef.current
        if (cancelled || !slot || !window.google) return
        window.google.accounts.id.initialize({
          client_id: providers.googleClientId,
          callback: (response) => { void finishSocial('google', response.credential) },
        })
        slot.replaceChildren()
        window.google.accounts.id.renderButton(slot, {
          type: 'icon',
          theme: 'outline',
          size: 'large',
          shape: 'circle',
        })
      })
      .catch(() => setSocialError('Không tải được Google SDK. Kiểm tra kết nối mạng.'))

    return () => {
      cancelled = true
    }
  }, [isOpen, providers, finishSocial])

  function handleFacebook() {
    if (!providers?.facebook || !providers.facebookAppId) {
      setSocialError('Chưa cấu hình Facebook App ID ở backend.')
      return
    }
    setSocialError(null)
    loadScript('https://connect.facebook.net/vi_VN/sdk.js')
      .then(() => {
        if (!window.FB) throw new Error('Không tải được Facebook SDK.')
        window.FB.init({ appId: providers.facebookAppId, cookie: true, xfbml: false, version: 'v19.0' })
        window.FB.login(
          (response) => {
            const token = response.authResponse?.accessToken
            if (token) void finishSocial('facebook', token)
          },
          { scope: 'email,public_profile' },
        )
      })
      .catch((error: unknown) => {
        setSocialError(error instanceof Error ? error.message : 'Đăng nhập Facebook thất bại.')
      })
  }

  function handleDialogClose() {
    if (isOpen) onClose()
    const target = returnFocusRef.current
    if (target?.isConnected) {
      window.requestAnimationFrame(() => target.focus({ preventScroll: true }))
    }
  }

  function closeDialog() {
    if (dialogRef.current?.open) dialogRef.current.close()
    else onClose()
  }

  const googleReady = Boolean(providers?.google && providers.googleClientId)

  return (
    <dialog
      ref={dialogRef}
      className="auth-dialog"
      aria-label={mode === 'login' ? 'Đăng nhập vào Engorace' : 'Tạo tài khoản Engorace'}
      onClose={handleDialogClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog()
      }}
    >
      <div className="auth-dialog-panel">
        <button
          className="auth-modal-close"
          onClick={closeDialog}
          type="button"
          aria-label="Đóng cửa sổ"
        >
          <X size={20} />
        </button>

        <div className="auth-modal-brand" aria-label="Engorace">
          <span className="brand-title"><span className="brand-eng">Eng</span><span className="brand-o">o</span><span className="brand-race">race</span></span>
        </div>

        <div className="auth-tabs" aria-label="Chọn hình thức tài khoản">
          <button
            type="button"
            aria-pressed={mode === 'login'}
            className={`auth-tab ${mode === 'login' ? 'auth-tab-active' : ''}`}
            onClick={() => onSwitchMode('login')}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            aria-pressed={mode === 'register'}
            className={`auth-tab ${mode === 'register' ? 'auth-tab-active' : ''}`}
            onClick={() => onSwitchMode('register')}
          >
            Đăng ký
          </button>
        </div>

        {mode === 'login' ? (
          <LoginForm
            onSwitchToRegister={() => onSwitchMode('register')}
            onSuccess={() => {
              onSuccess?.()
              onClose()
            }}
          />
        ) : (
          <RegisterForm
            onSwitchToLogin={() => onSwitchMode('login')}
            onSuccess={() => {
              onSuccess?.()
              onClose()
            }}
          />
        )}

        <div className="auth-divider"><span>hoặc</span></div>

        <div className="auth-social">
          <div className="auth-social-row">
            {googleReady ? (
              <div className="auth-social-google" ref={googleSlotRef} />
            ) : (
              <button
                type="button"
                className="auth-social-btn"
                aria-label="Đăng nhập bằng Google"
                title="Đăng nhập bằng Google"
                onClick={() => setSocialError('Chưa cấu hình Google Client ID ở backend.')}
              >
                <GoogleMark />
              </button>
            )}
            <button
              type="button"
              className="auth-social-btn"
              aria-label="Đăng nhập bằng Facebook"
              title="Đăng nhập bằng Facebook"
              onClick={handleFacebook}
            >
              <FacebookMark />
            </button>
          </div>

          {socialError && <p className="auth-social-error" role="alert">{socialError}</p>}
        </div>
      </div>
    </dialog>
  )
}
