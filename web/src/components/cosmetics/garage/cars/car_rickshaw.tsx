import { GLASS, INK, METAL, STROKE, WHITE } from '../designTokens'
import {
  Bumper,
  CarSvg,
  GroundShadow,
  Headlight,
  Taillight,
  Wheel,
  WheelArch,
} from '../parts/carParts'
import type { CarArtProps } from '../parts/carParts'

const paint = {
  body: '#38c98a',
  dark: '#2b9b6b',
  canopy: '#19b6f0',
  trim: '#ffd23f',
}

/** 07 · car_rickshaw - low three-wheel lam: small front cab, open rear bench under a scalloped fabric canopy, one front wheel and a dual rear axle. */
export function CarRickshawArt() {
  return (
    <g>
      <GroundShadow rx={70} />

      {/* Far rear wheel: same axle, mostly hidden behind the near one. */}
      <g className="car-wheel">
        <circle cx={84} cy={94} r={14} fill={INK} opacity={0.3} />
        <circle cx={84} cy={94} r={7.7} fill={METAL} stroke={INK} strokeWidth={STROKE.inner} opacity={0.3} />
      </g>

      <path
        d="M64 41C64 34 70 30 78 30H160C168 30 180 34 186 40L183 44Q172 49 161 44Q150 49 139 44Q128 49 117 44Q106 49 95 44Q84 49 73 44Z"
        fill={paint.canopy}
        stroke={INK}
        strokeWidth={STROKE.outer}
        strokeLinejoin="round"
      />
      <path d="M72 34C98 31 148 31 180 35" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.55} />
      <path d="M70 39C100 36 148 36 182 40" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.75} />
      <rect x={70} y={42} width={4} height={35} rx={2} fill={METAL} stroke={INK} strokeWidth={STROKE.detail} />
      <rect x={168} y={42} width={4} height={20} rx={2} fill={METAL} stroke={INK} strokeWidth={STROKE.detail} />

      <path
        d="M55 90C51 90 49 87 49 84L50 80C51 77 54 76 58 76H144V87C144 90 141 91 137 91H61C58 91 56 90 55 90Z"
        fill={paint.body}
        stroke={INK}
        strokeWidth={STROKE.outer}
        strokeLinejoin="round"
      />
      <path d="M52 86C52 89 57 91 62 91H137C141 91 144 89 144 87V89C144 90 140 91 137 91H61C56 91 52 89 52 87Z" fill={paint.dark} />
      <rect x={58} y={77} width={82} height={3} rx={1.5} fill={paint.trim} />
      <path d="M60 80V87M136 80V87" stroke={INK} strokeWidth={STROKE.detail} strokeLinecap="round" opacity={0.5} />

      <path d="M90 76V68C90 66 92 65 94 65H128C130 65 132 67 132 69V76Z" fill={paint.dark} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <rect x={88} y={52} width={8} height={24} rx={3} fill={paint.dark} stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M98 76V86M124 76V86" stroke={INK} strokeWidth={STROKE.inner} opacity={0.45} strokeLinecap="round" />

      <path
        d="M140 90V68C140 64 143 61 149 60H168C179 60 187 65 190 72L191 82C191 87 187 90 182 90H146C142 90 140 89 140 90Z"
        fill={paint.body}
        stroke={INK}
        strokeWidth={STROKE.outer}
        strokeLinejoin="round"
      />
      <path d="M143 84C143 88 147 90 152 90H182C187 90 191 87 191 82V85C191 88 186 90 182 90H146C144 90 143 88 143 86Z" fill={paint.dark} />
      <rect x={146} y={77} width={38} height={3} rx={1.5} fill={paint.trim} />
      <path d="M160 64V86" stroke={INK} strokeWidth={STROKE.inner} opacity={0.35} strokeLinecap="round" />
      <rect x={163} y={71} width={9} height={4} rx={2} fill={METAL} stroke={INK} strokeWidth={STROKE.detail} />

      <path d="M146 64H160L162 76H146Z" fill={GLASS} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M149 67H157L158 72H149Z" fill={WHITE} opacity={0.35} />
      <path d="M168 44H179L184 62H169Z" fill={GLASS} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M171 47H177L180 54H172Z" fill={WHITE} opacity={0.35} />

      <Bumper d="M182 80H191V87H185C182 87 180 84 182 80Z" />
      <Bumper d="M46 84H54V90H48C45 90 44 87 46 84Z" />
      <Headlight d="M181 70C187 70 189 72 190 76L189 80C185 78 182 77 179 77Z" />
      <Taillight d="M50 78H56V84H50Z" />

      <WheelArch cx={78} r={14} fill={paint.dark} />
      <WheelArch cx={176} r={14} fill={paint.dark} />
      <Wheel cx={78} r={14} />
      <Wheel cx={176} r={14} />
    </g>
  )
}

export function CarRickshaw({ className }: CarArtProps = {}) {
  return (
    <CarSvg label="Xe lam tốc độ" className={className}>
      <CarRickshawArt />
    </CarSvg>
  )
}
