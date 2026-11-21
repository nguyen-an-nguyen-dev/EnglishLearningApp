import { GOLD, INK, STROKE, WHITE } from '../designTokens'
import {
  AvatarSlot,
  Crown,
  FrameSvg,
  MascotEye,
  MascotMouth,
  MascotNose,
  MascotTongue,
  Ring,
  SmallRing,
} from '../parts/frameParts'
import { onRing } from '../parts/frameGeometry'
import type { FrameArtProps } from '../parts/frameParts'

const paint = {
  ring: '#ffd23f',
  dark: '#d9b236',
  fur: '#f5b82e',
  furDark: '#d09c27',
  cream: '#fff7e6',
}

function DogBack() {
  return (
    <g>
      <path d="M79 24C72 25 70 40 74 51C76 55 81 57 84 52C87 47 86 34 83 28Z" fill={paint.furDark} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M121 24C128 25 130 40 126 51C124 55 119 57 116 52C113 47 114 34 117 28Z" fill={paint.furDark} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M76 40C76 27 86 18 100 18C114 18 124 27 124 40C124 51 119 59 111 63C106 65 94 65 89 63C81 59 76 51 76 40Z" fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M84 23C89 20 94 19 100 19" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <Crown x={100} y={21} width={28} />
      <ellipse cx={100} cy={46} rx={14} ry={8.5} fill={paint.cream} stroke={INK} strokeWidth={STROKE.inner} />
      <MascotEye x={88} y={36} />
      <MascotEye x={112} y={36} />
      <MascotNose x={100} y={44} w={5} h={4} />
      <MascotMouth x={100} y={48} />
      <MascotTongue x={100} y={51} />
      <path d="M82 46L76 44M82 50L76 51M118 46L124 44M118 50L124 51" stroke={INK} strokeWidth={STROKE.detail} strokeLinecap="round" opacity={0.55} />
    </g>
  )
}

function DogTail() {
  return (
    <g>
      <path
        d="M154 128C171 124 182 108 179 90C178 82 170 80 166 86C163 92 164 108 153 114Z"
        fill={paint.fur}
        stroke={INK}
        strokeWidth={STROKE.outer}
        strokeLinejoin="round"
      />
      <path d="M174 87C172 96 168 106 161 112" fill="none" stroke={WHITE} strokeWidth={2.5} strokeLinecap="round" opacity={0.55} />
    </g>
  )
}

function DogPaw({ angle, upper = false }: { angle: number; upper?: boolean }) {
  const p = onRing(upper ? 58 : 60, angle)
  const rot = upper ? (angle < 270 ? 28 : -28) : (angle > 90 ? -18 : 18)
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${rot})`}>
      <ellipse rx={upper ? 9.5 : 10.5} ry={upper ? 7.5 : 8} fill={paint.fur} stroke={INK} strokeWidth={STROKE.inner} />
      <ellipse cy={1.5} rx={4.5} ry={3} fill={paint.cream} />
      <path d="M-4 -2V2M0 -3V2M4 -2V2" stroke={INK} strokeWidth={STROKE.detail} strokeLinecap="round" />
    </g>
  )
}

function Ray({ angle }: { angle: number }) {
  const p0 = onRing(60, angle - 4)
  const p1 = onRing(72, angle)
  const p2 = onRing(60, angle + 4)
  return <path d={`M${p0.x} ${p0.y}L${p1.x} ${p1.y}L${p2.x} ${p2.y}Z`} fill={GOLD} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
}

/** 10 · frame_gold — golden retriever with crown, gripping paws, wagging tail and sun rays. */
export function FrameGold({ letter = 'K', fontSize = 48, small = false }: FrameArtProps = {}) {
  if (small) {
    return <SmallRing fill={paint.ring} dark={paint.dark} letter={letter} fontSize={fontSize} label="Khung cún vàng cỡ nhỏ" />
  }
  return (
    <FrameSvg label="Khung cún vàng">
      <DogTail />
      <DogBack />
      <AvatarSlot letter={letter} fontSize={fontSize} />
      <Ring fill={paint.ring} dark={paint.dark} />
      <Ray angle={180} />
      <Ray angle={0} />
      <Ray angle={90} />
      <DogPaw angle={216} upper />
      <DogPaw angle={324} upper />
      <DogPaw angle={132} />
      <DogPaw angle={48} />
    </FrameSvg>
  )
}

export function FrameGoldSmall() {
  return <FrameGold small />
}
