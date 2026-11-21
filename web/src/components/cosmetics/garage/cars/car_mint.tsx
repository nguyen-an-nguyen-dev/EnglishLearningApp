import { GLASS, INK, METAL, STROKE, WHITE } from '../designTokens'
import {
  Bumper,
  CarSvg,
  DoorSeam,
  GlassHighlight,
  GroundShadow,
  Headlight,
  Mirror,
  RoofRack,
  Taillight,
  Wheel,
  WheelArch,
  Window,
} from '../parts/carParts'
import type { CarArtProps } from '../parts/carParts'

const paint = {
  body: '#4fd1a5',
  dark: '#43b28c',
  glass: GLASS,
  metal: METAL,
}

/** 03 · car_mint — tall kei van, sliding door, roof rack on two feet. */
export function CarMintArt() {
  return (
    <g>
      <GroundShadow rx={87} />
      <RoofRack x={78} y={40} width={74} />
      <path
        d="M43 86C37 86 36 82 36 77L38 58C39 50 43 46 50 44L72 40H158C168 40 176 44 182 50L196 56C202 59 205 62 205 68L204 85C204 89 200 91 195 91H50C44 91 43 89 43 86Z"
        fill={paint.body}
        stroke={INK}
        strokeWidth={STROKE.outer}
        strokeLinejoin="round"
      />
      <path
        d="M40 81C40 87 46 91 54 91H194C201 91 205 87 205 80V85C205 89 200 91 194 91H54C47 91 40 88 40 82Z"
        fill={paint.dark}
      />
      <path d="M72 41H156C167 41 174 45 179 51" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <path d="M198 58C201 60 203 62 204 66" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />

      <Window d="M54 45H92L90 57H50Z" glass={paint.glass} />
      <Window d="M98 45H134V57H98Z" glass={paint.glass} />
      <Window d="M140 45H164L170 57H140Z" glass={paint.glass} />
      <Window d="M172 45L182 51L195 57L191 61L175 58Z" glass={paint.glass} />
      <GlassHighlight d="M103 47H130V50H103Z" />
      <GlassHighlight d="M175 48L182 52L190 55L189 57L176 54Z" />

      <path d="M96 57V87M140 57V87" fill="none" stroke={INK} strokeWidth={STROKE.inner} opacity={0.4} strokeLinecap="round" />
      <path d="M96 62H140" fill="none" stroke={INK} strokeWidth={STROKE.inner} opacity={0.22} strokeLinecap="round" />
      <rect x={103} y={68} width={10} height={4} rx={2} fill={paint.metal} stroke={INK} strokeWidth={STROKE.detail} />
      <rect x={147} y={68} width={10} height={4} rx={2} fill={paint.metal} stroke={INK} strokeWidth={STROKE.detail} />
      <DoorSeam d="M140 62V86" />
      <Mirror x={165} y={55} fill={paint.body} />

      <Bumper d="M196 76H205V84H198C195 84 194 80 196 76Z" />
      <Bumper d="M36 74H46V82H39C36 82 35 78 36 74Z" />
      <Headlight d="M194 66C201 66 204 68 205 72L204 77C199 75 195 74 192 74Z" />
      <Taillight d="M37 64H44V71H37Z" />
      <path d="M199 84V87M203 84V87" stroke={INK} strokeWidth={STROKE.detail} strokeLinecap="round" />

      <WheelArch cx={68} r={15} fill={paint.dark} />
      <WheelArch cx={176} r={15} fill={paint.dark} />
      <Wheel cx={68} r={15} />
      <Wheel cx={176} r={15} />
    </g>
  )
}

export function CarMint({ className }: CarArtProps = {}) {
  return (
    <CarSvg label="Xe van bạc hà" className={className}>
      <CarMintArt />
    </CarSvg>
  )
}
