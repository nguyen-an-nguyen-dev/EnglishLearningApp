import { GOLD, INK, METAL, STROKE, WHITE } from '../designTokens'
import { CarSvg, GroundShadow, Sparkle, Taillight, Wheel } from '../parts/carParts'
import type { CarArtProps } from '../parts/carParts'

const paint = {
  body: '#e63946',
  dark: '#c3303c',
  gold: GOLD,
  metal: METAL,
}

/**
 * 09 · car_formula — low open-wheel F1. Both wings are thin planes with
 * endplates and visible struts; suspension arms connect the tub to the hubs.
 */
export function CarFormulaArt() {
  return (
    <g>
      <GroundShadow rx={96} />

      {/* Rear wing: swept side-view endplate mounted on a solid tail pylon into the tub. */}
      <path d="M36 77L33 59H49L53 72Z" fill={paint.dark} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M24 47H56L53 62H28Z" fill={paint.gold} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M26 51H54L53 56H27Z" fill={paint.dark} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M26 51H54V53H26Z" fill={paint.gold} />
      <Taillight d="M25 56H30V61H27Z" />

      {/* Low tub with a tapered engine cover and pointed nose. */}
      <path
        d="M36 82C30 78 32 72 38 70L70 66L96 62C108 60 124 60 136 64L160 70L198 76L214 80L216 84L212 88H44C38 88 34 86 36 82Z"
        fill={paint.body}
        stroke={INK}
        strokeWidth={STROKE.outer}
        strokeLinejoin="round"
      />
      <path d="M38 84H210V88H44C40 88 37 86 38 84Z" fill={paint.dark} />
      <path d="M104 62H126L132 52H112L104 62Z" fill={paint.dark} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M112 52H126V62H112Z" fill="#bfe9ff" stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M116 54H123V57H116Z" fill={WHITE} opacity={0.35} />
      <path d="M108 54C112 44 124 44 129 54" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <path d="M108 54C112 44 124 44 129 54" fill="none" stroke={paint.metal} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M132 66H156L162 76L136 74Z" fill={paint.gold} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M156 72L204 79.5L203 83L155 76Z" fill={paint.gold} />
      <rect x={82} y={68} width={16} height={4} rx={2} fill={paint.dark} />

      {/* Open-wheel suspension arms, tucked behind each tyre. */}
      <path d="M76 80L52 87M84 82L52 89" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path d="M76 80L52 87M84 82L52 89" stroke={paint.metal} strokeWidth={2} strokeLinecap="round" />
      <path d="M148 80L170 86M156 82L170 89" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path d="M148 80L170 86M156 82L170 89" stroke={paint.metal} strokeWidth={2} strokeLinecap="round" />

      {/* Diffuser instead of a road-car bumper. */}
      <path d="M30 82H46V88H34C31 88 29 85 30 82Z" fill={paint.dark} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />

      {/* Front wing: thin plane ahead of the front wheel, endplates + struts. */}
      <path d="M190 80H194V92H190Z" fill={paint.gold} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M214 80H218V92H214Z" fill={paint.gold} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M190 84H218V90H190Z" fill={paint.dark} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M190 84H218V86H190Z" fill={paint.gold} />
      <path d="M198 80V84M210 80V84" stroke={INK} strokeWidth={STROKE.inner} strokeLinecap="round" />

      <Sparkle x={68} y={63} r={4} fill={paint.gold} />
      <Sparkle x={200} y={77} r={4} fill={WHITE} />

      <Wheel cx={52} r={21} spokeColor={paint.gold} />
      <Wheel cx={170} r={19} spokeColor={paint.gold} />
    </g>
  )
}

export function CarFormula({ className }: CarArtProps = {}) {
  return (
    <CarSvg label="Xe đua công thức" className={className}>
      <CarFormulaArt />
    </CarSvg>
  )
}
