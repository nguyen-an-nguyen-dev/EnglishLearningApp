import { GOLD, INK, ORANGE, STROKE, WHITE } from '../designTokens'
import {
  AvatarSlot,
  Bead,
  FrameSvg,
  MascotEye,
  MascotMouth,
  SmallRing,
  Ring,
} from '../parts/frameParts'
import { onRing } from '../parts/frameGeometry'
import type { FrameArtProps } from '../parts/frameParts'

const paint = {
  ring: ORANGE,
  dark: '#d97b17',
  fur: ORANGE,
  furDark: '#c26a12',
  cream: '#fff7e6',
}

function TigerBack() {
  return (
    <g>
      <circle cx={80} cy={26} r={9} fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} />
      <circle cx={120} cy={26} r={9} fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} />
      <circle cx={80} cy={26} r={4.5} fill={GOLD} />
      <circle cx={120} cy={26} r={4.5} fill={GOLD} />
      <path
        d="M72 40C72 25 83 16 100 16C117 16 128 25 128 40C128 51 122 60 112 64C106 66 94 66 88 64C78 60 72 51 72 40Z"
        fill={paint.fur}
        stroke={INK}
        strokeWidth={STROKE.outer}
        strokeLinejoin="round"
      />
      <path d="M96 18L100 27L104 18Z" fill={paint.furDark} />
      <path d="M85 19L88 27L92 19Z" fill={paint.furDark} />
      <path d="M108 19L112 27L115 19Z" fill={paint.furDark} />
      <path d="M72 35L83 39L72 43Z" fill={paint.furDark} />
      <path d="M128 35L117 39L128 43Z" fill={paint.furDark} />
      <path d="M73 47L82 49L75 53Z" fill={paint.furDark} />
      <path d="M127 47L118 49L125 53Z" fill={paint.furDark} />
      <path d="M82 22C87 18 93 17 99 17" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <ellipse cx={100} cy={52} rx={16} ry={10} fill={paint.cream} stroke={INK} strokeWidth={STROKE.inner} />
      <MascotEye x={88} y={37} />
      <MascotEye x={112} y={37} />
      <path d="M94 47H106L100 53Z" fill={INK} strokeLinejoin="round" />
      <MascotMouth x={100} y={55} />
      <path d="M84 52L74 50M84 56L75 57M116 52L126 50M116 56L125 57" stroke={INK} strokeWidth={STROKE.detail} strokeLinecap="round" opacity={0.6} />
    </g>
  )
}

function TigerPaw({ angle, upper = false }: { angle: number; upper?: boolean }) {
  const p = onRing(upper ? 57 : 59, angle)
  const rot = upper ? (angle < 270 ? 28 : -28) : (angle > 90 ? -18 : 18)
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${rot})`}>
      <ellipse rx={upper ? 9 : 10} ry={upper ? 7 : 8} fill={paint.fur} stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M-4 -1V3M0 -2V3M4 -1V3" stroke={INK} strokeWidth={STROKE.detail} strokeLinecap="round" />
    </g>
  )
}

/** 08 · frame_bronze — fire tiger, bronze ring, gripping paws and tiger stripes. */
export function FrameBronze({ letter = 'K', fontSize = 48, small = false }: FrameArtProps = {}) {
  if (small) {
    return <SmallRing fill={paint.ring} dark={paint.dark} letter={letter} fontSize={fontSize} label="Khung hổ lửa cỡ nhỏ" />
  }
  return (
    <FrameSvg label="Khung hổ lửa">
      <TigerBack />
      <AvatarSlot letter={letter} fontSize={fontSize} />
      <Ring fill={paint.ring} dark={paint.dark} tigerStripes />
      <TigerPaw angle={216} upper />
      <TigerPaw angle={324} upper />
      <TigerPaw angle={132} />
      <TigerPaw angle={48} />
      <Bead angle={180} size={4.5} />
      <Bead angle={0} size={4.5} />
    </FrameSvg>
  )
}

export function FrameBronzeSmall() {
  return <FrameBronze small />
}
