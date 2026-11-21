import { HEADLIGHT, INK, METAL, STROKE, WHITE } from '../designTokens'
import {
  Bumper,
  CarSvg,
  DoorSeam,
  GroundShadow,
  Headlight,
  RoofRack,
  Wheel,
  WheelArch,
  Window,
} from '../parts/carParts'
import type { CarArtProps } from '../parts/carParts'

const paint = {
  body: '#c25b45',
  dark: '#a34a37',
  metal: METAL,
}

/** 10 · car_jeep — high-clearance 4x4, roof rack, spare wheel on the tailgate. */
export function CarJeepArt() {
  return (
    <g>
      <GroundShadow rx={95} />
      <RoofRack x={98} y={41} width={48} />
      <path d="M42 82C36 82 33 78 33 73L35 58C36 51 41 48 49 47L80 45L96 41H148C158 41 165 44 169 49L178 58L198 60C206 61 211 66 211 73L209 82C208 86 203 88 197 88H48C44 88 42 86 42 82Z" fill={paint.body} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M37 79C37 85 43 88 50 88H197C203 88 209 86 209 81V84C209 88 203 89 197 89H48C41 89 37 86 37 80Z" fill={paint.dark} />
      <path d="M99 42H147C154 42 160 45 163 50" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <path d="M170 60H196C202 61 207 65 209 70" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />

      <Window d="M101 46H146L158 58H101Z" glass="#bfe9ff" />
      <Window d="M63 46H94L92 58H60Z" glass="#bfe9ff" />
      <path d="M108 48H139L127 54H110Z" fill={WHITE} opacity={0.35} />
      <path d="M94 46H101" stroke={INK} strokeWidth={STROKE.inner} />
      <DoorSeam d="M101 58V84" />
      <rect x={105} y={64} width={10} height={4} rx={2} fill={paint.metal} stroke={INK} strokeWidth={STROKE.detail} />

      <circle cx={38} cy={56} r={12} fill={INK} stroke={INK} strokeWidth={STROKE.outer} />
      <circle cx={38} cy={56} r={6.2} fill={paint.metal} stroke={INK} strokeWidth={STROKE.inner} />
      <circle cx={38} cy={56} r={2.4} fill={INK} />
      <path d="M49 54H55M49 58H55" stroke={INK} strokeWidth={STROKE.inner} strokeLinecap="round" />

      <circle cx={117} cy={67} r={6} fill={WHITE} stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M117 62L119 65L123 67L119 69L117 73L115 69L111 67L115 65Z" fill={paint.dark} />

      <Bumper d="M200 74H212V84H203C200 84 198 80 200 74Z" />
      <Bumper d="M32 74H42V84H34C31 84 29 80 32 74Z" />
      <Headlight d="M195 61C202 61 206 64 208 68L207 73C201 71 197 70 193 70Z" />
      <path d="M208 65L218 61V72L208 73Z" fill={HEADLIGHT} opacity={0.35} />
      <path d="M203 84V87M207 84V87" stroke={INK} strokeWidth={STROKE.detail} strokeLinecap="round" />

      <WheelArch cx={62} r={21} fill={paint.dark} />
      <WheelArch cx={182} r={21} fill={paint.dark} />
      <Wheel cx={62} r={21} tread />
      <Wheel cx={182} r={21} tread />
    </g>
  )
}

export function CarJeep({ className }: CarArtProps = {}) {
  return (
    <CarSvg label="Jeep đường dài" className={className}>
      <CarJeepArt />
    </CarSvg>
  )
}
