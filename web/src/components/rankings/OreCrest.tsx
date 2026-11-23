import type { CSSProperties } from 'react'
import { asLeagueTier } from '../../utils/league'

export interface OreCrestProps {
  tier: string | null | undefined
  /** Outer height in px. Omit to let CSS (`--crest-size`) drive the size. */
  size?: number
  /** A tier above the learner's own is drawn dimmed until it is reached. */
  locked?: boolean
  className?: string
}

export function OreCrest({ tier, size, locked = false, className }: OreCrestProps) {
  const key = asLeagueTier(tier)
  const style = size === undefined ? undefined : ({ '--crest-size': `${size}px` } as CSSProperties)

  return (
    <img
      className={`ore-crest${locked ? ' is-locked' : ''}${className ? ` ${className}` : ''}`}
      data-league-tier={key}
      style={style}
      src={`/ranks/${key}.png`}
      alt=""
      aria-hidden="true"
    />
  )
}
