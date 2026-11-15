import { Moon, Sun } from '@phosphor-icons/react'
import { useTheme } from '../theme'

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
