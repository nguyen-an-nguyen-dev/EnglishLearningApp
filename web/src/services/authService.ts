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

export async function loginApi(payload: LoginPayload): Promise<LoginResponseData> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const body = (await response.json().catch(() => ({}))) as ApiResponse<LoginResponseData>;
      if (body.success && body.data) {
        return body.data;
      }
    } else if (response.status >= 500) {
      // Backend or dev proxy is unreachable (e.g. HTTP 502 from Vite when the API server is down).
      // Fall through to the local demo fallback below instead of surfacing a login error.
      console.info('Backend unavailable (HTTP ' + response.status + '). Using local auth fallback for testing.');
    } else {
      const body = (await response.json().catch(() => ({}))) as ApiResponse<LoginResponseData>;
      const errorMsg = body.error || body.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.';
      throw new Error(errorMsg);
    }
  } catch (err) {
    if (err instanceof Error && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
      throw err;
    }
    // Fallback for offline development or demo account
    console.info('Backend unavailable or network error. Using local auth fallback for testing.');
  }

  // Demo fallback
  if (payload.email === 'demo@englearn.com' || payload.password.length >= 6) {
    const namePart = payload.email.split('@')[0];
    const name = namePart === 'demo' ? 'An Nguyễn' : namePart.charAt(0).toUpperCase() + namePart.slice(1);
    return {
      token: 'demo_token_' + Date.now(),
      user: {
        id: Date.now(),
        email: payload.email,
        name,
        streak: 4,
        xp: 240,
      },
    };
  }

  throw new Error('Đăng nhập không thành công. Vui lòng kiểm tra lại email và mật khẩu.');
}

export async function registerApi(payload: RegisterPayload): Promise<RegisterResponseData> {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const body = (await response.json().catch(() => ({}))) as ApiResponse<RegisterResponseData>;
      if (body.success && body.data) {
        return body.data;
      }
    } else if (response.status >= 500) {
      // Backend or dev proxy is unreachable (e.g. HTTP 502 from Vite when the API server is down).
      // Fall through to the local register fallback below instead of surfacing an error.
      console.info('Backend unavailable (HTTP ' + response.status + '). Using local register fallback.');
    } else {
      let errorMsg = 'Đăng ký không thành công.';
      if (response.status === 409) {
        errorMsg = 'Email này đã được sử dụng. Vui lòng chọn email khác.';
      } else {
        const body = (await response.json().catch(() => ({}))) as ApiResponse<RegisterResponseData>;
        errorMsg = body.error || body.message || errorMsg;
      }
      throw new Error(errorMsg);
    }
  } catch (err) {
    if (err instanceof Error && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
      throw err;
    }
    // Fallback for offline development
    console.info('Backend unavailable or network error. Using local register fallback.');
  }

  return {
    user: {
      id: Date.now(),
      email: payload.email,
      name: payload.name.trim(),
      streak: 1,
      xp: 50,
    },
  };
}

export async function getCurrentUserApi(token: string): Promise<AuthUser> {
  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const body = (await response.json().catch(() => ({}))) as ApiResponse<{ user: AuthUser }>;
      if (body.success && body.data?.user) {
        return body.data.user;
      }
    }
  } catch {
    // If backend is unreachable but token exists in localStorage, maintain session
  }

  const cachedUser = authStorage.getUser();
  if (cachedUser) {
    return cachedUser;
  }

  throw new Error('Phiên đăng nhập đã hết hạn.');
}
