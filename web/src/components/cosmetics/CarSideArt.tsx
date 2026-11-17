import { carSkin } from '../../cosmetics'
import type { CarSkin } from '../../cosmetics'

/**
 * Side profile of the same car the roadmap drives, drawn from one `CarSkin` so
 * the Gara shows a shape a learner can actually recognise as *that* car.
 *
 * The roadmap uses a top-down sprite (it drives up a lane), which reads as a
 * narrow rectangle in a shop card. A wide landscape preview needs the profile
 * view: long bonnet, cabin behind the front wheels, spoiler at the tail.
 *
 * Geometry is authored around a 200×100 box, ground line at y=38, so the art
 * scales cleanly from a 72px shelf thumbnail to a full-width card banner.
 */

/**
 * Shared wheel so both axles stay identical; rims read at 32px and at 200px.
 *
 * The rim is its own group with spokes, so a parent can spin `.car-wheel-rim`
 * and have the wheel visibly roll. CSS gives that group `transform-origin:
 * center` with `transform-box: fill-box`: the rim's own bounding box is
 * centred on the axle, so it turns in place instead of orbiting a stray point.
 */
function Wheel({ cx, skin }: { cx: number; skin: CarSkin }) {
  return (
    <g>
      <circle cx={cx} cy={26} r={15} fill={skin.wheel} />
      <circle cx={cx} cy={26} r={15} fill="none" stroke={skin.trim} strokeWidth={2} opacity={0.5} />
      <g className="car-wheel-rim">
        {/* Steel rim: a light disc is what makes the spokes readable at 30px, so
            the roll is visible in the Gara bay and on a shop card. */}
        <circle cx={cx} cy={26} r={7.5} fill="#e2eaf3" />
        <circle cx={cx} cy={26} r={7.5} fill="none" stroke={skin.trim} strokeWidth={1.6} opacity={0.8} />
        <g stroke={skin.trim} strokeWidth={1.7} strokeLinecap="round" opacity={0.6}>
          <path d={`M${cx} 19.6 L${cx} 32.4`} />
          <path d={`M${cx - 6.4} 26 L${cx + 6.4} 26`} />
          <path d={`M${cx - 4.5} 21.5 L${cx + 4.5} 30.5`} />
          <path d={`M${cx + 4.5} 21.5 L${cx - 4.5} 30.5`} />
        </g>
        <circle cx={cx} cy={26} r={2.6} fill={skin.trim} opacity={0.85} />
      </g>
    </g>
  )
}

export interface CarSideArtProps {
  visualKey?: string | null
  /** Unique per instance: both gradients need their own id inside one document. */
  idPrefix: string
}

export function CarSideArt({ visualKey, idPrefix }: CarSideArtProps) {
  const skin = carSkin(visualKey)
  const bodyId = `${idPrefix}-body`

  return (
    <g className="car-side-body" aria-hidden="true">
      <defs>
        <linearGradient id={bodyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={skin.body} />
          <stop offset="62%" stopColor={skin.body} />
          <stop offset="100%" stopColor={skin.bodyDark} />
        </linearGradient>
      </defs>

      {/* No ground glow, lamp spill or speed streaks: the shop preview is only
          the car, so nothing competes with the garage doorway behind it. */}

      {/* Ducktail lip instead of a bolt-on wing: at card size a wing on struts
          read as a floating bar, while a lip keeps the silhouette clean. */}
      <path
        d="M-93 6 C-94 -2 -88 -6 -79 -6 L-70 -6 L-68 -1 L-80 0 C-86 1 -89 3 -89 7 Z"
        fill={skin.bodyDark}
        stroke={skin.trim}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />

      {/* Chassis: long nose to the right, short tail to the left. */}
      <path
        d="M-90 12 C-92 2 -86 -6 -74 -8 L-46 -10 C-38 -26 -26 -32 -8 -32
           L16 -32 C32 -32 40 -26 46 -10 L72 -6 C88 -3 94 4 92 14
           L90 18 C90 22 86 24 82 24 L-82 24 C-88 24 -91 20 -90 12 Z"
        fill={`url(#${bodyId})`}
        stroke={skin.trim}
        strokeWidth={3}
        strokeLinejoin="round"
      />

      {/* Cabin glass, split by the B-pillar. */}
      <path
        d="M-42 -12 C-35 -24 -25 -29 -10 -29 L14 -29 C28 -29 36 -24 41 -12 Z"
        fill={skin.glass}
        stroke={skin.trim}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path d="M-4 -28 L-4 -12" stroke={skin.trim} strokeWidth={2.5} opacity={0.85} />
      {/* Windscreen highlight: one crisp band, not a gradient wash. */}
      <path d="M12 -27 L26 -27 L33 -14 L20 -14 Z" fill={skin.glassLight} opacity={0.55} />

      {/* Bottom skirt shadow reads as ground clearance. */}
      <path
        d="M-82 20 C-40 26 40 26 82 20 L82 23 C40 28 -40 28 -82 23 Z"
        fill={skin.bodyDark}
        opacity={0.55}
      />

      {/* Headlight at the nose, tail light at the spoiler end. */}
      <path d="M84 2 L92 6 L91 12 L84 10 Z" fill={skin.light} stroke={skin.trim} strokeWidth={2} strokeLinejoin="round" />
      <path d="M-90 4 L-84 3 L-84 10 L-90 10 Z" fill={skin.trail} stroke={skin.trim} strokeWidth={2} strokeLinejoin="round" />

      {/* Door seam + side stripe give the flat body some scale. */}
      <path d="M-18 5 L-18 21" stroke={skin.trim} strokeWidth={2} opacity={0.35} />
      <path d="M-24 12 L50 12" stroke={skin.bodyDark} strokeWidth={3} opacity={0.45} strokeLinecap="round" />

      <Wheel cx={-52} skin={skin} />
      <Wheel cx={50} skin={skin} />
    </g>
  )
}

export interface CarSidePreviewProps {
  visualKey?: string | null
  className?: string
}

/** Wide 2:1 preview used by the Gara cards and the garage bay. */
export function CarSidePreview({ visualKey, className }: CarSidePreviewProps) {
  const idPrefix = `car-side-${(visualKey ?? 'default').replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg
      className={className}
      viewBox="-124 -40 232 92"
      role="img"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <CarSideArt visualKey={visualKey} idPrefix={idPrefix} />
    </svg>
  )
}
