import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  xp: number;
  streak: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  register: (name: string, email: string, password: string) => Promise<AuthUser>;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<AuthUser | null>;
}

interface ApiEnvelope<T> {
  success: true;
  data: T;
}

interface ApiError {
  message?: string;
  errors?: string[];
}

const TOKEN_KEY = 'english-learning.auth-token';
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');
const AuthContext = createContext<AuthContextValue | null>(null);
let webToken: string | null = null;

async function readToken(): Promise<string | null> {
  return Platform.OS === 'web' ? webToken : SecureStore.getItemAsync(TOKEN_KEY);
}

async function writeToken(token: string): Promise<void> {
  if (Platform.OS === 'web') webToken = token;
  else await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function removeToken(): Promise<void> {
  if (Platform.OS === 'web') webToken = null;
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error('Cannot reach the server. Check the API address and connection.');
  }

  const body = await response.json() as ApiEnvelope<T> | ApiError;
  if (!response.ok || !('success' in body)) {
    const apiError = body as ApiError;
    const detail = apiError.errors?.length ? ` ${apiError.errors.join(' ')}` : '';
    throw new Error(`${apiError.message || 'Request failed.'}${detail}`);
  }
  return body.data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const savedToken = await readToken();
      if (savedToken) {
        try {
          const data = await request<{ user: AuthUser }>('/auth/me', {}, savedToken);
          if (mounted) {
            setToken(savedToken);
            setUser(data.user);
          }
        } catch {
          await removeToken();
        }
      }
      if (mounted) setIsLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  async function login(email: string, password: string): Promise<AuthUser> {
    const data = await request<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await writeToken(data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(name: string, email: string, password: string): Promise<AuthUser> {
    await request<{ user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    return login(email, password);
  }

  async function logout(): Promise<void> {
    await removeToken();
    setToken(null);
    setUser(null);
  }

  async function getCurrentUser(): Promise<AuthUser | null> {
    if (!token) return null;
    const data = await request<{ user: AuthUser }>('/auth/me', {}, token);
    setUser(data.user);
    return data.user;
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, register, login, logout, getCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}