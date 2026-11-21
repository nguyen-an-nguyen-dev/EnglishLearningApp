import { BLUE, GOLD, INK, STROKE, WHITE } from '../designTokens'
import {
  AvatarSlot,
  FrameSvg,
  HexBand,
  MascotEye,
  MascotMouth,
  MascotNose,
  NeonBolt,
  Ring,
} from '../parts/frameParts'
import { donutPath, onRing } from '../parts/frameGeometry'
import type { FrameArtProps } from '../parts/frameParts'

const paint = {
  ring: '#5b4bc4',
  dark: '#312a78',
  fur: '#ff9f2e',
  furDark: '#d97b17',
  cream: '#fff7e6',
}

function FoxBack() {
  return (
    <g>
      <path d="M78 29L74 15L90 23Z" fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M122 29L126 15L110 23Z" fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M81 26L79 19L86 23Z" fill={paint.cream} />
      <path d="M119 26L121 19L114 23Z" fill={paint.cream} />
      <path d="M74 41C74 28 84 19 100 19C116 19 126 28 126 41C126 51 120 59 111 63C106 65 94 65 89 63C80 59 74 51 74 41Z" fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M82 44C88 50 94 54 100 56C106 54 112 50 118 44C109 47 91 47 82 44Z" fill={paint.cream} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M84 23C89 20 94 19 100 19" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <MascotEye x={88} y={37} />
      <MascotEye x={112} y={37} />
      <MascotNose x={100} y={44} w={4.5} h={3.5} />
      <MascotMouth x={100} y={48} />
    </g>
  )
}

function FoxTail() {
  return (
    <g>
      <path
        d="M152 138C177 136 189 114 184 86C182 76 172 74 166 84C161 93 158 112 146 122Z"
        fill={paint.fur}
        stroke={INK}
        strokeWidth={STROKE.outer}
        strokeLinejoin="round"
      />
      <path
        d="M167 84C174 75 183 78 184 90C179 97 172 98 165 94Z"
        fill={paint.cream}
        stroke={INK}
        strokeWidth={STROKE.inner}
        strokeLinejoin="round"
      />
    </g>
  )
}

function FoxPaw({ angle, upper = false }: { angle: number; upper?: boolean }) {
  const p = onRing(upper ? 60 : 62, angle)
  const rot = upper ? (angle < 270 ? 28 : -28) : (angle > 90 ? -18 : 18)
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${rot})`}>
      <ellipse rx={upper ? 9 : 10} ry={upper ? 7 : 7.5} fill={paint.fur} stroke={INK} strokeWidth={STROKE.inner} />
      <ellipse cy={2} rx={4.5} ry={2.8} fill={INK} />
      <path d="M-4 -2V1M0 -3V1M4 -2V1" stroke={INK} strokeWidth={STROKE.detail} strokeLinecap="round" />
    </g>
  )
}

/** 15 · frame_neon — orange fox with bushy tail, paws, cyan hex cage and bolts. */
export function FrameNeon({ letter = 'K', fontSize = 48, small = false }: FrameArtProps = {}) {
  if (small) {
    return (
      <FrameSvg label="Khung cáo neon cỡ nhỏ">
        <AvatarSlot letter={letter} fontSize={fontSize} />
        <Ring fill={paint.ring} dark={paint.dark} />
        <path d={donutPath(53, 49)} fill={BLUE} fillRule="evenodd" />
      </FrameSvg>
    )
  }
  return (
    <FrameSvg label="Khung cáo neon">
      <circle cx={100} cy={112} r={66} fill="none" stroke={BLUE} strokeWidth={4} opacity={0.18} />
      <FoxTail />
      <FoxBack />
      <AvatarSlot letter={letter} fontSize={fontSize} />
      <Ring fill={paint.ring} dark={paint.dark} />
      <HexBand outer={68} inner={62} fill={BLUE} />
      <FoxPaw angle={216} upper />
      <FoxPaw angle={324} upper />
      <FoxPaw angle={128} />
      <FoxPaw angle={52} />
      <NeonBolt angle={180} radius={70} size={0.9} fill={GOLD} />
      <NeonBolt angle={0} radius={70} size={0.9} fill={GOLD} />
    </FrameSvg>
  )
}

export function FrameNeonSmall() {
  return <FrameNeon small />
}
