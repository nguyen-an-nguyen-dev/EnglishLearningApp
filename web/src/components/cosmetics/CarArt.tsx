import { DEFAULT_CAR_SKIN, carSkin } from '../../cosmetics'

export interface CarArtProps {
  /** Gradient id the caller injected into the same <svg>. */
  glowId: string
  /** `visual_key` of the equipped car skin; unknown keys fall back to classic. */
  visualKey?: string | null
}

/**
 * The car that drives the roadmap, drawn procedurally from a skin so every
 * shop car reuses one geometry. The default skin reproduces the original
 * yellow car exactly, so nothing shifts for learners who own nothing.
 */
export function CarArt({ glowId, visualKey }: CarArtProps) {
  const skin = visualKey ? carSkin(visualKey) : DEFAULT_CAR_SKIN
  return (
    <g className="roadmap-car-body" aria-hidden="true">
      <g className="roadmap-car-trail">
        <path d="M-13 31Q0 40 13 31" fill="none" stroke={skin.trail} strokeWidth="3.5" strokeLinecap="round" opacity=".5" />
        <path d="M-19 40Q0 52 19 40" fill="none" stroke={skin.trail} strokeWidth="2.5" strokeLinecap="round" opacity=".3" />
      </g>
      <ellipse rx="37" ry="46" fill={`url(#${glowId})`} />
      <ellipse cx="0" cy="5" rx="20" ry="34" fill={skin.bodyDark} opacity=".22" />
      <rect x="-22" y="-34" width="44" height="68" rx="16" fill={skin.body} stroke={skin.trim} strokeWidth="3" />
      <rect x="-17" y="-18" width="34" height="37" rx="10" fill={skin.body} />
      <path d="M-14-15H14L11-3H-11Z" fill={skin.glass} />
      <path d="M-11 7H11L14 17H-14Z" fill={skin.glassLight} />
      <path d="M0-15V17" stroke="#FFFFFF" strokeWidth="2" opacity=".65" />
      <rect x="-25" y="-21" width="6" height="16" rx="3" fill={skin.wheel} />
      <rect x="19" y="-21" width="6" height="16" rx="3" fill={skin.wheel} />
      <rect x="-25" y="8" width="6" height="16" rx="3" fill={skin.wheel} />
      <rect x="19" y="8" width="6" height="16" rx="3" fill={skin.wheel} />
      <rect x="-12" y="-32" width="8" height="4" rx="2" fill={skin.light} />
      <rect x="4" y="-32" width="8" height="4" rx="2" fill={skin.light} />
    </g>
  )
}

/**
 * Standalone top-down car tile for the shop preview. Same geometry as the
 * roadmap car, sized to fill a square with its own gradient.
 */
export function CarPreview({ visualKey, size = 132 }: { visualKey?: string | null; size?: number }) {
  const skin = carSkin(visualKey)
  const glowId = `car-preview-glow-${(visualKey ?? 'default').replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg viewBox="-60 -70 120 160" width={size} height={size} role="img" aria-hidden="true">
      <defs>
        <radialGradient id={glowId} cx="50%" cy="55%" r="60%">
          <stop offset="0%" stopColor={skin.trail} stopOpacity="0.42" />
          <stop offset="100%" stopColor={skin.trail} stopOpacity="0" />
        </radialGradient>
      </defs>
      <CarArt glowId={glowId} visualKey={visualKey} />
    </svg>
  )
}
