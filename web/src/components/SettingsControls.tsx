import { Check } from '@phosphor-icons/react'
import { useI18n } from '../i18n'
import type { Lang } from '../i18n'
import { useTheme } from './ThemeToggle'
import type { Theme } from './ThemeToggle'

/** Section label with the current value on the right, like a settings block header. */
function GroupHead({ label, value }: { label: string; value?: string }) {
  return (
    <div className="settings-group-head">
      <span className="settings-group-label">{label}</span>
      {value && <span className="settings-group-value">{value}</span>}
    </div>
  )
}

export function LanguagePicker() {
  const { lang, setLang, t } = useI18n()

  const options: { value: Lang; label: string }[] = [
    { value: 'vi', label: t.langVi },
    { value: 'en', label: t.langEn },
  ]

  return (
    <div className="settings-group">
      <GroupHead label={t.language} value={lang.toUpperCase()} />
      <div className="seg-track" role="group" aria-label={t.language}>
        {options.map((option) => {
          const active = option.value === lang
          return (
            <button
              key={option.value}
              type="button"
              className={active ? 'is-active' : undefined}
              aria-pressed={active}
              onClick={() => setLang(option.value)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ThemePicker() {
  const { t } = useI18n()
  const { theme, setTheme } = useTheme()

  const options: { value: Theme; label: string; swatch: string }[] = [
    { value: 'light', label: t.light, swatch: 'theme-swatch-light' },
    { value: 'dark', label: t.dark, swatch: 'theme-swatch-dark' },
  ]

  return (
    <div className="settings-group">
      <GroupHead label={t.appearance} />
      <div className="theme-options" role="group" aria-label={t.appearance}>
        {options.map((option) => {
          const active = option.value === theme
          return (
            <button
              key={option.value}
              type="button"
              className={`theme-option${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => setTheme(option.value)}
            >
              <span className={`theme-swatch ${option.swatch}`} aria-hidden="true" />
              <span>{option.label}</span>
              {active && <Check size={18} weight="bold" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
