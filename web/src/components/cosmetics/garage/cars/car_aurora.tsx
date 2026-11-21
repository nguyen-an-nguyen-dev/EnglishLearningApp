import { BLUE, GLASS, HEADLIGHT, INK, METAL, PURPLE, STROKE, TAILLIGHT, WHITE } from '../designTokens'
import { CarSvg, GroundShadow, HoverPad, Sparkle } from '../parts/carParts'
import type { CarArtProps } from '../parts/carParts'

const paint = {
  body: '#7b83ff',
  dark: '#5a61d6',
  glass: GLASS,
}

/** 05 · car_aurora — wheel-less hover coupe, two glowing pads 6 above ground. */
export function CarAuroraArt() {
  return (
    <g>
      <GroundShadow rx={78} />
      <path d="M30 76C28 66 34 58 46 56L72 52C84 49 94 46 108 46H154C168 46 180 52 190 60L206 68C214 71 218 76 216 84L211 90C209 93 204 94 198 94H42C34 94 30 88 30 82Z" fill={paint.body} stroke={INK} strokeWidth={STROKE.outer} strokeLinejoin="round" />
      <path d="M33 82C33 88 38 93 46 93H198C205 93 211 90 214 85V87C212 91 206 94 198 94H42C35 94 33 89 33 84Z" fill={paint.dark} />
      <path d="M112 49C124 46 143 46 155 48L172 60L108 62Z" fill={paint.glass} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M121 50C132 48 145 48 154 49L163 54L124 56Z" fill={WHITE} opacity={0.35} />
      <path d="M94 64H170" stroke={INK} strokeWidth={STROKE.inner} opacity={0.35} strokeLinecap="round" />

      <path d="M40 74C70 66 100 78 130 70C160 62 185 72 205 68L206 75C185 79 160 69 130 77C100 85 70 73 40 81Z" fill={BLUE} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M44 80C72 73 100 84 128 77C157 70 184 78 203 74L203 79C184 83 157 75 128 82C100 89 72 78 44 85Z" fill={PURPLE} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M48 77C76 70 102 81 130 74C158 67 184 76 200 72" fill="none" stroke={WHITE} strokeWidth={2} opacity={0.35} strokeLinecap="round" />

      <path d="M66 92H74V98H66Z" fill={paint.dark} stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M168 92H176V98H168Z" fill={paint.dark} stroke={INK} strokeWidth={STROKE.inner} />
      <HoverPad x={70} y={97.5} rx={22} ry={4.5} />
      <HoverPad x={172} y={97.5} rx={22} ry={4.5} />

      <path d="M198 70C207 70 212 73 214 77L213 82C207 79 203 78 197 78Z" fill={HEADLIGHT} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M32 69H40V76H32Z" fill={TAILLIGHT} stroke={INK} strokeWidth={STROKE.inner} />
      <rect x={34} y={84.5} width={16} height={3} rx={1.5} fill={METAL} />

      <Sparkle x={52} y={53} r={4} fill={WHITE} />
      <Sparkle x={203} y={66} r={4} fill={HEADLIGHT} />
    </g>
  )
}

export function CarAurora({ className }: CarArtProps = {}) {
  return (
    <CarSvg label="Xe cực quang" className={className}>
      <CarAuroraArt />
    </CarSvg>
  )
}
