import { GOLD, INK, STROKE, WHITE } from '../designTokens'
import {
  AvatarSlot,
  Blossom,
  FrameSvg,
  MascotEye,
  MascotMouth,
  MascotNose,
  MascotWhiskers,
  Ring,
  SmallRing,
} from '../parts/frameParts'
import { onRing } from '../parts/frameGeometry'
import type { FrameArtProps } from '../parts/frameParts'

const paint = {
  ring: '#f2a7c3',
  dark: '#c86b92',
  fur: '#f5b82e',
  furDark: '#d09c27',
  cream: '#fff7e6',
  petal: '#ffc2d8',
}

function CatBack() {
  return (
    <g strokeLinejoin="round">
      <path d="M80 30L76 16L90 22ZM120 30L124 16L110 22Z" fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} />
      <path d="M82 27L80 20L87 23ZM118 27L120 20L113 23Z" fill={paint.petal} />
      <path d="M74 41C74 28 84 20 100 20C116 20 126 28 126 41C126 51 120 59 111 63C106 65 94 65 89 63C80 59 74 51 74 41Z" fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} />
      <path d="M82 24C87 21 92 20 98 20" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <path d="M86 26L89 31M100 25V31M114 26L111 31" stroke={INK} strokeWidth={STROKE.inner} strokeLinecap="round" opacity={0.35} />
      <MascotEye x={88} y={37} />
      <MascotEye x={112} y={37} />
      <ellipse cx={100} cy={48} rx={12} ry={8} fill={paint.cream} stroke={INK} strokeWidth={STROKE.inner} />
      <MascotNose x={100} y={45} w={4} h={3} fill={paint.ring} />
      <MascotMouth x={100} y={49} />
      <MascotWhiskers x={100} y={49} />
    </g>
  )
}

function CatTail() {
  return (
    <g>
      <path
        d="M150 138C172 138 184 120 180 96C178 86 168 84 166 94C164 106 162 124 148 126Z"
        fill={paint.fur}
        stroke={INK}
        strokeWidth={STROKE.outer}
        strokeLinejoin="round"
      />
      <path d="M167 90C172 86 179 90 179 98C174 100 169 98 166 95Z" fill={paint.cream} stroke={INK} strokeWidth={STROKE.detail} />
    </g>
  )
}

function CatPaw({ angle, upper = false }: { angle: number; upper?: boolean }) {
  const p = onRing(upper ? 58 : 60, angle)
  const rot = upper ? (angle < 270 ? 28 : -28) : (angle > 90 ? -18 : 18)
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${rot})`}>
      <ellipse rx={upper ? 9 : 10} ry={upper ? 7 : 7.5} fill={paint.fur} stroke={INK} strokeWidth={STROKE.inner} />
      <ellipse cy={1.8} rx={4.2} ry={2.8} fill={paint.petal} />
      <path d="M-4 -2V1.5M0 -3V1.5M4 -2V1.5" stroke={INK} strokeWidth={STROKE.detail} strokeLinecap="round" />
    </g>
  )
}

/** 13 · frame_sakura — golden cat with curled tail, paws and cherry blossoms. */
export function FrameSakura({ letter = 'K', fontSize = 48, small = false }: FrameArtProps = {}) {
  if (small) {
    return <SmallRing fill={paint.ring} dark={paint.dark} letter={letter} fontSize={fontSize} label="Khung mèo anh đào cỡ nhỏ" />
  }
  const bloom = onRing(61, 315)
  const accentBloom = onRing(62, 165)
  const smallBloom = onRing(64, 24)
  return (
    <FrameSvg label="Khung mèo anh đào">
      <CatTail />
      <CatBack />
      <AvatarSlot letter={letter} fontSize={fontSize} />
      <Ring fill={paint.ring} dark={paint.dark} />
      <CatPaw angle={216} upper />
      <CatPaw angle={324} upper />
      <CatPaw angle={128} />
      <CatPaw angle={52} />
      <Blossom x={bloom.x} y={bloom.y} scale={0.82} petal={paint.petal} core={GOLD} />
      <Blossom x={accentBloom.x} y={accentBloom.y} scale={0.5} petal={paint.petal} core={GOLD} />
      <Blossom x={smallBloom.x} y={smallBloom.y} scale={0.42} petal={paint.petal} core={GOLD} />
    </FrameSvg>
  )
}

export function FrameSakuraSmall() {
  return <FrameSakura small />
}
