import { BLUE, GOLD, INK, STROKE, WHITE } from '../designTokens'
import {
  AvatarSlot,
  DecorStar,
  FrameSvg,
  HexBand,
  MascotEye,
  MascotMouth,
  MascotNose,
  Ring,
  StarPt,
} from '../parts/frameParts'
import { donutPath, onRing } from '../parts/frameGeometry'
import type { FrameArtProps } from '../parts/frameParts'

const paint = {
  ring: '#f2a7c3',
  dark: '#c86b92',
  fur: '#fdfbff',
  manePink: '#f9a8d4',
  maneCyan: '#8ce7f0',
  manePurple: '#c4b5fd',
}

function UnicornBack() {
  return (
    <g strokeLinejoin="round">
      <path d="M78 26C72 32 71 42 75 52C79 48 81 40 82 32ZM122 26C128 32 129 42 125 52C121 48 119 40 118 32Z" fill={paint.manePink} stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M82 38C76 44 76 52 80 58C84 54 86 46 87 40ZM118 38C124 44 124 52 120 58C116 54 114 46 113 40Z" fill={paint.maneCyan} stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M84 28L78 18L90 22ZM116 28L122 18L110 22Z" fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} />
      <path d="M94 24L100 8L106 24Z" fill={GOLD} stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M96 20H104L103 17H97Z" fill={paint.manePink} />
      <path d="M97.5 16H102.5L102 14H98Z" fill={paint.maneCyan} />
      <path d="M99 13H101L100.5 11H99.5Z" fill={paint.manePurple} />
      <path d="M74 40C74 27 84 18 100 18C116 18 126 27 126 40C126 51 120 59 111 63C106 65 94 65 89 63C80 59 74 51 74 40Z" fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} />
      <path d="M82 23C87 20 92 19 98 19" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <StarPt x={100} y={21} r={3} fill={GOLD} />
      <MascotEye x={89} y={36} />
      <MascotEye x={111} y={36} />
      <ellipse cx={100} cy={47} rx={12} ry={8} fill="#fff7e6" stroke={INK} strokeWidth={STROKE.inner} />
      <MascotNose x={100} y={44} w={4} h={3} fill={paint.ring} />
      <MascotMouth x={100} y={49} />
    </g>
  )
}

function UnicornWingsAndTail() {
  return (
    <g strokeLinejoin="round">
      <path d="M50 86C24 72 10 82 14 102C18 116 32 122 46 116ZM150 86C176 72 190 82 186 102C182 116 168 122 154 116Z" fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} />
      <path d="M22 95L42 97M20 105L43 106M178 95L158 97M180 105L157 106" stroke={INK} strokeWidth={STROKE.inner} strokeLinecap="round" opacity={0.5} />
      <path d="M84 170C76 184 86 194 100 189C114 194 124 184 116 170Z" fill={paint.manePink} stroke={INK} strokeWidth={STROKE.outer} />
      <path d="M90 171C88 182 94 189 100 185C106 189 112 182 110 171Z" fill={paint.maneCyan} stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M96 172C96 180 104 180 104 172Z" fill={paint.manePurple} />
    </g>
  )
}

function UnicornHoof({ angle, upper = false }: { angle: number; upper?: boolean }) {
  const p = onRing(upper ? 60 : 62, angle)
  const rot = upper ? (angle < 270 ? 28 : -28) : (angle > 90 ? -18 : 18)
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${rot})`}>
      <rect x={-7} y={-6} width={14} height={12} rx={5} fill={paint.fur} stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M-6 1H6V4C6 5.5 4.5 6 3 6H-3C-4.5 6 -6 5.5 -6 4Z" fill={GOLD} stroke={INK} strokeWidth={STROKE.detail} />
    </g>
  )
}

/** 12 · frame_prism — pastel unicorn with pegasus wings, rainbow tail, golden hooves and hex crystal cage. */
export function FramePrism({ letter = 'K', fontSize = 48, small = false }: FrameArtProps = {}) {
  if (small) {
    return (
      <FrameSvg label="Khung kỳ lân cỡ nhỏ">
        <AvatarSlot letter={letter} fontSize={fontSize} />
        <Ring fill={paint.ring} dark={paint.dark} goldEdge />
        <path d={donutPath(53, 49)} fill={BLUE} fillRule="evenodd" />
      </FrameSvg>
    )
  }
  return (
    <FrameSvg label="Khung kỳ lân">
      <circle cx={100} cy={112} r={68} fill="none" stroke={GOLD} strokeWidth={4} opacity={0.18} />
      <UnicornWingsAndTail />
      <UnicornBack />
      <AvatarSlot letter={letter} fontSize={fontSize} />
      <Ring fill={paint.ring} dark={paint.dark} goldEdge />
      <path d={donutPath(53, 49)} fill={BLUE} fillRule="evenodd" />
      <HexBand outer={68} inner={62} fill="#bfe9ff" />
      <UnicornHoof angle={216} upper />
      <UnicornHoof angle={324} upper />
      <UnicornHoof angle={128} />
      <UnicornHoof angle={52} />
      <DecorStar angle={180} radius={74} r={5} fill={GOLD} />
      <DecorStar angle={0} radius={74} r={5} fill={WHITE} />
      <DecorStar angle={90} radius={74} r={4.5} fill={GOLD} />
    </FrameSvg>
  )
}

export function FramePrismSmall() {
  return <FramePrism small />
}
