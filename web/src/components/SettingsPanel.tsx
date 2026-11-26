import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import { useI18n } from '../i18n'
import { LanguagePicker, ThemeSwitch } from './SettingsControls'

interface SettingsPanelProps {
  anchor: HTMLElement | null
  buddyEnabled: boolean
  onBuddyToggle: (enabled: boolean) => void
  onClose: () => void
}

const GAP = 8
const EDGE = 12

export function SettingsPanel({
  anchor, buddyEnabled, onBuddyToggle, onClose,
}: SettingsPanelProps) {
  const { t } = useI18n()
  const titleId = useId()
  const switchLabelId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean; anchor: HTMLElement } | null>(null)

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!anchor || !panel) return

    const place = () => {
      const trigger = anchor.getBoundingClientRect()
      const { offsetWidth: width, offsetHeight: height } = panel
      const topAbove = trigger.top - height - GAP
      const below = trigger.bottom + GAP
      const above = topAbove >= EDGE
      const preferred = above ? topAbove : below
      const top = Math.max(EDGE, Math.min(preferred, window.innerHeight - height - EDGE))
      const left = Math.max(EDGE, Math.min(trigger.right - width, window.innerWidth - width - EDGE))
      setPos({ top, left, above, anchor })
    }

    place()
    const observer = new ResizeObserver(place)
    observer.observe(panel)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor])

  useEffect(() => {
    if (anchor) panelRef.current?.focus({ preventScroll: true })
  }, [anchor])

  useEffect(() => {
    if (!anchor) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      onClose()
      anchor.focus()
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || anchor.contains(target)) return
      onClose()
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={panelRef}
      className="settings-panel"
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-open={anchor !== null}
      data-side={pos?.above ? 'above' : 'below'}
      inert={!anchor}
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: anchor && pos?.anchor !== anchor ? 'hidden' : undefined,
      }}
    >
      <header className="settings-heading">
        <h2 id={titleId}>{t.settings}</h2>
        <button
          className="settings-close"
          type="button"
          aria-label={t.closeSettings}
          onClick={() => {
            onClose()
            anchor?.focus()
          }}
        >
          <X size={16} />
        </button>
      </header>
      <LanguagePicker />
      <ThemeSwitch />
      <div className="settings-row">
        <span className="settings-label" id={switchLabelId}>{t.buddyDockLabel}</span>
        <button
          className="settings-switch"
          type="button"
          role="switch"
          aria-labelledby={switchLabelId}
          aria-checked={buddyEnabled}
          onClick={() => onBuddyToggle(!buddyEnabled)}
        >
          <span aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body,
  )
}
