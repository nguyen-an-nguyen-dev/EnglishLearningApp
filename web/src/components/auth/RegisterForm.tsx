import React, { useEffect, useState } from 'react';
import { User, EnvelopeSimple, LockKey, Eye, EyeSlash, CircleNotch, ShieldCheck } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { validateRegistration } from '../../utils/validation';
import type { StartRegistrationResult } from '../../types/auth';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
  onSuccess?: () => void;
}

type Step = 'form' | 'otp';

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSwitchToLogin,
  onSuccess,
}) => {
  const { startRegistration, verifyRegistration, resendRegistrationOtp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [step, setStep] = useState<Step>('form');
  const [pending, setPending] = useState<StartRegistrationResult | null>(null);
  const [otp, setOtp] = useState('');
  const [expiresLeft, setExpiresLeft] = useState(0);
  const [resendLeft, setResendLeft] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // The countdowns belong to the modal, not the server: the server still
  // enforces both timestamps, this only keeps the buttons honest.
  useEffect(() => {
    if (step !== 'otp') return;
    const timer = window.setInterval(() => {
      setExpiresLeft((value) => Math.max(0, value - 1));
      setResendLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const beginOtpStep = (result: StartRegistrationResult) => {
    setPending(result);
    setOtp('');
    setStep('otp');
    setExpiresLeft(result.expires_in_seconds);
    setResendLeft(result.resend_after_seconds);
    setErrorMessage(null);
    setInfoMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

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
      const result = await startRegistration({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      beginOtpStep(result);
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

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending) {
      setStep('form');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setErrorMessage('Vui lòng nhập đủ 6 chữ số trong email xác thực.');
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);
    setIsVerifying(true);
    try {
      await verifyRegistration({ email: pending.email, code: otp });
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Không xác thực được mã. Vui lòng thử lại.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!pending || resendLeft > 0 || isResending) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setIsResending(true);
    try {
      const result = await resendRegistrationOtp(pending.email);
      setPending(result);
      setOtp('');
      setExpiresLeft(result.expires_in_seconds);
      setResendLeft(result.resend_after_seconds);
      setInfoMessage('Đã gửi mã mới. Hãy kiểm tra hộp thư của bạn.');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Không gửi lại được mã. Vui lòng thử lại sau.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const backToForm = () => {
    setStep('form');
    setPending(null);
    setOtp('');
    setExpiresLeft(0);
    setResendLeft(0);
    setErrorMessage(null);
    setInfoMessage(null);
  };

  const busy = isSubmitting || isVerifying || isResending;

  return (
    <div className="auth-card-body">
      {errorMessage && (
        <div className="auth-alert-error" role="alert">
          <span>{errorMessage}</span>
        </div>
      )}
      {infoMessage && (
        <div className="auth-alert-success" role="status">
          <span>{infoMessage}</span>
        </div>
      )}

      {step === 'form' ? (
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
                <span>Đang gửi mã xác thực...</span>
              </span>
            ) : (
              'Tạo tài khoản'
            )}
          </button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={handleVerify} noValidate>
          <div className="auth-otp-head">
            <span className="auth-otp-icon" aria-hidden="true">
              <ShieldCheck size={22} weight="fill" />
            </span>
            <div>
              <h3>Nhập mã xác thực</h3>
              <p>
                {pending?.dev_code
                  ? <>SMTP chưa cấu hình — dùng mã thử nghiệm cho <strong>{pending?.email}</strong></>
                  : <>Mã 6 số đã được gửi tới <strong>{pending?.email}</strong></>}
              </p>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-otp">
              Mã xác thực
            </label>
            <input
              id="register-otp"
              type="text"
              className="form-input auth-otp-input"
              placeholder="••••••"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              disabled={busy}
              autoFocus
              required
            />
            <p className="auth-otp-meta">
              <span>
                {expiresLeft > 0
                  ? `Mã hết hạn sau ${formatCountdown(expiresLeft)}`
                  : 'Mã đã hết hạn — hãy gửi lại mã mới.'}
              </span>
            </p>
          </div>

          {pending?.dev_code && (
            <div className="auth-otp-dev">
              <span>SMTP chưa cấu hình — mã thử nghiệm:</span>
              <button
                type="button"
                className="auth-otp-dev-code"
                onClick={() => setOtp(pending.dev_code ?? '')}
                title="Điền mã thử nghiệm"
              >
                {pending.dev_code}
              </button>
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={busy}
          >
            {isVerifying ? (
              <span className="btn-inner-loading">
                <CircleNotch className="spin-icon" size={18} />
                <span>Đang xác thực...</span>
              </span>
            ) : (
              'Xác thực & tạo tài khoản'
            )}
          </button>

          <div className="auth-otp-actions">
            <button
              type="button"
              className="auth-link-btn"
              onClick={backToForm}
              disabled={busy}
            >
              Đổi email
            </button>
            <button
              type="button"
              className="auth-link-btn"
              onClick={() => void handleResend()}
              disabled={busy || resendLeft > 0}
            >
              {isResending
                ? 'Đang gửi lại...'
                : resendLeft > 0
                  ? `Gửi lại mã (${formatCountdown(resendLeft)})`
                  : 'Gửi lại mã'}
            </button>
          </div>
        </form>
      )}

      <div className="auth-footer">
        <span>Đã có tài khoản?</span>{' '}
        <button
          type="button"
          className="auth-link-btn"
          onClick={onSwitchToLogin}
          disabled={busy}
        >
          Đăng nhập ngay
        </button>
      </div>
    </div>
  );
};
