import { INK, STROKE, WHITE } from '../designTokens'
import {
  AvatarSlot,
  DecorStar,
  FrameSvg,
  MascotEye,
  Ring,
  SmallRing,
} from '../parts/frameParts'
import { onRing } from '../parts/frameGeometry'
import type { FrameArtProps } from '../parts/frameParts'

const paint = {
  ring: '#d8e2ea',
  dark: '#93a3b3',
  fur: '#c9d6ea',
  furDark: '#aebdcc',
  inner: '#eef5fa',
}

function KoalaBack() {
  return (
    <g>
      <circle cx={79.5} cy={27} r={9.5} fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} />
      <circle cx={120.5} cy={27} r={9.5} fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} />
      <circle cx={79.5} cy={27} r={5} fill={paint.inner} />
      <circle cx={120.5} cy={27} r={5} fill={paint.inner} />
      <path d="M74 40C74 27 84 18 100 18C116 18 126 27 126 40C126 51 120 59 111 63C106 65 94 65 89 63C80 59 74 51 74 40Z" fill={paint.fur} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M82 23C87 20 92 19 98 19" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <path d="M78 39C81 37 84 37 86 38M122 39C119 37 116 37 114 38" fill="none" stroke={INK} strokeWidth={STROKE.inner} strokeLinecap="round" opacity={0.35} />
      <MascotEye x={88} y={37} />
      <MascotEye x={112} y={37} />
      <ellipse cx={100} cy={48} rx={8} ry={9} fill={INK} />
      <circle cx={97.5} cy={45} r={1.6} fill={WHITE} opacity={0.55} />
    </g>
  )
}

function KoalaPaw({ angle }: { angle: number }) {
  const p = onRing(58, angle)
  const rot = angle < 270 ? 28 : -28
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${rot})`}>
      <ellipse rx={9.5} ry={7.5} fill={paint.fur} stroke={INK} strokeWidth={STROKE.inner} />
      <ellipse cy={1.5} rx={4.5} ry={3.2} fill={paint.inner} />
      <path d="M-4 -3V-1M0 -4V-1.5M4 -3V-1" stroke={INK} strokeWidth={STROKE.detail} strokeLinecap="round" />
    </g>
  )
}

/** 09 · frame_silver — koala hugging a silver ring with star accents. */
export function FrameSilver({ letter = 'K', fontSize = 48, small = false }: FrameArtProps = {}) {
  if (small) {
    return <SmallRing fill={paint.ring} dark={paint.dark} letter={letter} fontSize={fontSize} label="Khung gấu túi bạc cỡ nhỏ" />
  }
  return (
    <FrameSvg label="Khung gấu túi bạc">
      <KoalaBack />
      <AvatarSlot letter={letter} fontSize={fontSize} />
      <Ring fill={paint.ring} dark={paint.dark} />
      <KoalaPaw angle={216} />
      <KoalaPaw angle={324} />
      <DecorStar angle={135} radius={63} r={5} fill={WHITE} />
      <DecorStar angle={45} radius={63} r={5} fill={WHITE} />
    </FrameSvg>
  )
}

export function FrameSilverSmall() {
  return <FrameSilver small />
}
