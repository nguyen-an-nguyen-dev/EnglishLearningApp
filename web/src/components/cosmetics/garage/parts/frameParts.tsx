import type { ReactNode } from 'react'
import { FRAME, GOLD, INK, ORANGE, STROKE, WHITE } from '../designTokens'
import { arcPath, donutPath, hexPath, onRing, radialWedge } from './frameGeometry'

/** Props every frame component accepts; the shop only needs the letter. */
export interface FrameArtProps {
  letter?: string
  fontSize?: number
  small?: boolean
}

/** Shared frame construction: back → avatar slot → ring → front. */
export function FrameSvg({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${FRAME.view} ${FRAME.view}`}
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{label}</title>
      {children}
    </svg>
  )
}

export function AvatarSlot({ letter = 'K', fontSize = 48 }: { letter?: string; fontSize?: number }) {
  return (
    <g>
      <circle cx={FRAME.cxAvatar} cy={FRAME.avatarY} r={FRAME.avatarR} fill={INK} />
      <text
        x={FRAME.cxAvatar}
        y={FRAME.avatarY + fontSize * 0.35}
        textAnchor="middle"
        fill={WHITE}
        fontFamily="'Be Vietnam Pro', system-ui, sans-serif"
        fontSize={fontSize}
        fontWeight={800}
      >
        {letter}
      </text>
    </g>
  )
}

/** One material ring for every frame. Only outer, colour and optional gold edge change; inner radius 46 and outer 60 (default 54) never do. */
export function Ring({
  outer = FRAME.ringOuter,
  fill,
  dark,
  goldEdge = false,
  tigerStripes = false,
}: {
  outer?: number
  fill: string
  dark: string
  goldEdge?: boolean
  tigerStripes?: boolean
}) {
  const inner = FRAME.ringInner
  const band = outer - inner
  const mid = inner + band / 2
  return (
    <g>
      <path d={donutPath(outer, inner)} fill={fill} fillRule="evenodd" />
      {tigerStripes && [0, 60, 120, 180, 240, 300].map((angle) => (
        <path
          key={angle}
          d={radialWedge(inner + 2, outer - 2, angle - 2.2, angle + 2.2)}
          fill={INK}
          opacity={0.82}
        />
      ))}
      <path
        d={radialWedge(inner + band * 0.18, outer - band * 0.18, 18, 162)}
        fill={dark}
      />
      {goldEdge && (
        <path d={donutPath(outer - 1, outer - 5)} fill={GOLD} fillRule="evenodd" />
      )}
      <path
        d={arcPath(mid, 200, 315)}
        fill="none"
        stroke={WHITE}
        strokeWidth={band * 0.38}
        strokeLinecap="round"
        opacity={0.35}
      />
      <circle cx={FRAME.cxAvatar} cy={FRAME.avatarY} r={outer} fill="none" stroke={INK} strokeWidth={STROKE.outer} />
      <circle cx={FRAME.cxAvatar} cy={FRAME.avatarY} r={inner} fill="none" stroke={INK} strokeWidth={STROKE.inner} />
    </g>
  )
}

export function Bead({ angle, radius = 62, size = 5, fill = GOLD }: { angle: number; radius?: number; size?: number; fill?: string }) {
  const p = onRing(radius, angle)
  return <circle cx={p.x} cy={p.y} r={size} fill={fill} stroke={INK} strokeWidth={STROKE.inner} />
}

export function DecorStar({ angle, radius = 67, r = 7, fill = GOLD }: { angle: number; radius?: number; r?: number; fill?: string }) {
  const p = onRing(radius, angle)
  const inner = r * 0.3
  return (
    <path
      d={`M${p.x} ${p.y - r}L${p.x + inner} ${p.y - inner}L${p.x + r} ${p.y}L${p.x + inner} ${p.y + inner}L${p.x} ${p.y + r}L${p.x - inner} ${p.y + inner}L${p.x - r} ${p.y}L${p.x - inner} ${p.y - inner}Z`}
      fill={fill}
      stroke={INK}
      strokeWidth={STROKE.inner}
      strokeLinejoin="round"
    />
  )
}

export function MascotEye({ x, y, r = 5.2 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={INK} />
      <circle cx={x - r * 0.3} cy={y - r * 0.32} r={r * 0.3} fill={WHITE} />
    </g>
  )
}

export function MascotMouth({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x - 7} ${y}Q${x} ${y + 6} ${x + 7} ${y}`} fill="none" stroke={INK} strokeWidth={STROKE.inner} strokeLinecap="round" />
      <path d={`M${x} ${y + 2}V${y + 5}`} stroke={INK} strokeWidth={STROKE.inner} strokeLinecap="round" />
    </g>
  )
}

export function MascotNose({ x, y, w = 7, h = 5, fill = INK }: { x: number; y: number; w?: number; h?: number; fill?: string }) {
  return (
    <path
      d={`M${x - w} ${y}H${x + w}Q${x} ${y + h * 1.5} ${x - w} ${y}Z`}
      fill={fill}
      stroke={INK}
      strokeWidth={STROKE.detail}
      strokeLinejoin="round"
    />
  )
}

export function MascotWhiskers({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x - 8} ${y}L${x - 20} ${y - 2}M${x - 8} ${y + 4}L${x - 20} ${y + 6}M${x + 8} ${y}L${x + 20} ${y - 2}M${x + 8} ${y + 4}L${x + 20} ${y + 6}`}
      fill="none"
      stroke={INK}
      strokeWidth={STROKE.detail}
      strokeLinecap="round"
      opacity={0.65}
    />
  )
}

export function MascotBeak({ x, y, w = 5, h = 7, fill = ORANGE }: { x: number; y: number; w?: number; h?: number; fill?: string }) {
  return (
    <path
      d={`M${x - w} ${y}L${x + w} ${y}L${x} ${y + h}Z`}
      fill={fill}
      stroke={INK}
      strokeWidth={STROKE.inner}
      strokeLinejoin="round"
    />
  )
}

export function MascotTongue({ x, y }: { x: number; y: number }) {
  return <path d={`M${x - 4} ${y}Q${x} ${y + 7} ${x + 4} ${y}Z`} fill="#ff5a5f" stroke={INK} strokeWidth={STROKE.detail} strokeLinejoin="round" />
}

export function StarPt({ x, y, r = 5, fill = GOLD }: { x: number; y: number; r?: number; fill?: string }) {
  const inner = Math.round(r * 3) / 10
  const rx = Math.round(x * 10) / 10
  const ry = Math.round(y * 10) / 10
  const f = (n: number) => Math.round(n * 10) / 10
  return (
    <path
      d={`M${rx} ${f(ry - r)}L${f(rx + inner)} ${f(ry - inner)}L${f(rx + r)} ${ry}L${f(rx + inner)} ${f(ry + inner)}L${rx} ${f(ry + r)}L${f(rx - inner)} ${f(ry + inner)}L${f(rx - r)} ${ry}L${f(rx - inner)} ${f(ry - inner)}Z`}
      fill={fill}
      stroke={INK}
      strokeWidth={STROKE.inner}
      strokeLinejoin="round"
    />
  )
}

/** Small three-point crown standing on the head at y. */
export function Crown({ x, y, width = 30, fill = GOLD }: { x: number; y: number; width?: number; fill?: string }) {
  const half = width / 2
  return (
    <g>
      <path
        d={`M${x - half} ${y}L${x - half + 3} ${y - 10}L${x - half * 0.4} ${y - 4}L${x} ${y - 13}L${x + half * 0.4} ${y - 4}L${x + half - 3} ${y - 10}L${x + half} ${y}Z`}
        fill={fill}
        stroke={INK}
        strokeWidth={STROKE.inner}
        strokeLinejoin="round"
      />
      <path d={`M${x - half} ${y}H${x + half}V${y + 4}H${x - half}Z`} fill={fill} stroke={INK} strokeWidth={STROKE.inner} />
      <circle cx={x} cy={y - 5} r={2} fill="#ff5a5f" stroke={INK} strokeWidth={1.5} />
      <circle cx={x - half * 0.55} cy={y - 3} r={1.4} fill={WHITE} />
      <circle cx={x + half * 0.55} cy={y - 3} r={1.4} fill={WHITE} />
    </g>
  )
}

/** Filled hexagonal band hugging the ring; used by prism/neon frames. */
export function HexBand({ outer = 68, inner = 62, fill }: { outer?: number; inner?: number; fill: string }) {
  return (
    <g>
      <path d={`${hexPath(outer)}${hexPath(inner)}`} fill={fill} fillRule="evenodd" />
      <path d={hexPath(outer)} fill="none" stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d={hexPath(inner)} fill="none" stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
    </g>
  )
}

export function Blossom({ x, y, scale = 1, petal = '#f2a7c3', core = GOLD }: { x: number; y: number; scale?: number; petal?: string; core?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill={petal} stroke={INK} strokeWidth={STROKE.inner}>
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse key={angle} cx={0} cy={-8} rx={5.2} ry={8} transform={angle ? `rotate(${angle})` : undefined} />
      ))}
      <circle r={3.4} fill={core} strokeWidth={1.5} />
    </g>
  )
}

export function Bubble({ angle, radius = 64, size = 6 }: { angle: number; radius?: number; size?: number }) {
  const p = onRing(radius, angle)
  return (
    <g>
      <circle cx={p.x} cy={p.y} r={size} fill="#bfe9ff" stroke={INK} strokeWidth={STROKE.inner} />
      <circle cx={p.x - size * 0.3} cy={p.y - size * 0.32} r={size * 0.22} fill={WHITE} />
    </g>
  )
}

export function NeonBolt({ angle, radius = 66, size = 1, fill = '#19b6f0' }: { angle: number; radius?: number; size?: number; fill?: string }) {
  const p = onRing(radius, angle)
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${angle + 90}) scale(${size})`}>
      <path d="M-3 -8L4 -8L1 -1L6 -1L-2 8L-1 2L-5 2Z" fill={fill} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
    </g>
  )
}

/** Ring-only small variant: same material, plus the avatar slot it wraps. */
export function SmallRing({
  outer = FRAME.ringOuter,
  fill,
  dark,
  goldEdge = false,
  letter = 'K',
  fontSize = 48,
  label = 'Khung avatar cỡ nhỏ',
}: {
  outer?: number
  fill: string
  dark: string
  goldEdge?: boolean
  letter?: string
  fontSize?: number
  label?: string
}) {
  return (
    <FrameSvg label={label}>
      <AvatarSlot letter={letter} fontSize={fontSize} />
      <Ring outer={outer} fill={fill} dark={dark} goldEdge={goldEdge} />
    </FrameSvg>
  )
}
