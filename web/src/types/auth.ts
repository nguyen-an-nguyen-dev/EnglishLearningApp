export type UserRole = 'learner' | 'admin';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  xp: number;
  /** Race Coin balance, spendable in the shop. */
  coins: number;
  /** Career level derived from xp on the server. */
  level: number;
  streak: number;
  /** `admin` unlocks the content console tab; everything else is a normal learner. */
  role: UserRole;
  /** False when the account was created by a social provider and has no password yet. */
  has_password: boolean;
}

export type SocialProvider = 'google' | 'facebook';

export interface LinkedProvider {
  provider: SocialProvider;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  linked_at: string;
  last_login_at: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface StartRegistrationResult {
  email: string;
  expires_in_seconds: number;
  resend_after_seconds: number;
  /** Backend dev mode only (SMTP not configured + OTP_DEBUG=true). */
  dev_code?: string;
}

export interface VerifyRegistrationPayload {
  email: string;
  code: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  errors?: string[];
}

export interface LoginResponseData {
  token: string;
  user: AuthUser;
}

export interface RegisterResponseData {
  user: AuthUser;
}

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginPayload) => Promise<void>;
  loginWithProvider: (provider: 'google' | 'facebook', token: string) => Promise<void>;
  /** Step 1 of the web registration: mail a six-digit code. */
  startRegistration: (credentials: RegisterPayload) => Promise<StartRegistrationResult>;
  /** Step 2: consume the code and enter the app. */
  verifyRegistration: (payload: VerifyRegistrationPayload) => Promise<void>;
  resendRegistrationOtp: (email: string) => Promise<StartRegistrationResult>;
  changePassword: (payload: { currentPassword: string; newPassword: string }) => Promise<void>;
  updateProfile: (payload: { name: string; email: string }) => Promise<void>;
  uploadAvatar: (file: File, onProgress?: (percent: number) => void) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}
