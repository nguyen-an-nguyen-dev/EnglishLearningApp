import {
  CAR,
  GLASS,
  INK,
  METAL,
  STROKE,
  WHITE,
} from '../designTokens'
import {
  Bumper,
  CarSvg,
  DoorSeam,
  GlassHighlight,
  GroundShadow,
  Headlight,
  Mirror,
  Taillight,
  Wheel,
  WheelArch,
  Window,
} from '../parts/carParts'
import type { CarArtProps } from '../parts/carParts'

const paint = {
  body: '#f5b82e',
  dark: '#d09c27',
  glass: GLASS,
  metal: METAL,
}

/** 01 · car_classic_yellow — rounded 1950s sedan, no decals, 190 wide. */
export function CarClassicYellowArt() {
  return (
    <g>
      <GroundShadow rx={94} />
      <path
        d="M35 82C30 82 27 78 27 73C27 67 31 64 38 63L58 60L70 44C72 41 76 39 81 39H136C142 39 146 41 149 45L163 60L196 62C207 63 213 69 213 77L212 85C211 89 207 91 202 91H44C39 91 35 89 35 82Z"
        fill={paint.body}
        stroke={INK}
        strokeWidth={STROKE.outer}
        strokeLinejoin="round"
      />
      <path
        d="M29 79C29 86 34 91 44 91H201C209 91 213 86 213 79V84C213 89 208 91 201 91H44C36 91 29 87 29 81Z"
        fill={paint.dark}
      />
      <path d="M75 44C78 41 82 40 86 40H135C141 40 145 42 148 46" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <path d="M164 62H194C201 63 207 68 209 74" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />

      <Window d="M76 45H100L97 58H68Z" glass={paint.glass} />
      <Window d="M106 45H135L148 58H106Z" glass={paint.glass} />
      <GlassHighlight d="M110 47H128L122 51H112Z" />
      <path d="M100 45H106" stroke={INK} strokeWidth={STROKE.inner} />

      <path d="M64 59H161" stroke={INK} strokeWidth={STROKE.inner} opacity={0.45} strokeLinecap="round" />
      <rect x={64} y={73} width={104} height={3} rx={1.5} fill={paint.metal} opacity={0.9} />
      <DoorSeam d="M118 59V87" />
      <rect x={108} y={66} width={10} height={4} rx={2} fill={paint.metal} stroke={INK} strokeWidth={STROKE.detail} />
      <Mirror x={149} y={53} fill={paint.body} />

      <Bumper d="M204 73H214V82H206C204 82 203 78 204 73Z" />
      <Bumper d="M26 73H36V82H28C25 82 24 78 26 73Z" />
      <Headlight d="M196 66C203 66 208 68 210 72L209 77C204 75 199 74 195 74Z" />
      <Taillight d="M29 64H37V71H29Z" />
      <path d="M207 83V86M211 83V86" stroke={INK} strokeWidth={STROKE.detail} strokeLinecap="round" />

      <WheelArch cx={61} fill={paint.dark} r={CAR.defaultWheelR} />
      <WheelArch cx={183} fill={paint.dark} r={CAR.defaultWheelR} />
      <Wheel cx={61} r={CAR.defaultWheelR} />
      <Wheel cx={183} r={CAR.defaultWheelR} />
    </g>
  )
}

export function CarClassicYellow({ className }: CarArtProps = {}) {
  return (
    <CarSvg label="Xe vàng kinh điển" className={className}>
      <CarClassicYellowArt />
    </CarSvg>
  )
}
