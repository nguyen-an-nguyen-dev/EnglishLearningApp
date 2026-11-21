import type { CSSProperties } from 'react'
import { Crown, Diamond, Medal, Star } from '@phosphor-icons/react'
import type { LeagueTier } from '../../types/gamification'
import { asLeagueTier } from '../../utils/league'

const CREST_ICON = {
  bronze: Star,
  silver: Medal,
  gold: Crown,
  diamond: Diamond,
} satisfies Record<LeagueTier, typeof Star>

export interface LeagueCrestProps {
  tier: string | null | undefined
  /** Outer height in pixels; the shield keeps a 1:1.12 ratio. */
  size?: number
  className?: string
}

/**
 * The shield that identifies a league tier. Each tier gets its own glyph and
 * gradient so a diamond row cannot be mistaken for a bronze one at a glance.
 */
export function LeagueCrest({ tier, size = 64, className }: LeagueCrestProps) {
  const key = asLeagueTier(tier)
  const Icon = CREST_ICON[key]
  const style = { '--crest-size': `${size}px` } as CSSProperties

  return (
    <span
      className={`league-crest${className ? ` ${className}` : ''}`}
      data-league-tier={key}
      style={style}
      aria-hidden="true"
    >
      <span className="league-crest-inner">
        <Icon size={Math.max(12, Math.round(size * 0.4))} weight="fill" />
      </span>
    </span>
  )
}
