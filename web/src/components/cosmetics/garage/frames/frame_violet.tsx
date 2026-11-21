import { BLUE, GOLD, INK, ORANGE, STROKE, WHITE } from '../designTokens'
import {
  AvatarSlot,
  DecorStar,
  FrameSvg,
  MascotBeak,
  Ring,
  StarPt,
} from '../parts/frameParts'
import { donutPath, onRing } from '../parts/frameGeometry'
import type { FrameArtProps } from '../parts/frameParts'

const paint = {
  ring: '#a78bfa',
  dark: '#7c62d6',
  fur: '#c26a12',
  furDark: '#9f5410',
  face: '#fff7e6',
}

function OwlBack() {
  return (
    <g>
      <path d="M78 28L74 14L88 22Z" fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M122 28L126 14L112 22Z" fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M74 40C74 27 84 18 100 18C116 18 126 27 126 40C126 51 120 59 111 63C106 65 94 65 89 63C80 59 74 51 74 40Z" fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M82 23C87 20 92 19 98 19" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <circle cx={87} cy={38} r={12} fill={paint.face} stroke={INK} strokeWidth={STROKE.inner} />
      <circle cx={113} cy={38} r={12} fill={paint.face} stroke={INK} strokeWidth={STROKE.inner} />
      <circle cx={87} cy={38} r={6} fill={INK} />
      <circle cx={113} cy={38} r={6} fill={INK} />
      <circle cx={85} cy={35.5} r={1.8} fill={WHITE} />
      <circle cx={111} cy={35.5} r={1.8} fill={WHITE} />
      <MascotBeak x={100} y={44} w={5} h={7} fill={ORANGE} />
      <path d="M88 52C93 55 99 56 100 56C101 56 107 55 112 52" fill="none" stroke={INK} strokeWidth={STROKE.inner} strokeLinecap="round" opacity={0.35} />
      <StarPt x={100} y={15} r={5} fill={paint.ring} />
      <StarPt x={89} y={20} r={2.8} fill={GOLD} />
      <StarPt x={111} y={20} r={2.8} fill={GOLD} />
    </g>
  )
}

function OwlWingsAndTail() {
  return (
    <g>
      <path d="M52 80C28 74 14 90 18 112C22 126 36 130 48 122Z" fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M26 98L42 96M24 108L43 106M28 117L44 115" stroke={INK} strokeWidth={STROKE.inner} strokeLinecap="round" opacity={0.55} />
      <path d="M148 80C172 74 186 90 182 112C178 126 164 130 152 122Z" fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M174 98L158 96M176 108L157 106M172 117L156 115" stroke={INK} strokeWidth={STROKE.inner} strokeLinecap="round" opacity={0.55} />
      <path d="M84 166L100 184L116 166Z" fill={paint.furDark} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M94 168L100 180L106 168" fill="none" stroke={GOLD} strokeWidth={STROKE.inner} strokeLinejoin="round" />
    </g>
  )
}

function OwlTalon({ angle }: { angle: number }) {
  const p = onRing(60, angle)
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${angle > 90 ? 16 : -16})`}>
      <path d="M-8 0C-8 -5 -4 -7 0 -6C4 -7 8 -5 8 0L5 6L0 3L-5 6Z" fill={ORANGE} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M-4 -4V3M0 -5V3M4 -4V3" stroke={INK} strokeWidth={STROKE.detail} strokeLinecap="round" />
    </g>
  )
}

function VioletBand() {
  return <path d={donutPath(53, 49)} fill={BLUE} fillRule="evenodd" />
}

/** 11 · frame_violet — brown owl with spread wings, tail feathers, talons and star ring. */
export function FrameViolet({ letter = 'K', fontSize = 48, small = false }: FrameArtProps = {}) {
  if (small) {
    return (
      <FrameSvg label="Khung cú tinh tú cỡ nhỏ">
        <AvatarSlot letter={letter} fontSize={fontSize} />
        <Ring fill={paint.ring} dark={paint.dark} />
        <VioletBand />
      </FrameSvg>
    )
  }
  return (
    <FrameSvg label="Khung cú tinh tú">
      <circle cx={100} cy={112} r={65} fill="none" stroke={BLUE} strokeWidth={4} opacity={0.16} />
      <OwlWingsAndTail />
      <OwlBack />
      <AvatarSlot letter={letter} fontSize={fontSize} />
      <Ring fill={paint.ring} dark={paint.dark} />
      <VioletBand />
      <OwlTalon angle={124} />
      <OwlTalon angle={56} />
      <DecorStar angle={225} radius={65} r={5.5} fill={GOLD} />
      <DecorStar angle={315} radius={65} r={5.5} fill={WHITE} />
      <DecorStar angle={150} radius={67} r={4.5} fill={WHITE} />
      <DecorStar angle={30} radius={67} r={4.5} fill={GOLD} />
    </FrameSvg>
  )
}

export function FrameVioletSmall() {
  return <FrameViolet small />
}
