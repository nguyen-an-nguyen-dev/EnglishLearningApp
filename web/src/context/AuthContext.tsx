import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  AuthContextType,
} from '../types/auth';
import {
  loginApi,
  registerApi,
  getCurrentUserApi,
  authStorage,
} from '../services/authService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => authStorage.getToken());
  const [user, setUser] = useState<AuthUser | null>(() => authStorage.getUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate session on mount
  useEffect(() => {
    let isMounted = true;
    async function verifySession() {
      const savedToken = authStorage.getToken();
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const freshUser = await getCurrentUserApi(savedToken);
        if (isMounted) {
          setUser(freshUser);
          authStorage.setUser(freshUser);
        }
      } catch (err) {
        console.warn('Session verification failed, logging out:', err);
        if (isMounted) {
          authStorage.clear();
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    verifySession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (credentials: LoginPayload) => {
    setIsLoading(true);
    try {
      const { token: receivedToken, user: receivedUser } = await loginApi(credentials);
      setToken(receivedToken);
      setUser(receivedUser);
      authStorage.setToken(receivedToken);
      authStorage.setUser(receivedUser);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (credentials: RegisterPayload) => {
    setIsLoading(true);
    try {
      await registerApi(credentials);
      // Auto login after successful registration
      const { token: receivedToken, user: receivedUser } = await loginApi({
        email: credentials.email,
        password: credentials.password,
      });
      setToken(receivedToken);
      setUser(receivedUser);
      authStorage.setToken(receivedToken);
      authStorage.setUser(receivedUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authStorage.clear();
    setToken(null);
    setUser(null);
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isLoading,
      login,
      register,
      logout,
    }),
    [user, token, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
