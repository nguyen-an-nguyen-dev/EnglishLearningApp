import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { LanguagePicker, ThemePicker } from './SettingsControls'

interface SettingsPanelProps {
  /** The button the panel hangs off. `null` keeps the panel closed. */
  anchor: HTMLElement | null
  onClose: () => void
}

const GAP = 10
const EDGE = 12

export function SettingsPanel({ anchor, onClose }: SettingsPanelProps) {
  const { t } = useI18n()
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!anchor) {
      setPos(null)
      return
    }

    const place = () => {
      const panel = panelRef.current
      if (!panel) return
      const a = anchor.getBoundingClientRect()
      const { width, height } = panel.getBoundingClientRect()
      // above the trigger when there is room, otherwise below it
      const openUp = a.top - height - GAP > EDGE
      const top = openUp ? a.top - height - GAP : a.bottom + GAP
      // a wide trigger anchors on its left edge; a small icon button anchors on its right
      const left = a.width < 120 ? a.right - width : a.left
      const clamped = Math.min(Math.max(left, EDGE), window.innerWidth - width - EDGE)
      setPos({ top, left: clamped })
    }

    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchor])

  useEffect(() => {
    if (!anchor) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || anchor.contains(target)) return
      onClose()
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [anchor, onClose])

  if (!anchor) return null

  return (
    <div
      ref={panelRef}
      className="settings-panel"
      role="dialog"
      aria-label={t.settings}
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      <LanguagePicker />
      <div className="settings-rule" />
      <ThemePicker />
    </div>
  )
}
