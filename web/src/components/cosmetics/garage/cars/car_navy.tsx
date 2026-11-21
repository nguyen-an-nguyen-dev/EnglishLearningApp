import { GOLD, HEADLIGHT, INK, METAL, STROKE, WHITE } from '../designTokens'
import {
  Bumper,
  CarSvg,
  DoorSeam,
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
  body: '#2b4a9a',
  dark: '#253f83',
  glass: '#1d2c4a',
  metal: METAL,
}

/** 04 · car_navy — long low sedan, black glass, silver trim, one gold stripe. */
export function CarNavyArt() {
  return (
    <g>
      <GroundShadow rx={94} />
      <path
        d="M34 84C27 84 24 80 24 75L25 67C26 62 30 59 37 58L62 55L78 43C82 39 88 38 96 38H138C146 38 152 41 156 46L168 58L199 61C210 62 215 68 215 76L214 85C213 89 208 91 202 91H44C38 91 34 89 34 84Z"
        fill={paint.body}
        stroke={INK}
        strokeWidth={STROKE.outer}
        strokeLinejoin="round"
      />
      <path
        d="M28 80C28 87 35 91 44 91H202C210 91 215 87 215 80V85C215 89 209 91 202 91H44C36 91 28 88 28 81Z"
        fill={paint.dark}
      />
      <path d="M80 47C84 42 89 40 96 40H137C144 40 149 43 152 47" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <path d="M170 60H198C205 61 211 66 213 72" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />

      <Window d="M80 45H99L96 58H70Z" glass={paint.glass} />
      <Window d="M104 45H136L150 58H104Z" glass={paint.glass} />
      <path d="M108 47H129L123 51H110Z" fill={WHITE} opacity={0.35} />
      <path d="M99 45H104" stroke={INK} strokeWidth={STROKE.inner} />
      <rect x={66} y={57.5} width={94} height={3} rx={1.5} fill={paint.metal} />
      <rect x={42} y={69} width={154} height={4} rx={2} fill={GOLD} />

      <DoorSeam d="M119 59V87" />
      <rect x={108} y={65} width={10} height={4} rx={2} fill={paint.metal} stroke={INK} strokeWidth={STROKE.detail} />
      <Mirror x={149} y={53} fill={paint.body} />
      <path d="M172 62L178 58L184 62L178 66Z" fill={paint.metal} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />

      <Bumper d="M204 75H214V84H206C204 84 203 80 204 75Z" />
      <Bumper d="M26 75H36V84H28C25 84 24 80 26 75Z" />
      <Headlight d="M188 66C201 66 208 68 211 72L210 76C201 73 195 72 188 72Z" />
      <path d="M211 70L218 68V76Z" fill={HEADLIGHT} opacity={0.35} />
      <Taillight d="M29 64H37V71H29Z" />
      <path d="M206 84V87M210 84V87" stroke={INK} strokeWidth={STROKE.detail} strokeLinecap="round" />

      <WheelArch cx={60} fill={paint.dark} />
      <WheelArch cx={184} fill={paint.dark} />
      <Wheel cx={60} />
      <Wheel cx={184} />
    </g>
  )
}

export function CarNavy({ className }: CarArtProps = {}) {
  return (
    <CarSvg label="Xe navy đêm" className={className}>
      <CarNavyArt />
    </CarSvg>
  )
}
