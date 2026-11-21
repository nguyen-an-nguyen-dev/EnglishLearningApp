import type { CSSProperties } from 'react'
import { Coins, Crown, Cube, Diamond, Hexagon, Lightning, Shield } from '@phosphor-icons/react'
import type { LeagueTier } from '../../types/gamification'
import { asLeagueTier } from '../../utils/league'

/** One glyph per ore, so a tier reads at a glance even before its colour does. */
const CREST_ICON: Record<LeagueTier, typeof Cube> = {
  coal: Cube,
  copper: Coins,
  iron: Shield,
  gold: Crown,
  redstone: Lightning,
  lapis: Hexagon,
  diamond: Diamond,
}

/** Lapis and diamond read as cut stones; the metals stay shields. */
const GEM_TIERS: readonly LeagueTier[] = ['lapis', 'diamond']

export interface OreCrestProps {
  tier: string | null | undefined
  /** Outer height in px. Omit to let CSS (`--crest-size`) drive the size. */
  size?: number
  /** A tier above the learner's own is drawn dimmed until it is reached. */
  locked?: boolean
  className?: string
}

/** The shield that identifies a league tier. Each ore gets its own colour ramp and glyph. */
export function OreCrest({ tier, size, locked = false, className }: OreCrestProps) {
  const key = asLeagueTier(tier)
  const Icon = CREST_ICON[key]
  const gem = GEM_TIERS.includes(key)
  const style = size === undefined ? undefined : ({ '--crest-size': `${size}px` } as CSSProperties)

  return (
    <span
      className={
        `ore-crest${gem ? ' is-gem' : ''}${locked ? ' is-locked' : ''}${className ? ` ${className}` : ''}`
      }
      data-league-tier={key}
      style={style}
      aria-hidden="true"
    >
      <span className="ore-crest-inner">
        <Icon size={Math.max(12, Math.round((size ?? 54) * 0.4))} weight="fill" />
      </span>
    </span>
  )
}
