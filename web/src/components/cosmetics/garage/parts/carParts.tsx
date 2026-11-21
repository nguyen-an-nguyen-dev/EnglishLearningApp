import type { ReactNode } from 'react'
import {
  BLUE,
  CAR,
  GOLD,
  HEADLIGHT,
  INK,
  METAL,
  STROKE,
  TAILLIGHT,
  WHITE,
} from '../designTokens'

export interface CarArtProps {
  className?: string
}

/**
 * Shared side-view car parts. Every model composes these; no model redraws a
 * wheel, lamp, bumper or accessory. Parts are authored for 0 0 240 130 with the
 * ground fixed at y=108, nose pointing right.
 */
export function CarSvg({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${CAR.viewWidth} ${CAR.viewHeight}`}
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{label}</title>
      {children}
    </svg>
  )
}

export function GroundShadow({ rx = 92 }: { rx?: number }) {
  return <ellipse cx={120} cy={CAR.ground} rx={rx} ry={5} fill={INK} opacity={0.25} />
}

export function Wheel({
  cx,
  r = CAR.defaultWheelR,
  spokeColor = METAL,
  tread = false,
}: {
  cx: number
  r?: number
  spokeColor?: string
  tread?: boolean
}) {
  const cy = CAR.ground - r
  const rim = r * 0.55
  const hub = 3
  const spokes = [-90, -18, 54, 126, 198].map((angle) => {
    const rad = (angle * Math.PI) / 180
    const inner = hub + 1
    const outer = rim - 1.4
    return (
      <line
        key={angle}
        x1={cx + Math.cos(rad) * inner}
        y1={cy + Math.sin(rad) * inner}
        x2={cx + Math.cos(rad) * outer}
        y2={cy + Math.sin(rad) * outer}
        stroke={INK}
        strokeWidth={STROKE.detail}
        strokeLinecap="round"
      />
    )
  })
  return (
    <g className="car-wheel">
      <circle cx={cx} cy={cy} r={r} fill={INK} />
      {tread && (
        <circle
          cx={cx}
          cy={cy}
          r={r - 2}
          fill="none"
          stroke={METAL}
          strokeWidth={4}
          strokeDasharray="3.2 4.2"
          opacity={0.9}
        />
      )}
      <g className="car-wheel-rim">
        <circle cx={cx} cy={cy} r={rim} fill={spokeColor} stroke={INK} strokeWidth={STROKE.inner} />
        {spokes}
        <circle cx={cx} cy={cy} r={hub} fill={INK} />
        <circle cx={cx - hub * 0.35} cy={cy - hub * 0.35} r={0.8} fill={WHITE} opacity={0.75} />
      </g>
    </g>
  )
}

/** Dark fender crescent: behind the wheel, in front of the body. */
export function WheelArch({ cx, r = CAR.defaultWheelR, fill }: { cx: number; r?: number; fill: string }) {
  const cy = CAR.ground - r
  const radius = r + 4
  return (
    <path
      d={`M${cx - radius} ${cy} A${radius} ${radius} 0 0 1 ${cx + radius} ${cy} Z`}
      fill={fill}
      stroke={INK}
      strokeWidth={STROKE.outer}
      strokeLinejoin="round"
    />
  )
}

export function Window({ d, glass = '#bfe9ff' }: { d: string; glass?: string }) {
  return <path d={d} fill={glass} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
}

export function GlassHighlight({ d }: { d: string }) {
  return <path d={d} fill={WHITE} opacity={0.35} />
}

export function DoorSeam({ d }: { d: string }) {
  return <path d={d} fill="none" stroke={INK} strokeWidth={STROKE.inner} strokeLinecap="round" opacity={0.38} />
}

export function Headlight({ d, fill = HEADLIGHT }: { d: string; fill?: string }) {
  return <path d={d} fill={fill} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
}

export function Taillight({ d, fill = TAILLIGHT }: { d: string; fill?: string }) {
  return <path d={d} fill={fill} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
}

export function Bumper({ d }: { d: string }) {
  return <path d={d} fill={METAL} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
}

export function Mirror({ x, y, fill }: { x: number; y: number; fill: string }) {
  return (
    <path
      d={`M${x} ${y} L${x + 9} ${y - 2} L${x + 10} ${y + 4} L${x + 1} ${y + 6} Z`}
      fill={fill}
      stroke={INK}
      strokeWidth={STROKE.inner}
      strokeLinejoin="round"
    />
  )
}

/** Roof rack with two feet standing on the roof line (y). */
export function RoofRack({ x, y, width, color = METAL }: { x: number; y: number; width: number; color?: string }) {
  const foot = Math.min(18, width * 0.18)
  return (
    <g>
      <path
        d={`M${x + foot} ${y} V${y - 7} M${x + width - foot} ${y} V${y - 7}`}
        fill="none"
        stroke={INK}
        strokeWidth={STROKE.inner}
        strokeLinecap="round"
      />
      <rect x={x} y={y - 12} width={width} height={5} rx={2.5} fill={color} stroke={INK} strokeWidth={STROKE.inner} />
      <path d={`M${x + foot} ${y - 5}H${x + width - foot}`} stroke={INK} strokeWidth={STROKE.detail} opacity={0.55} />
    </g>
  )
}

/** Bolt-on wing with two short struts rising from the boot lid (y). */
export function Spoiler({ x, y, width, fill }: { x: number; y: number; width: number; fill: string }) {
  return (
    <g>
      <path
        d={`M${x + width * 0.22} ${y} V${y - 8} M${x + width * 0.78} ${y} V${y - 8}`}
        fill="none"
        stroke={INK}
        strokeWidth={STROKE.inner}
        strokeLinecap="round"
      />
      <path
        d={`M${x} ${y - 13} H${x + width} L${x + width - 3} ${y - 6} H${x + 3} Z`}
        fill={fill}
        stroke={INK}
        strokeWidth={STROKE.inner}
        strokeLinejoin="round"
      />
      <path d={`M${x + 4} ${y - 11.5}H${x + width - 5}`} stroke={WHITE} strokeWidth={2} opacity={0.35} strokeLinecap="round" />
    </g>
  )
}

/** Mast grows out of the roof line; the ball is attached to the mast. */
export function Antenna({ x, y, color = INK }: { x: number; y: number; color?: string }) {
  return (
    <g>
      <path d={`M${x} ${y} V${y - 21}`} stroke={color} strokeWidth={STROKE.inner} strokeLinecap="round" />
      <circle cx={x} cy={y - 23} r={3} fill={TAILLIGHT} stroke={INK} strokeWidth={STROKE.detail} />
    </g>
  )
}

/** Four-point sparkle used only on legendary art, inside the safe box. */
export function Sparkle({ x, y, r = 5, fill = GOLD }: { x: number; y: number; r?: number; fill?: string }) {
  const inner = r * 0.28
  return (
    <path
      d={`M${x} ${y - r}L${x + inner} ${y - inner}L${x + r} ${y}L${x + inner} ${y + inner}L${x} ${y + r}L${x - inner} ${y + inner}L${x - r} ${y}L${x - inner} ${y - inner}Z`}
      fill={fill}
      stroke={INK}
      strokeWidth={STROKE.detail}
      strokeLinejoin="round"
    />
  )
}

/** Glowing hover pad; its bottom sits 6 units above the ground (y=102). */
export function HoverPad({ x, y = 97.5, rx = 19, ry = 4.5 }: { x: number; y?: number; rx?: number; ry?: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={BLUE} stroke={INK} strokeWidth={STROKE.inner} />
      <ellipse cx={x} cy={y - 1.4} rx={rx * 0.62} ry={ry * 0.45} fill={WHITE} opacity={0.75} />
    </g>
  )
}
