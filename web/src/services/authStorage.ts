import type { AuthUser } from '../types/auth';

const TOKEN_KEY = 'englearn_token';
const USER_KEY = 'englearn_user';

/** Own module so the API client can read a token without importing the auth service. */
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
    } catch (error) {
      console.warn('Failed to save token to localStorage', error);
    }
  },

  removeToken(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.warn('Failed to remove token from localStorage', error);
    }
  },

  getUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) as AuthUser : null;
    } catch {
      return null;
    }
  },

  setUser(user: AuthUser): void {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.warn('Failed to save user to localStorage', error);
    }
  },

  removeUser(): void {
    try {
      localStorage.removeItem(USER_KEY);
    } catch (error) {
      console.warn('Failed to remove user from localStorage', error);
    }
  },

  clear(): void {
    authStorage.removeToken();
    authStorage.removeUser();
  },
};
