import { Moon, Sun } from '@phosphor-icons/react'
import { useId } from 'react'
import { useI18n, type Lang } from '../i18n'
import { useTheme } from '../theme'

export function LanguagePicker() {
  const { lang, setLang, t } = useI18n()
  const options: { value: Lang; label: string }[] = [
    { value: 'vi', label: t.langVi },
    { value: 'en', label: t.langEn },
  ]

  return (
    <div className="settings-row">
      <span className="settings-label">{t.language}</span>
      <div className="settings-options" role="group" aria-label={t.language}>
        {options.map(({ value, label }) => (
          <button key={value} type="button" aria-pressed={value === lang} onClick={() => setLang(value)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ThemeSwitch() {
  const { t } = useI18n()
  const { isDark, setTheme } = useTheme()
  const labelId = useId()
  const Icon = isDark ? Moon : Sun

  return (
    <div className="settings-row">
      <span className="settings-label" id={labelId}>{t.dark}</span>
      <button
        className="settings-switch settings-theme-switch"
        type="button"
        role="switch"
        aria-labelledby={labelId}
        aria-checked={isDark}
        title={isDark ? t.dark : t.light}
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
      >
        <span aria-hidden="true"><Icon size={10} weight="bold" /></span>
      </button>
    </div>
  )
}
