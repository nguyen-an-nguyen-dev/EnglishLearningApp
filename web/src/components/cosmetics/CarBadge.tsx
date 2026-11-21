import { useId } from 'react'
import { CarArt } from './CarArt'
import { carSkin } from '../../cosmetics'

export interface CarBadgeProps {
  /** `visual_key` of the equipped car skin; unknown keys fall back to classic. */
  visualKey?: string | null
  /** Admin-defined palette from the shop row. */
  style?: Record<string, string | null> | null
  /** Rendered width in px; height follows the car's own aspect ratio. */
  size?: number
  className?: string
  /** Idle bob/tilt for the En Buddy dock. */
  animated?: boolean
}

/**
 * The roadmap car, reused at UI sizes.
 *
 * This deliberately renders `CarArt` — the exact model that drives the roadmap —
 * so an equipped skin looks identical in the Gara tab, the En Buddy dock/panel
 * and on the map. A second, independently drawn car would drift out of sync
 * whenever the roadmap art changes.
 */
export function CarBadge({ visualKey, style, size = 46, className, animated = false }: CarBadgeProps) {
  const skin = carSkin(visualKey, style)
  // useId keeps the gradient id unique: several badges of the same skin can be
  // on screen at once (dock, panel, tab).
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const glowId = `car-badge-glow-${uid}`

  return (
    <svg
      viewBox="-40 -52 80 112"
      width={size}
      height={Math.round(size * (112 / 80))}
      className={`car-badge${animated ? ' is-animated' : ''}${className ? ` ${className}` : ''}`}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="55%" r="60%">
          <stop offset="0%" stopColor={skin.trail} stopOpacity="0.38" />
          <stop offset="100%" stopColor={skin.trail} stopOpacity="0" />
        </radialGradient>
      </defs>
      <CarArt glowId={glowId} visualKey={visualKey} style={style} />
    </svg>
  )
}
