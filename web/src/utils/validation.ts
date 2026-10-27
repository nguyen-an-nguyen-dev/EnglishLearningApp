export interface RegistrationData {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

export function validatePassword(password: string): boolean {
  if (!password || typeof password !== 'string') return false;
  return password.length >= 6;
}

export function validateName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  return name.trim().length >= 2;
}

export function validateRegistration(data: RegistrationData): string | null {
  if (!validateName(data.name)) {
    return 'Họ và tên phải có ít nhất 2 ký tự.';
  }
  if (!validateEmail(data.email)) {
    return 'Email không đúng định dạng.';
  }
  if (!validatePassword(data.password)) {
    return 'Mật khẩu phải có ít nhất 6 ký tự.';
  }
  if (data.confirmPassword !== undefined && data.password !== data.confirmPassword) {
    return 'Mật khẩu xác nhận không khớp.';
  }
  return null;
}

export function validateLogin(data: LoginData): string | null {
  if (!data.email?.trim() || !data.password) {
    return 'Vui lòng nhập đầy đủ email và mật khẩu.';
  }
  if (!validateEmail(data.email)) {
    return 'Email không đúng định dạng.';
  }
  return null;
}
