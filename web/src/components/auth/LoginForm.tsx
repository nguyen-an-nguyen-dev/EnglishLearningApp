import React, { useState } from 'react';
import { EnvelopeSimple, LockKey, Eye, EyeSlash, CircleNotch, Lightning } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { validateLogin } from '../../utils/validation';

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

  const DEMO_ACCOUNT = { email: 'test@test.com', password: '123456' };

  const handleDemoLogin = async () => {
    setErrorMessage(null);
    setEmail(DEMO_ACCOUNT.email);
    setPassword(DEMO_ACCOUNT.password);
    setIsSubmitting(true);
    try {
      await login(DEMO_ACCOUNT);
      onSuccess?.();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định.');
    } finally {
      setIsSubmitting(false);
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
          disabled={isSubmitting}
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

        <button
          type="button"
          className="auth-demo-btn"
          onClick={handleDemoLogin}
          disabled={isSubmitting}
          title={`${DEMO_ACCOUNT.email} · ${DEMO_ACCOUNT.password}`}
        >
          <Lightning size={15} weight="fill" />
          <span>Vào nhanh bằng tài khoản demo</span>
        </button>

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
