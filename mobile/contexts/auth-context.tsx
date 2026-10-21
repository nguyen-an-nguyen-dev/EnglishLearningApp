import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import { readToken, removeToken, request, writeToken } from '@/services/api';

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
  updateProfile: (name: string, email: string) => Promise<AuthUser>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const data = await request<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await writeToken(data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string): Promise<AuthUser> => {
    await request<{ user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    return login(email, password);
  }, [login]);

  const logout = useCallback(async (): Promise<void> => {
    await removeToken();
    setToken(null);
    setUser(null);
  }, []);

  const getCurrentUser = useCallback(async (): Promise<AuthUser | null> => {
    if (!token) return null;
    const data = await request<{ user: AuthUser }>('/auth/me', {}, token);
    setUser(data.user);
    return data.user;
  }, [token]);

  const updateProfile = useCallback(async (name: string, email: string): Promise<AuthUser> => {
    const data = await request<{ user: AuthUser }>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name, email }),
    });
    setUser(data.user);
    return data.user;
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<void> => {
    await request<{ message: string }>('/auth/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    isLoading,
    register,
    login,
    logout,
    getCurrentUser,
    updateProfile,
    changePassword,
  }), [user, token, isLoading, register, login, logout, getCurrentUser, updateProfile, changePassword]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}