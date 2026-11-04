import { useEffect, useState } from 'react'
import { Moon, Sun } from '@phosphor-icons/react'

export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'engorace_theme'

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

const listeners = new Set<() => void>()

export function setTheme(next: Theme) {
  document.documentElement.dataset.theme = next
  document.documentElement.style.colorScheme = next
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    /* storage blocked, the attribute still applies for this session */
  }
  listeners.forEach((notify) => notify())
}

/**
 * Reads the theme from the document so every control (sidebar, profile) stays
 * in sync without threading a provider through the whole tree.
 */
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

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { isDark, setTheme: apply } = useTheme()

  return (
    <button
      type="button"
      className={`theme-toggle${className ? ' ' + className : ''}`}
      onClick={() => apply(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'}
      aria-pressed={isDark}
      title={isDark ? 'Nền sáng' : 'Nền tối'}
    >
      {isDark ? <Sun size={18} weight="duotone" /> : <Moon size={18} weight="duotone" />}
    </button>
  )
}
