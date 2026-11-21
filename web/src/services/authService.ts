import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  LoginResponseData,
  RegisterResponseData,
  LinkedProvider,
  SocialProvider,
  StartRegistrationResult,
  VerifyRegistrationPayload,
} from '../types/auth';
import { ApiError, requestApi, requestPublicApi } from './apiClient';
import { AUTH_ENDPOINTS } from './endpoints';
import { authStorage } from './authStorage';
import { cachedQuery } from './queryCache';

export { authStorage };

export interface ProviderConfig {
  google: boolean;
  facebook: boolean;
  googleClientId: string;
  facebookAppId: string;
}

export const NO_PROVIDERS: ProviderConfig = {
  google: false,
  facebook: false,
  googleClientId: '',
  facebookAppId: '',
};

function jsonRequest(payload: unknown): RequestInit {
  return {
    method: 'POST',
    body: JSON.stringify(payload),
  };
}

export async function getProvidersApi(): Promise<ProviderConfig> {
  try {
    return await cachedQuery(
      'auth:providers',
      60_000,
      () => requestPublicApi<ProviderConfig>(AUTH_ENDPOINTS.providers),
    );
  } catch {
    return NO_PROVIDERS;
  }
}

export class SocialAuthError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'SocialAuthError';
    this.code = code;
  }
}

function socialErrorCode(error: ApiError): string | null {
  return error.errors.find((entry) => /^[A-Z0-9_]+$/.test(entry)) ?? null;
}

async function socialLogin(
  path: string,
  payload: Record<string, string>,
  fallback: string,
): Promise<LoginResponseData> {
  try {
    const data = await requestPublicApi<LoginResponseData>(path, jsonRequest(payload));
    if (typeof data.token === 'string' && data.token.trim() && isAuthUser(data.user)) return data;
    throw new SocialAuthError(fallback, null);
  } catch (error) {
    if (error instanceof ApiError) {
      throw new SocialAuthError(error.message || fallback, socialErrorCode(error));
    }
    throw error;
  }
}

export function loginWithGoogleApi(credential: string): Promise<LoginResponseData> {
  return socialLogin(AUTH_ENDPOINTS.google, { credential }, 'Đăng nhập Google thất bại.');
}

export function loginWithFacebookApi(accessToken: string): Promise<LoginResponseData> {
  return socialLogin(AUTH_ENDPOINTS.facebook, { accessToken }, 'Đăng nhập Facebook thất bại.');
}

export async function getLinkedProvidersApi(token: string): Promise<LinkedProvider[]> {
  const data = await requestApi<{ providers: LinkedProvider[] }>(AUTH_ENDPOINTS.providerLinks, {}, token);
  return data.providers;
}

export async function linkProviderApi(
  token: string,
  provider: SocialProvider,
  providerToken: string,
): Promise<LinkedProvider[]> {
  const data = await requestApi<{ providers: LinkedProvider[] }>(
    AUTH_ENDPOINTS.providerLink(provider),
    {
      method: 'POST',
      body: JSON.stringify(
        provider === 'google' ? { credential: providerToken } : { accessToken: providerToken },
      ),
    },
    token,
  );
  return data.providers;
}

export async function unlinkProviderApi(
  token: string,
  provider: SocialProvider,
): Promise<LinkedProvider[]> {
  const data = await requestApi<{ providers: LinkedProvider[] }>(
    AUTH_ENDPOINTS.provider(provider),
    { method: 'DELETE' },
    token,
  );
  return data.providers;
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Partial<AuthUser>;
  const numberFields = [user.id, user.xp, user.streak];
  // coins/level are newer columns: accept a missing value (legacy cached user)
  // so a stale localStorage entry cannot lock the learner out of their session.
  const optionalNumeric = [user.coins, user.level].every(
    (field) => field === undefined || typeof field === 'number',
  );
  const hasPasswordValid = user.has_password === undefined || typeof user.has_password === 'boolean';
  return numberFields.every((field) => typeof field === 'number')
    && optionalNumeric
    && hasPasswordValid
    && typeof user.name === 'string'
    && typeof user.email === 'string'
    && (user.role === 'learner' || user.role === 'admin');
}

export async function loginApi(payload: LoginPayload): Promise<LoginResponseData> {
  try {
    const data = await requestPublicApi<LoginResponseData>(AUTH_ENDPOINTS.login, jsonRequest(payload));
    if (typeof data.token === 'string' && data.token.trim() && isAuthUser(data.user)) return data;
    throw new Error('Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
  } catch (error) {
    if (error instanceof ApiError) {
      const fallback = error.status >= 500
        ? `Không thể đăng nhập. Máy chủ không khả dụng (HTTP ${error.status}).`
        : 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.';
      throw new Error(error.message || fallback, { cause: error });
    }
    throw error;
  }
}

export async function registerApi(payload: RegisterPayload): Promise<RegisterResponseData> {
  try {
    const data = await requestPublicApi<RegisterResponseData>(AUTH_ENDPOINTS.register, jsonRequest(payload));
    if (!isAuthUser(data.user)) throw new Error('Đăng ký không thành công.');
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 409) {
        throw new Error('Email này đã được sử dụng. Vui lòng chọn email khác.', { cause: error });
      }
      const fallback = error.status >= 500
        ? `Không thể đăng ký. Máy chủ không khả dụng (HTTP ${error.status}).`
        : 'Đăng ký không thành công.';
      throw new Error(error.message || fallback, { cause: error });
    }
    throw error;
  }
}

function isStartRegistrationResult(value: unknown): value is StartRegistrationResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<StartRegistrationResult>;
  return typeof result.email === 'string'
    && typeof result.expires_in_seconds === 'number'
    && typeof result.resend_after_seconds === 'number';
}

const REGISTRATION_ERROR_MESSAGES: Record<string, string> = {
  OTP_INVALID: 'Mã xác thực không đúng. Vui lòng kiểm tra lại.',
  OTP_EXPIRED: 'Mã xác thực đã hết hạn. Hãy gửi lại mã mới.',
  OTP_MISSING: 'Phiên đăng ký không còn hiệu lực. Vui lòng nhập lại thông tin.',
  OTP_TOO_MANY_ATTEMPTS: 'Bạn đã nhập sai quá nhiều lần. Hãy gửi lại mã mới.',
  OTP_RESEND_COOLDOWN: 'Vui lòng đợi một chút trước khi gửi lại mã.',
  OTP_MAIL_FAILED: 'Không gửi được email xác thực. Vui lòng thử lại sau.',
  OTP_MAIL_NOT_CONFIGURED: 'Máy chủ chưa cấu hình gửi email. Vui lòng liên hệ quản trị viên.',
};

function registrationError(error: unknown, fallback: string): Error {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error : new Error(fallback);
  }
  const code = error.errors.find((entry) => /^[A-Z0-9_]+$/.test(entry));
  const mapped = code ? REGISTRATION_ERROR_MESSAGES[code] : undefined;
  const message = mapped
    ?? (error.status === 409
      ? 'Email này đã được sử dụng. Vui lòng chọn email khác.'
      : error.status >= 500
        ? `Máy chủ không khả dụng (HTTP ${error.status}). Vui lòng thử lại.`
        : fallback);
  return new Error(message, { cause: error });
}

/** Web registration, step 1: ask the backend to mail a six-digit code. */
export async function startRegistrationApi(
  payload: RegisterPayload,
): Promise<StartRegistrationResult> {
  try {
    const data = await requestPublicApi<StartRegistrationResult>(
      AUTH_ENDPOINTS.registerStart,
      jsonRequest(payload),
    );
    if (!isStartRegistrationResult(data)) throw new Error('Không nhận được phản hồi đăng ký.');
    return data;
  } catch (error) {
    throw registrationError(error, 'Không gửi được mã xác thực. Vui lòng thử lại.');
  }
}

/** Web registration, step 2: the code is the only thing that creates the user. */
export async function verifyRegistrationApi(
  payload: VerifyRegistrationPayload,
): Promise<LoginResponseData> {
  try {
    const data = await requestPublicApi<LoginResponseData>(
      AUTH_ENDPOINTS.registerVerify,
      jsonRequest(payload),
    );
    if (typeof data.token === 'string' && data.token.trim() && isAuthUser(data.user)) {
      return data;
    }
    throw new Error('Mã xác thực không hợp lệ.');
  } catch (error) {
    throw registrationError(error, 'Mã xác thực không đúng. Vui lòng kiểm tra lại.');
  }
}

export async function resendRegistrationOtpApi(email: string): Promise<StartRegistrationResult> {
  try {
    const data = await requestPublicApi<StartRegistrationResult>(
      AUTH_ENDPOINTS.registerResend,
      jsonRequest({ email }),
    );
    if (!isStartRegistrationResult(data)) throw new Error('Không nhận được phản hồi đăng ký.');
    return data;
  } catch (error) {
    throw registrationError(error, 'Không gửi lại được mã. Vui lòng thử lại sau.');
  }
}

export async function changePasswordApi(
  token: string,
  payload: { currentPassword: string; newPassword: string },
): Promise<void> {
  await requestApi<{ message: string }>(
    AUTH_ENDPOINTS.password,
    { method: 'PATCH', body: JSON.stringify(payload) },
    token,
  );
}

export async function updateProfileApi(
  token: string,
  payload: { name: string; email: string },
): Promise<AuthUser> {
  const data = await requestApi<{ user: AuthUser }>(
    AUTH_ENDPOINTS.profile,
    { method: 'PATCH', body: JSON.stringify(payload) },
    token,
  );
  if (!isAuthUser(data.user)) throw new Error('Không lưu được thông tin.');
  return data.user;
}

function getCachedUserForToken(token: string): AuthUser | null {
  if (!token || authStorage.getToken() !== token) return null;
  const cachedUser = authStorage.getUser();
  return isAuthUser(cachedUser) ? cachedUser : null;
}

export async function getCurrentUserApi(token: string): Promise<AuthUser> {
  try {
    const data = await requestApi<{ user: AuthUser }>(AUTH_ENDPOINTS.me, {}, token);
    if (isAuthUser(data.user)) return data.user;
    throw new Error('Phiên đăng nhập đã hết hạn.');
  } catch (error) {
    if (error instanceof ApiError) {
      // A transient server fault may fall back to the signed-in cache; a 401
      // must not, because requestApi has already cleared the session.
      if (error.status >= 500) {
        const cachedUser = getCachedUserForToken(token);
        if (cachedUser) return cachedUser;
      }
      const fallback = error.status >= 500
        ? `Không thể xác minh phiên đăng nhập (HTTP ${error.status}).`
        : 'Phiên đăng nhập đã hết hạn.';
      throw new Error(error.message || fallback, { cause: error });
    }
    const cachedUser = getCachedUserForToken(token);
    if (cachedUser) return cachedUser;
    throw error;
  }
}
