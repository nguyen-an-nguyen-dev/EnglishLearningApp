import { useEffect, useRef } from 'react'
import { X } from '@phosphor-icons/react'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'

export type AuthMode = 'login' | 'register'

interface AuthModalProps {
  isOpen: boolean;
  mode: AuthMode;
  onClose: () => void;
  onSwitchMode: (mode: AuthMode) => void;
  onSuccess?: () => void
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
      </div>
    </dialog>
  )
}
