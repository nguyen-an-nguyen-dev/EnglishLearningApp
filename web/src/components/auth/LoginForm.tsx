import React, { useState } from 'react';
import { EnvelopeSimple, LockKey, Eye, EyeSlash, CircleNotch, Lightning } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { validateLogin } from '../../utils/validation';

const QUICK_LOGIN_ACCOUNT = {
  email: 'minhanh@engorace.demo',
  password: 'Engorace@2026',
};

interface LoginFormProps {
  onSwitchToRegister: () => void;
  onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSwitchToRegister,
  onSuccess,
}) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);

  const quickLogin = async (account: { email: string; password: string }) => {
    setErrorMessage(null);
    setQuickBusy(true);
    try {
      await login({ email: account.email, password: account.password });
      onSuccess?.();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định.');
    } finally {
      setQuickBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationError = validateLogin({ email, password });
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Đã xảy ra lỗi không xác định.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-card-body">
      {errorMessage && (
        <div className="auth-alert-error" role="alert">
          <span>{errorMessage}</span>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="login-email">
            Địa chỉ Email
          </label>
          <div className="input-wrapper">
            <span className="input-icon">
              <EnvelopeSimple size={18} />
            </span>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="tenban@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-password">
            Mật khẩu
          </label>
          <div className="input-wrapper">
            <span className="input-icon">
              <LockKey size={18} />
            </span>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="auth-submit-btn"
          disabled={isSubmitting || quickBusy}
        >
          {isSubmitting ? (
            <span className="btn-inner-loading">
              <CircleNotch className="spin-icon" size={18} />
              <span>Đang đăng nhập...</span>
            </span>
          ) : (
            'Đăng nhập'
          )}
        </button>

        <div className="auth-quick">
          <button
            type="button"
            className="auth-quick-btn"
            onClick={() => void quickLogin(QUICK_LOGIN_ACCOUNT)}
            disabled={isSubmitting || quickBusy}
            title={QUICK_LOGIN_ACCOUNT.email}
          >
            {quickBusy ? <CircleNotch className="spin-icon" size={15} /> : <Lightning size={15} weight="fill" />}
            <span>Đăng nhập nhanh (demo)</span>
          </button>
        </div>

      </form>

      <div className="auth-footer">
        <span>Chưa có tài khoản?</span>{' '}
        <button
          type="button"
          className="auth-link-btn"
          onClick={onSwitchToRegister}
        >
          Đăng ký ngay
        </button>
      </div>
    </div>
  );
};
