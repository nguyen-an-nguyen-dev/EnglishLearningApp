import { INK, ORANGE, STROKE, WHITE } from '../designTokens'
import {
  AvatarSlot,
  Bubble,
  FrameSvg,
  MascotBeak,
  Ring,
  SmallRing,
} from '../parts/frameParts'
import { onRing } from '../parts/frameGeometry'
import type { FrameArtProps } from '../parts/frameParts'

const paint = {
  ring: '#3aa6c9',
  dark: '#1f6f8b',
  body: '#14203a',
  face: '#ffffff',
}

function PenguinBack() {
  return (
    <g>
      <path d="M74 40C74 27 84 16 100 16C116 16 126 27 126 40C126 51 120 59 111 63C106 65 94 65 89 63C80 59 74 51 74 40Z" fill={paint.body} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M82 38C82 28 89 22 100 22C111 22 118 28 118 38C118 47 111 54 100 59C89 54 82 47 82 38Z" fill={paint.face} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <circle cx={90} cy={37} r={4.6} fill={INK} />
      <circle cx={110} cy={37} r={4.6} fill={INK} />
      <circle cx={88.5} cy={35.5} r={1.4} fill={WHITE} />
      <circle cx={108.5} cy={35.5} r={1.4} fill={WHITE} />
      <MascotBeak x={100} y={44} w={5} h={7} fill={ORANGE} />
      <path d="M76 28C78 22 82 19 87 18" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
    </g>
  )
}

function PenguinFlippers() {
  return (
    <g>
      <path d="M46 84C31 86 24 102 32 117C37 125 44 123 45 113Z" fill={paint.body} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M154 84C169 86 176 102 168 117C163 125 156 123 155 113Z" fill={paint.body} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
    </g>
  )
}

function PenguinFoot({ angle }: { angle: number }) {
  const p = onRing(61, angle)
  return (
    <path
      d="M-9 2C-9 -3 -4 -6 0 -5C4 -6 9 -3 9 2C7 5 3 5 0 3C-3 5 -7 5 -9 2Z"
      transform={`translate(${p.x} ${p.y}) rotate(${angle > 90 ? 18 : -18})`}
      fill={ORANGE}
      stroke={INK}
      strokeWidth={STROKE.inner}
      strokeLinejoin="round"
    />
  )
}

/** 14 · frame_ocean — baby penguin with flippers, webbed feet and bubbles. */
export function FrameOcean({ letter = 'K', fontSize = 48, small = false }: FrameArtProps = {}) {
  if (small) {
    return <SmallRing fill={paint.ring} dark={paint.dark} letter={letter} fontSize={fontSize} label="Khung cánh cụt biển cỡ nhỏ" />
  }
  return (
    <FrameSvg label="Khung cánh cụt biển">
      <PenguinFlippers />
      <PenguinBack />
      <AvatarSlot letter={letter} fontSize={fontSize} />
      <Ring fill={paint.ring} dark={paint.dark} />
      <PenguinFoot angle={122} />
      <PenguinFoot angle={58} />
      <Bubble angle={220} radius={66} size={6.5} />
      <Bubble angle={320} radius={66} size={5.5} />
      <Bubble angle={35} radius={66} size={5} />
    </FrameSvg>
  )
}

export function FrameOceanSmall() {
  return <FrameOcean small />
}
