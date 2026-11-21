import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from '@phosphor-icons/react'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { useAuth } from '../../context/AuthContext'
import { getProvidersApi, SocialAuthError, type ProviderConfig } from '../../services/authService'
import { loadScript } from '../../utils/socialSdk'

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
  const onSuccessRef = useRef(onSuccess)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    loginRef.current = loginWithProvider
    onSuccessRef.current = onSuccess
    onCloseRef.current = onClose
  }, [loginWithProvider, onSuccess, onClose])

  const finishSocial = useCallback(async (provider: 'google' | 'facebook', token: string) => {
    setSocialError(null)
    try {
      await loginRef.current(provider, token)
      onSuccessRef.current?.()
      onCloseRef.current()
    } catch (error) {
      if (error instanceof SocialAuthError && error.code === 'ACCOUNT_EXISTS_LINK_REQUIRED') {
        setSocialError(
          'Email này đã có tài khoản. Hãy đăng nhập bằng mật khẩu, rồi vào Hồ sơ để liên kết '
          + 'Google/Facebook. Hệ thống không tự liên kết để tránh chiếm tài khoản.',
        )
      } else {
        setSocialError(error instanceof Error ? error.message : 'Đăng nhập thất bại.')
      }
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
      .catch(() => {
        setSocialError('Không tải được Google SDK. Kiểm tra kết nối mạng.')
      })

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
    setSocialError(null)
    if (isOpen) onClose()
    const target = returnFocusRef.current
    if (target?.isConnected) {
      window.requestAnimationFrame(() => target.focus({ preventScroll: true }))
    }
  }

  function closeDialog() {
    if (dialogRef.current?.open) dialogRef.current.close()
    else {
      setSocialError(null)
      onClose()
    }
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
                <img src="/social/google.svg" alt="" width={20} height={20} />
              </button>
            )}
            <button
              type="button"
              className="auth-social-btn"
              aria-label="Đăng nhập bằng Facebook"
              title="Đăng nhập bằng Facebook"
              onClick={handleFacebook}
            >
              <img src="/social/facebook.svg" alt="" width={20} height={20} />
            </button>
          </div>

          {socialError && <p className="auth-social-error" role="alert">{socialError}</p>}
        </div>
      </div>
    </dialog>
  )
}
