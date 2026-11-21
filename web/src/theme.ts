import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'engorace_theme'

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

/** The theme the app would use outside the light-only landing. */
export function readPreferredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    /* fall back to the OS preference */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function paintCanvas(theme: Theme) {
  document.documentElement.style.background = theme === 'dark' ? '#0E1720' : '#F2FAFD'
}

const listeners = new Set<() => void>()

export function setTheme(next: Theme) {
  document.documentElement.dataset.theme = next
  document.documentElement.style.colorScheme = next
  paintCanvas(next)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    /* storage blocked, the attribute still applies for this session */
  }
  listeners.forEach((notify) => notify())
}

/** Reads the theme from the document so every control stays in sync without a provider. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readTheme)

  useEffect(() => {
    const sync = () => setThemeState(readTheme())
    listeners.add(sync)
    return () => {
      listeners.delete(sync)
    }
  }, [])

  const apply = (next: Theme) => {
    setTheme(next)
    setThemeState(next)
  }

  return { theme, isDark: theme === 'dark', setTheme: apply }
}
