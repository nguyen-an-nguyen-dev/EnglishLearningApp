import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  LoginResponseData,
  RegisterResponseData,
  ApiResponse,
} from '../types/auth';

const TOKEN_KEY = 'englearn_token';
const USER_KEY = 'englearn_user';

export const authStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
      console.warn('Failed to save token to localStorage', e);
    }
  },

  removeToken(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      console.warn('Failed to remove token from localStorage', e);
    }
  },

  getUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setUser(user: AuthUser): void {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.warn('Failed to save user to localStorage', e);
    }
  },

  removeUser(): void {
    try {
      localStorage.removeItem(USER_KEY);
    } catch (e) {
      console.warn('Failed to remove user from localStorage', e);
    }
  },

  clear(): void {
    authStorage.removeToken();
    authStorage.removeUser();
  },
};

export interface ProviderConfig {
  google: boolean;
  facebook: boolean;
  googleClientId: string;
  facebookAppId: string;
}

const NO_PROVIDERS: ProviderConfig = { google: false, facebook: false, googleClientId: '', facebookAppId: '' };

export async function getProvidersApi(): Promise<ProviderConfig> {
  try {
    const response = await fetch('/api/auth/providers');
    if (!response.ok) return NO_PROVIDERS;
    const body = (await response.json()) as ApiResponse<ProviderConfig>;
    return body.success && body.data ? body.data : NO_PROVIDERS;
  } catch {
    return NO_PROVIDERS;
  }
}

async function socialLogin(path: string, payload: Record<string, string>, fallback: string): Promise<LoginResponseData> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as ApiResponse<LoginResponseData>;
  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error || body.message || fallback);
  }
  return body.data;
}

export function loginWithGoogleApi(credential: string): Promise<LoginResponseData> {
  return socialLogin('/api/auth/google', { credential }, 'Đăng nhập Google thất bại.');
}

export function loginWithFacebookApi(accessToken: string): Promise<LoginResponseData> {
  return socialLogin('/api/auth/facebook', { accessToken }, 'Đăng nhập Facebook thất bại.');
}

async function readAuthResponse<T>(response: Response): Promise<Partial<ApiResponse<T>>> {
  const body: unknown = await response.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body)
    ? body as Partial<ApiResponse<T>>
    : {};
}

function authErrorMessage(body: Partial<ApiResponse<unknown>>, fallback: string): string {
  if (typeof body.error === 'string' && body.error) return body.error;
  if (typeof body.message === 'string' && body.message) return body.message;
  return fallback;
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
  return numberFields.every((field) => typeof field === 'number')
    && optionalNumeric
    && typeof user.name === 'string'
    && typeof user.email === 'string'
    && (user.role === 'learner' || user.role === 'admin');
}

export async function loginApi(payload: LoginPayload): Promise<LoginResponseData> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await readAuthResponse<LoginResponseData>(response);
  if (response.ok && body.success === true && typeof body.data?.token === 'string'
    && body.data.token.trim() && isAuthUser(body.data.user)) {
    return body.data;
  }

  const fallback = response.status >= 500 && response.status < 600
    ? `Không thể đăng nhập. Máy chủ không khả dụng (HTTP ${response.status}).`
    : 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.';
  throw new Error(authErrorMessage(body, fallback));
}

export async function registerApi(payload: RegisterPayload): Promise<RegisterResponseData> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await readAuthResponse<RegisterResponseData>(response);
  if (response.ok && body.success === true && isAuthUser(body.data?.user)) {
    return body.data!;
  }

  if (response.status === 409) {
    throw new Error('Email này đã được sử dụng. Vui lòng chọn email khác.');
  }
  const fallback = response.status >= 500 && response.status < 600
    ? `Không thể đăng ký. Máy chủ không khả dụng (HTTP ${response.status}).`
    : 'Đăng ký không thành công.';
  throw new Error(authErrorMessage(body, fallback));
}

export async function changePasswordApi(
  token: string,
  payload: { currentPassword: string; newPassword: string },
): Promise<void> {
  const response = await fetch('/api/auth/password', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as ApiResponse<{ message: string }>;
  if (!response.ok || !body.success) {
    throw new Error(body.error || body.message || 'Không đổi được mật khẩu.');
  }
}

export async function updateProfileApi(
  token: string,
  payload: { name: string; email: string },
): Promise<AuthUser> {
  const response = await fetch('/api/auth/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as ApiResponse<{ user: AuthUser }>;
  if (!response.ok || !body.success || !body.data?.user) {
    throw new Error(body.error || body.message || 'Không lưu được thông tin.');
  }
  return body.data.user;
}

function getCachedUserForToken(token: string): AuthUser | null {
  if (!token || authStorage.getToken() !== token) return null;
  const cachedUser = authStorage.getUser();
  return isAuthUser(cachedUser) ? cachedUser : null;
}

export async function getCurrentUserApi(token: string): Promise<AuthUser> {
  let response: Response;
  try {
    response = await fetch('/api/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    // Only a matching existing session may be used while the network is unavailable.
    const cachedUser = getCachedUserForToken(token);
    if (cachedUser) return cachedUser;
    throw error;
  }

  if (response.status >= 500 && response.status < 600) {
    const cachedUser = getCachedUserForToken(token);
    if (cachedUser) return cachedUser;
  }

  const body = await readAuthResponse<{ user: AuthUser }>(response);
  if (response.ok && body.success === true && isAuthUser(body.data?.user)) {
    return body.data!.user;
  }

  const fallback = response.status >= 500 && response.status < 600
    ? `Không thể xác minh phiên đăng nhập (HTTP ${response.status}).`
    : 'Phiên đăng nhập đã hết hạn.';
  throw new Error(authErrorMessage(body, fallback));
}
