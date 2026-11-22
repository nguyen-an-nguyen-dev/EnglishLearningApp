import React, { createContext, useCallback, useContext, useEffect, useState, useMemo } from 'react';
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  AuthContextType,
  StartRegistrationResult,
  VerifyRegistrationPayload,
} from '../types/auth';
import {
  loginApi,
  startRegistrationApi,
  verifyRegistrationApi,
  resendRegistrationOtpApi,
  getCurrentUserApi,
  loginWithGoogleApi,
  loginWithFacebookApi,
  changePasswordApi,
  updateProfileApi,
  uploadAvatarApi,
  authStorage,
} from '../services/authService';
import { SESSION_EXPIRED_EVENT } from '../services/apiClient';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => authStorage.getToken());
  const [user, setUser] = useState<AuthUser | null>(() => authStorage.getUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

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

  const loginWithProvider = async (provider: 'google' | 'facebook', token: string) => {
    setIsLoading(true);
    try {
      const { token: receivedToken, user: receivedUser } =
        provider === 'google'
          ? await loginWithGoogleApi(token)
          : await loginWithFacebookApi(token);
      setToken(receivedToken);
      setUser(receivedUser);
      authStorage.setToken(receivedToken);
      authStorage.setUser(receivedUser);
    } finally {
      setIsLoading(false);
    }
  };

  const startRegistration = async (
    credentials: RegisterPayload,
  ): Promise<StartRegistrationResult> => startRegistrationApi(credentials);

  const resendRegistrationOtp = (email: string): Promise<StartRegistrationResult> =>
    resendRegistrationOtpApi(email);

  const verifyRegistration = async (payload: VerifyRegistrationPayload) => {
    setIsLoading(true);
    try {
      const { token: receivedToken, user: receivedUser } = await verifyRegistrationApi(payload);
      setToken(receivedToken);
      setUser(receivedUser);
      authStorage.setToken(receivedToken);
      authStorage.setUser(receivedUser);
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = useCallback(async (payload: { currentPassword: string; newPassword: string }) => {
    if (!token) throw new Error('Bạn cần đăng nhập lại.');
    await changePasswordApi(token, payload);
  }, [token]);

  const updateProfile = useCallback(async (payload: { name: string; email: string }) => {
    if (!token) throw new Error('Bạn cần đăng nhập lại.');
    const updated = await updateProfileApi(token, payload);
    setUser(updated);
    authStorage.setUser(updated);
  }, [token]);

  const uploadAvatar = useCallback(async (file: File, onProgress?: (percent: number) => void) => {
    if (!token) throw new Error('You need to sign in again.');
    const updated = await uploadAvatarApi(token, file, onProgress);
    setUser(updated);
    authStorage.setUser(updated);
  }, [token]);

  const refreshUser = useCallback(async () => {
    const savedToken = authStorage.getToken();
    if (!savedToken) return;
    try {
      const freshUser = await getCurrentUserApi(savedToken);
      setUser(freshUser);
      authStorage.setUser(freshUser);
    } catch {
      // Silent refresh is best-effort; the next login or reload will retry.
    }
  }, []);

  const logout = () => {
    authStorage.clear();
    setToken(null);
    setUser(null);
  };

  // A 401 means the stored token is no longer accepted (expired or invalidated by a
  // restart that rotated the signing secret), so drop the session.
  useEffect(() => {
    const onExpired = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isLoading,
      login,
      loginWithProvider,
      startRegistration,
      verifyRegistration,
      resendRegistrationOtp,
      changePassword,
      updateProfile,
      uploadAvatar,
      refreshUser,
      logout,
    }),
    [user, token, isLoading, refreshUser, changePassword, updateProfile, uploadAvatar],
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
