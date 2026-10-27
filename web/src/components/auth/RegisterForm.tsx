import React, { useState } from 'react';
import { User, EnvelopeSimple, LockKey, Eye, EyeSlash, CircleNotch } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { validateRegistration } from '../../utils/validation';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
  onSuccess?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSwitchToLogin,
  onSuccess,
}) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationError = validateRegistration({
      name: name.trim(),
      email: email.trim(),
      password,
      confirmPassword,
    });

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });
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
      <div className="auth-header">
          <h2 className="auth-title">Tạo tài khoản Engorace.</h2>
          <p className="auth-subtitle">Mở lộ trình học và bắt đầu với bài đầu tiên.</p>
      </div>

      {errorMessage && (
        <div className="auth-alert-error" role="alert">
          <span>{errorMessage}</span>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="register-name">
            Họ và tên
          </label>
          <div className="input-wrapper">
            <span className="input-icon">
              <User size={18} />
            </span>
            <input
              id="register-name"
              type="text"
              className="form-input"
              placeholder="Nguyễn Văn An"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              autoComplete="name"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="register-email">
            Địa chỉ Email
          </label>
          <div className="input-wrapper">
            <span className="input-icon">
              <EnvelopeSimple size={18} />
            </span>
            <input
              id="register-email"
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
          <label className="form-label" htmlFor="register-password">
            Mật khẩu (tối thiểu 6 ký tự)
          </label>
          <div className="input-wrapper">
            <span className="input-icon">
              <LockKey size={18} />
            </span>
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="new-password"
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

        <div className="form-group">
          <label className="form-label" htmlFor="register-confirm-password">
            Xác nhận mật khẩu
          </label>
          <div className="input-wrapper">
            <span className="input-icon">
              <LockKey size={18} />
            </span>
            <input
              id="register-confirm-password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="new-password"
              required
            />
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
              <span>Đang tạo tài khoản...</span>
            </span>
          ) : (
            'Tạo tài khoản'
          )}
        </button>
      </form>

      <div className="auth-footer">
        <span>Đã có tài khoản?</span>{' '}
        <button
          type="button"
          className="auth-link-btn"
          onClick={onSwitchToLogin}
        >
          Đăng nhập ngay
        </button>
      </div>
    </div>
  );
};
