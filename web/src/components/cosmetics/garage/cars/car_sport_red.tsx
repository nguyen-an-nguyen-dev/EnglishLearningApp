import { GLASS, INK, METAL, STROKE, WHITE } from '../designTokens'
import {
  Bumper,
  CarSvg,
  DoorSeam,
  GlassHighlight,
  GroundShadow,
  Headlight,
  Mirror,
  Spoiler,
  Taillight,
  Wheel,
  WheelArch,
  Window,
} from '../parts/carParts'
import type { CarArtProps } from '../parts/carParts'

const paint = {
  body: '#e63946',
  dark: '#c3303c',
  glass: GLASS,
  metal: METAL,
}

/** 02 · car_sport_red — low coupe, white racing stripe, bolt-on rear wing. */
export function CarSportRedArt() {
  return (
    <g>
      <GroundShadow rx={97} />
      <Spoiler x={34} y={64} width={28} fill={paint.dark} />
      <path
        d="M34 84C26 84 22 79 23 72C24 66 30 62 40 60L62 56L82 48C90 44 104 43 120 44L150 47C160 49 166 54 172 61L198 66C210 68 216 73 216 80L214 86C213 89 209 91 204 91H44C37 91 33 88 34 84Z"
        fill={paint.body}
        stroke={INK}
        strokeWidth={STROKE.outer}
        strokeLinejoin="round"
      />
      <path
        d="M27 81C27 88 34 91 44 91H203C212 91 216 86 216 79V83C216 88 211 91 203 91H44C36 91 27 88 27 82Z"
        fill={paint.dark}
      />
      <path d="M84 48C92 44 105 43 120 44H148C155 45 161 49 166 54" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />

      <Window d="M88 51C96 47 108 45 120 46L143 48C150 50 155 54 159 59L92 59Z" glass={paint.glass} />
      <GlassHighlight d="M107 48H127L137 51L137 54H112Z" />
      <path d="M126 47V59" stroke={INK} strokeWidth={STROKE.inner} opacity={0.6} />

      <path d="M36 65C70 59 120 62 196 69L195 77C120 70 70 67 37 73Z" fill={WHITE} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M40 68C76 63 124 66 190 72" fill="none" stroke={INK} strokeWidth={2} opacity={0.22} />

      <DoorSeam d="M118 59V87" />
      <rect x={108} y={65} width={10} height={4} rx={2} fill={paint.metal} stroke={INK} strokeWidth={STROKE.detail} />
      <Mirror x={150} y={52} fill={paint.body} />
      <path d="M164 66L181 69V73L164 70Z" fill={paint.dark} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M168 67L178 69M167 70L177 72" stroke={INK} strokeWidth={STROKE.detail} opacity={0.65} />

      <Bumper d="M199 82H216V87H203C200 87 198 85 199 82Z" />
      <Bumper d="M23 82H36V87H27C24 87 22 85 23 82Z" />
      <Headlight d="M194 68L211 72L210 77L193 73Z" />
      <Taillight d="M27 62H35V68H27Z" />
      <path d="M203 87V89M208 87V89" stroke={INK} strokeWidth={STROKE.detail} strokeLinecap="round" />

      <WheelArch cx={58} fill={paint.dark} />
      <WheelArch cx={184} fill={paint.dark} />
      <Wheel cx={58} />
      <Wheel cx={184} />
    </g>
  )
}

export function CarSportRed({ className }: CarArtProps = {}) {
  return (
    <CarSvg label="Xe thể thao đỏ" className={className}>
      <CarSportRedArt />
    </CarSvg>
  )
}
