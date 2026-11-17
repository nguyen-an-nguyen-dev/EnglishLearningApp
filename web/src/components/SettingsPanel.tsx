import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
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
  const [positionedAnchor, setPositionedAnchor] = useState<HTMLElement | null>(null)
  const [opensUp, setOpensUp] = useState(true)
  /* The pointer has to land on the trigger's centre, not a fixed offset: the
     trigger is a gear in the sidebar card on desktop and the header button on
     mobile, and those sit at different distances from the panel edge. */
  const [arrowX, setArrowX] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!anchor) return

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
      // keep the pointer inside the panel's rounded corners
      const triggerCenter = a.left + a.width / 2
      setArrowX(Math.min(Math.max(triggerCenter - clamped, 22), width - 22))
      setPos({ top, left: clamped })
      setOpensUp(openUp)
      setPositionedAnchor(anchor)
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
      className={`settings-panel${opensUp ? '' : ' is-below'}`}
      role="dialog"
      aria-label={t.settings}
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos && positionedAnchor === anchor ? 'visible' : 'hidden',
        ...(arrowX !== null ? { '--settings-arrow-x': `${Math.round(arrowX)}px` } as CSSProperties : null),
      }}
    >
      <LanguagePicker />
      <div className="settings-rule" />
      <ThemePicker />
    </div>
  )
}
