import { HEADLIGHT, INK, METAL, STROKE, WHITE } from '../designTokens'
import {
  CarSvg,
  GroundShadow,
  Taillight,
  Wheel,
  WheelArch,
} from '../parts/carParts'
import type { CarArtProps } from '../parts/carParts'

const paint = {
  body: '#38c98a',
  dark: '#2b9b6b',
  metal: METAL,
}

/** 08 · car_monster — tall buggy on R26 knobby wheels, roll cage and shocks. */
export function CarMonsterArt() {
  return (
    <g>
      <GroundShadow rx={95} />

      {/* High tub: the wheels sit below the chassis line, not beside a car body. */}
      <path
        d="M52 54C49 50 51 46 57 44L78 41H150L168 43L192 47C199 48 204 51 206 54L204 58C202 60 198 61 193 61H58C54 61 52 59 52 54Z"
        fill={paint.body}
        stroke={INK}
        strokeWidth={STROKE.outer}
        strokeLinejoin="round"
      />
      <path d="M55 58H203V60C201 61 198 61 193 61H58C55 61 54 60 55 58Z" fill={paint.dark} />
      <path d="M83 42C102 40 132 40 150 42" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />

      <path d="M58 45H82V57H58Z" fill={paint.dark} stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M62 47V55M68 47V55M74 47V55" stroke={METAL} strokeWidth={3} strokeLinecap="round" />
      <path d="M196 48H206V58H196Z" fill={paint.metal} stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M199 50V56M203 50V56" stroke={INK} strokeWidth={STROKE.detail} strokeLinecap="round" opacity={0.6} />
      <circle cx={196} cy={46} r={5.5} fill={HEADLIGHT} stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M202 43L218 39V51L202 49Z" fill={HEADLIGHT} opacity={0.35} />
      <Taillight d="M53 46H59V52H53Z" />

      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M90 41V28H145V41M90 28L145 41M145 28L90 41" stroke={INK} strokeWidth={6} />
        <path d="M90 41V28H145V41M90 28L145 41M145 28L90 41" stroke={METAL} strokeWidth={2.6} />
      </g>

      <path d="M105 53V45H123V53Z" fill={paint.dark} stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M105 45V38H111V45Z" fill={paint.dark} stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M145 32H159L162 44H147Z" fill="#bfe9ff" stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M148 35H156L157 40H149Z" fill={WHITE} opacity={0.35} />

      <path d="M61 51L35 42M61 51L32 41" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <path d="M61 51L35 42M61 51L32 41" stroke={METAL} strokeWidth={3.4} strokeLinecap="round" />
      <path d="M31 38L25 36L27 44L33 45Z" fill={INK} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />

      <circle cx={131} cy={50} r={5.5} fill={WHITE} stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M131 46L132.5 49L136 50L132.5 51L131 54L129.5 51L126 50L129.5 49Z" fill={paint.dark} />

      <WheelArch cx={62} r={26} fill={paint.dark} />
      <WheelArch cx={182} r={26} fill={paint.dark} />
      <g strokeLinecap="round">
        <path d="M84 56L68 78M162 56L176 78" stroke={INK} strokeWidth={5} />
        <path d="M84 56L68 78M162 56L176 78" stroke={METAL} strokeWidth={2.2} />
        <path d="M77 61H85M73 67H81M69 73H77M159 61H167M163 67H171M167 73H175" stroke={INK} strokeWidth={STROKE.detail} opacity={0.65} />
      </g>

      <Wheel cx={62} r={26} tread />
      <Wheel cx={182} r={26} tread />
    </g>
  )
}

export function CarMonster({ className }: CarArtProps = {}) {
  return (
    <CarSvg label="Xe quái vật" className={className}>
      <CarMonsterArt />
    </CarSvg>
  )
}
