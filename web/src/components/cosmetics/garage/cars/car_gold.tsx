import { GLASS, GOLD, INK, METAL, STROKE, WHITE } from '../designTokens'
import {
  Bumper,
  CarSvg,
  DoorSeam,
  GlassHighlight,
  GroundShadow,
  Headlight,
  Sparkle,
  Taillight,
  Wheel,
  WheelArch,
  Window,
} from '../parts/carParts'
import type { CarArtProps } from '../parts/carParts'

const paint = {
  body: '#ffd23f',
  dark: '#d9b236',
  glass: GLASS,
  metal: METAL,
}

/** 06 · car_gold — 200-wide, 56-tall limousine; gold spokes, three windows. */
export function CarGoldArt() {
  return (
    <g>
      <GroundShadow rx={99} />
      <path
        d="M30 85C24 85 21 81 21 76L21 70C21 64 25 61 32 60L62 59C68 58 73 56 77 53C80 52 84 52 88 52L153 52C159 52 164 54 167 57L174 61L204 61C212 61 219 66 219 73L219 82C219 87 214 90 207 90L41 90C35 90 30 88 30 85Z"
        fill={paint.body}
        stroke={INK}
        strokeWidth={STROKE.outer}
        strokeLinejoin="round"
      />
      <path
        d="M25 80C25 86 31 90 41 90H207C214 90 219 87 219 81V84C219 88 213 90 207 90H41C33 90 25 87 25 81Z"
        fill={paint.dark}
      />
      <path d="M88 53H153C159 53 164 55 167 58" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <path d="M190 63H206C211 64 215 67 216 71" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />

      <Window d="M65 57H90L86 66H59Z" glass={paint.glass} />
      <Window d="M97 57H118V66H97Z" glass={paint.glass} />
      <Window d="M124 57H148L158 66H124Z" glass={paint.glass} />
      <GlassHighlight d="M128 59H145L150 62L149 64H131Z" />
      <path d="M90 57H97M118 57H124" stroke={INK} strokeWidth={STROKE.inner} />

      <rect x={52} y={68} width={140} height={3} rx={1.5} fill={paint.dark} />
      <rect x={50} y={83} width={146} height={3} rx={1.5} fill={paint.dark} opacity={0.9} />
      <DoorSeam d="M94 66V87" />
      <DoorSeam d="M121 66V87" />
      <rect x={83} y={73} width={9} height={4} rx={2} fill={paint.metal} stroke={INK} strokeWidth={STROKE.detail} />
      <rect x={110} y={73} width={9} height={4} rx={2} fill={paint.metal} stroke={INK} strokeWidth={STROKE.detail} />

      <Bumper d="M209 74H219V84H212C209 84 207 79 209 74Z" />
      <Bumper d="M20 74H31V84H23C20 84 20 79 20 74Z" />
      <Headlight d="M194 64C205 64 212 68 214 73L213 78C205 75 199 74 193 74Z" />
      <Taillight d="M24 62H34V69H24Z" />
      <path d="M206 84V87M211 84V87" stroke={INK} strokeWidth={STROKE.detail} strokeLinecap="round" />

      <Sparkle x={45} y={56} r={5} fill={GOLD} />
      <Sparkle x={205} y={57} r={4.5} fill={WHITE} />

      <WheelArch cx={54} fill={paint.dark} />
      <WheelArch cx={186} fill={paint.dark} />
      <Wheel cx={54} spokeColor={GOLD} />
      <Wheel cx={186} spokeColor={GOLD} />
    </g>
  )
}

export function CarGold({ className }: CarArtProps = {}) {
  return (
    <CarSvg label="Xe hoàng kim" className={className}>
      <CarGoldArt />
    </CarSvg>
  )
}
