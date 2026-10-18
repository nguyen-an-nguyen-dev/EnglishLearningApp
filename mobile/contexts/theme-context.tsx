import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

export type AppTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: AppTheme;
  isDark: boolean;
  isLoading: boolean;
  error: string | null;
  setTheme: (theme: AppTheme) => Promise<void>;
}

const THEME_STORAGE_KEY = 'english-learning.theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

async function readSavedTheme(): Promise<AppTheme> {
  const value = Platform.OS === 'web'
    ? globalThis.localStorage?.getItem(THEME_STORAGE_KEY) ?? null
    : await SecureStore.getItemAsync(THEME_STORAGE_KEY);
  return value === 'dark' ? 'dark' : 'light';
}

async function saveTheme(theme: AppTheme): Promise<void> {
  if (Platform.OS === 'web') {
    if (!globalThis.localStorage) throw new Error('Theme preferences are unavailable in this browser.');
    globalThis.localStorage.setItem(THEME_STORAGE_KEY, theme);
    return;
  }
  await SecureStore.setItemAsync(THEME_STORAGE_KEY, theme);
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('light');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void readSavedTheme()
      .then((savedTheme) => {
        if (mounted) setThemeState(savedTheme);
      })
      .catch((storageError: unknown) => {
        console.error('Failed to load theme preference:', storageError);
        if (mounted) setError('Không thể tải giao diện đã lưu. Bạn vẫn có thể đổi giao diện trong Cài đặt.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const setTheme = useCallback(async (nextTheme: AppTheme) => {
    try {
      await saveTheme(nextTheme);
      setThemeState(nextTheme);
      setError(null);
    } catch (storageError) {
      console.error('Failed to save theme preference:', storageError);
      const message = 'Không thể lưu lựa chọn giao diện. Vui lòng thử lại.';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const value = useMemo(() => ({
    theme,
    isDark: theme === 'dark',
    isLoading,
    error,
    setTheme,
  }), [theme, isLoading, error, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme must be used inside AppThemeProvider.');
  return context;
}
