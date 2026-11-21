import { carSkin } from '../../cosmetics'
import type { CarSkin } from '../../cosmetics'

const INK_CHECKER = '#14203A'

export interface CarArtProps {
  /** Gradient id the caller injected into the same <svg>. */
  glowId: string
  /** `visual_key` of the equipped car skin; unknown keys fall back to classic. */
  visualKey?: string | null
  /** Admin-defined palette from the shop row, merged over the base skin. */
  style?: Record<string, string | null> | null
}

/** One wheel block for the top-down sprite; models place four of these. */
function TopWheel({ x, y, skin }: { x: number; y: number; skin: CarSkin }) {
  return <rect x={x - 3} y={y - 8} width={6} height={16} rx={3} fill={skin.wheel} />
}

/**
 * The car that drives the roadmap. Each shop model uses its own silhouette
 * (bonnet length, cabin, wings, wheels) and only shares the palette through
 * `CarSkin`, so a new car is not just a repaint of the yellow one.
 *
 * The sprite is authored for a top-down lane: front at y=-38, tail at y=+34.
 */
export function CarArt({ glowId, visualKey, style }: CarArtProps) {
  const skin = carSkin(visualKey, style)

  return (
    <g className="roadmap-car-body" aria-hidden="true">
      <g className="roadmap-car-trail">
        <path d="M-13 31Q0 40 13 31" fill="none" stroke={skin.trail} strokeWidth="3.5" strokeLinecap="round" opacity=".5" />
        <path d="M-19 40Q0 52 19 40" fill="none" stroke={skin.trail} strokeWidth="2.5" strokeLinecap="round" opacity=".3" />
      </g>
      <ellipse rx="37" ry="46" fill={`url(#${glowId})`} />

      {skin.model === 'sport' && (
        <g>
          <path
            d="M-24-35C-13-41 13-41 24-35L21 20 24 28C12 33-12 33-24 28L-21 20Z"
            fill={skin.body}
            stroke={skin.trim}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <rect x="-28" y="27" width="56" height="7" rx="3" fill={skin.bodyDark} stroke={skin.trim} strokeWidth="2" />
          <path d="M-16-18H16L12-4H-12Z" fill={skin.glass} />
          <path d="M-13 4H13L16 14H-16Z" fill={skin.glassLight} />
          <path d="M0-18V14" stroke="#FFFFFF" strokeWidth="2" opacity=".65" />
          <path d="M-10-35V-20M10-35V-20" stroke={skin.bodyDark} strokeWidth="3" opacity=".8" />
          <TopWheel x={-26} y={-18} skin={skin} />
          <TopWheel x={26} y={-18} skin={skin} />
          <TopWheel x={-26} y={12} skin={skin} />
          <TopWheel x={26} y={12} skin={skin} />
          <path d="M-15-34L-8-31M15-34L8-31" stroke={skin.light} strokeWidth="3" strokeLinecap="round" />
        </g>
      )}

      {skin.model === 'hatch' && (
        <g>
          <rect x="-20" y="-28" width="40" height="56" rx="14" fill={skin.body} stroke={skin.trim} strokeWidth="3" />
          <rect x="-16" y="-30" width="32" height="6" rx="3" fill={skin.bodyDark} stroke={skin.trim} strokeWidth="1.5" />
          <rect x="-16" y="-14" width="32" height="27" rx="8" fill={skin.body} />
          <path d="M-13-11H13L10 0H-10Z" fill={skin.glass} />
          <path d="M-9 5H9L12 14H-12Z" fill={skin.glassLight} />
          <path d="M0-11V14" stroke="#FFFFFF" strokeWidth="2" opacity=".6" />
          <path d="M-19 21H19" stroke={skin.bodyDark} strokeWidth="3" strokeLinecap="round" />
          <TopWheel x={-23} y={-16} skin={skin} />
          <TopWheel x={23} y={-16} skin={skin} />
          <TopWheel x={-23} y={10} skin={skin} />
          <TopWheel x={23} y={10} skin={skin} />
          <rect x="-11" y="-26" width="7" height="4" rx="2" fill={skin.light} />
          <rect x="4" y="-26" width="7" height="4" rx="2" fill={skin.light} />
        </g>
      )}

      {skin.model === 'muscle' && (
        <g>
          <rect x="-25" y="-37" width="50" height="72" rx="14" fill={skin.body} stroke={skin.trim} strokeWidth="3" />
          <rect x="-15" y="-27" width="30" height="14" rx="5" fill={skin.bodyDark} stroke={skin.trim} strokeWidth="2" />
          <path d="M-15-9H15L12 3H-12Z" fill={skin.glass} />
          <path d="M-12 11H12L15 21H-15Z" fill={skin.glassLight} />
          <path d="M0-9V21" stroke="#FFFFFF" strokeWidth="2" opacity=".6" />
          <path d="M-20-37V27M20-37V27" stroke={skin.bodyDark} strokeWidth="4" opacity=".65" />
          <rect x="-28" y="28" width="56" height="6" rx="2" fill={skin.bodyDark} stroke={skin.trim} strokeWidth="2" />
          <TopWheel x={-27} y={-18} skin={skin} />
          <TopWheel x={27} y={-18} skin={skin} />
          <TopWheel x={-27} y={12} skin={skin} />
          <TopWheel x={27} y={12} skin={skin} />
        </g>
      )}

      {skin.model === 'hover' && (
        <g>
          <path
            d="M0-38C15-38 22-28 23-10L21 24C14 32-14 32-21 24L-23-10C-22-28-15-38 0-38Z"
            fill={skin.body}
            stroke={skin.trim}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <ellipse cx="0" cy="-4" rx="15" ry="20" fill={skin.glass} opacity=".92" />
          <path d="M-14-3H14" stroke="#FFFFFF" strokeWidth="2" opacity=".7" />
          <ellipse cx="-24" cy="10" rx="5" ry="14" fill={skin.bodyDark} stroke={skin.trim} strokeWidth="2.4" />
          <ellipse cx="24" cy="10" rx="5" ry="14" fill={skin.bodyDark} stroke={skin.trim} strokeWidth="2.4" />
          <ellipse cx="-12" cy="30" rx="7" ry="3.5" fill={skin.trail} opacity=".9" />
          <ellipse cx="12" cy="30" rx="7" ry="3.5" fill={skin.trail} opacity=".9" />
          <path d="M-18-30H18" stroke={skin.light} strokeWidth="3" strokeLinecap="round" opacity=".9" />
        </g>
      )}

      {skin.model === 'limo' && (
        <g>
          <rect x="-24" y="-44" width="48" height="86" rx="18" fill={skin.body} stroke={skin.trim} strokeWidth="3" />
          <rect x="-16" y="-36" width="32" height="66" rx="12" fill={skin.body} />
          <path d="M-12-30H12L10-20H-10Z" fill={skin.glass} />
          <path d="M-10-14H10L9-6H-9Z" fill={skin.glass} />
          <path d="M-9 0H9L10 8H-10Z" fill={skin.glassLight} />
          <path d="M0-30V8" stroke="#FFFFFF" strokeWidth="2" opacity=".55" />
          <path d="M-18-40V36M18-40V36" stroke={skin.trim} strokeWidth="2" opacity=".65" />
          <circle cx="0" cy="-41" r="3" fill={skin.light} stroke={skin.trim} strokeWidth="1.5" />
          <TopWheel x={-26} y={-22} skin={skin} />
          <TopWheel x={26} y={-22} skin={skin} />
          <TopWheel x={-26} y={18} skin={skin} />
          <TopWheel x={26} y={18} skin={skin} />
        </g>
      )}

      {skin.model === 'taxi' && (
        <g>
          <rect x="-21" y="-33" width="42" height="66" rx="12" fill={skin.body} stroke={skin.trim} strokeWidth="3" />
          <path d="M-14-13H14L11-2H-11Z" fill={skin.glass} />
          <path d="M-11 5H11L14 15H-14Z" fill={skin.glassLight} />
          <path d="M0-13V15" stroke="#FFFFFF" strokeWidth="2" opacity=".6" />
          <rect x="-10" y="-9" width="20" height="8" rx="2" fill="#FFF6D6" stroke={skin.trim} strokeWidth="2" />
          <path d="M-10-9H10M-10-1H10" stroke={skin.bodyDark} strokeWidth="1.4" />
          <g fill={INK_CHECKER}>
            <rect x="-18" y="19" width="4" height="4" /><rect x="-10" y="19" width="4" height="4" />
            <rect x="-2" y="19" width="4" height="4" /><rect x="6" y="19" width="4" height="4" />
            <rect x="14" y="19" width="4" height="4" />
          </g>
          <TopWheel x={-24} y={-18} skin={skin} />
          <TopWheel x={24} y={-18} skin={skin} />
          <TopWheel x={-24} y={12} skin={skin} />
          <TopWheel x={24} y={12} skin={skin} />
          <rect x="-12" y="-31" width="9" height="4" rx="2" fill={skin.light} />
          <rect x="3" y="-31" width="9" height="4" rx="2" fill={skin.light} />
        </g>
      )}

      {skin.model === 'monster' && (
        <g>
          <rect x="-33" y="-25" width="10" height="21" rx="5" fill={skin.wheel} stroke={skin.trim} strokeWidth="2" />
          <rect x="23" y="-25" width="10" height="21" rx="5" fill={skin.wheel} stroke={skin.trim} strokeWidth="2" />
          <rect x="-33" y="14" width="10" height="21" rx="5" fill={skin.wheel} stroke={skin.trim} strokeWidth="2" />
          <rect x="23" y="14" width="10" height="21" rx="5" fill={skin.wheel} stroke={skin.trim} strokeWidth="2" />
          <path d="M-24-21L-18-16M24-21L18-16M-24 28L-18 23M24 28L18 23" stroke={skin.trim} strokeWidth="3" strokeLinecap="round" />
          <rect x="-18" y="-32" width="36" height="62" rx="10" fill={skin.body} stroke={skin.trim} strokeWidth="3" />
          <rect x="-12" y="-10" width="24" height="23" rx="6" fill={skin.bodyDark} />
          <path d="M-10-7H10L8 3H-8Z" fill={skin.glass} />
          <rect x="-9" y="-29" width="18" height="4" rx="2" fill={skin.light} stroke={skin.trim} strokeWidth="1.2" />
          <path d="M-15-25V25M15-25V25" stroke={skin.bodyDark} strokeWidth="3" opacity=".7" />
          <path d="M-12 24H12" stroke={skin.light} strokeWidth="3" strokeLinecap="round" />
        </g>
      )}

      {skin.model === 'formula' && (
        <g>
          <path d="M-25-22H25M-25 19H25" stroke={skin.trim} strokeWidth="3.2" strokeLinecap="round" />
          <rect x="-29" y="-31" width="7" height="17" rx="3" fill={skin.wheel} />
          <rect x="22" y="-31" width="7" height="17" rx="3" fill={skin.wheel} />
          <rect x="-29" y="11" width="7" height="17" rx="3" fill={skin.wheel} />
          <rect x="22" y="11" width="7" height="17" rx="3" fill={skin.wheel} />
          <path d="M0-38C8-38 12-30 12-18L10 26C6 32-6 32-10 26L-12-18C-12-30-8-38 0-38Z" fill={skin.body} stroke={skin.trim} strokeWidth="3" />
          <path d="M-9-16H9L7-4H-7Z" fill={skin.glass} />
          <circle cx="0" cy="-6" r="7" fill="none" stroke={skin.trim} strokeWidth="2.4" />
          <rect x="-26" y="-42" width="52" height="5" rx="2" fill={skin.bodyDark} stroke={skin.trim} strokeWidth="2" />
          <rect x="-24" y="28" width="48" height="6" rx="2" fill={skin.bodyDark} stroke={skin.trim} strokeWidth="2" />
          <path d="M-8 4H8" stroke={skin.light} strokeWidth="3" strokeLinecap="round" opacity=".8" />
        </g>
      )}

      {skin.model === 'jeep' && (
        <g>
          <rect x="-22" y="-34" width="44" height="68" rx="10" fill={skin.body} stroke={skin.trim} strokeWidth="3" />
          <rect x="-16" y="-22" width="32" height="20" rx="4" fill={skin.bodyDark} stroke={skin.trim} strokeWidth="2" />
          <path d="M-13-18H13L10-8H-10Z" fill={skin.glass} />
          <path d="M-14 4H14L16 14H-16Z" fill={skin.glassLight} />
          <path d="M0-18V14" stroke="#FFFFFF" strokeWidth="2" opacity=".55" />
          <rect x="-14" y="-30" width="28" height="5" rx="2" fill="none" stroke={skin.trim} strokeWidth="2" />
          <circle cx="0" cy="33" r="8" fill={skin.wheel} stroke={skin.trim} strokeWidth="2" />
          <TopWheel x={-26} y={-16} skin={skin} />
          <TopWheel x={26} y={-16} skin={skin} />
          <TopWheel x={-26} y={12} skin={skin} />
          <TopWheel x={26} y={12} skin={skin} />
          <rect x="-12" y="-32" width="8" height="4" rx="2" fill={skin.light} />
          <rect x="4" y="-32" width="8" height="4" rx="2" fill={skin.light} />
        </g>
      )}

      {skin.model === 'classic' && (
        <g>
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
      )}
    </g>
  )
}
