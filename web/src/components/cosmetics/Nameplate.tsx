import type { CSSProperties, ReactNode } from 'react'
import { nameplateSkin } from '../../cosmetics'

export interface NameplateProps {
  /** `visual_key` of the equipped nameplate; plain renders text with no band. */
  visualKey?: string | null
  style?: Record<string, string | null> | null
  children: ReactNode
  className?: string
  /** Compact variant for dense rows (rankings, arena scoreboard). */
  dense?: boolean
}

/** Band behind a display name (inline-flex, own padding), used in ranking rows and the arena scoreboard. The profile paints the same skin as a block surface instead - see nameplateSurface.ts. */
export function Nameplate({ visualKey, style, children, className, dense = false }: NameplateProps) {
  const skin = nameplateSkin(visualKey, style)
  const hasBand = skin.bg !== 'transparent'
  const bandStyle: CSSProperties | undefined = hasBand
    ? {
        background: skin.bg,
        color: skin.fg ?? undefined,
        boxShadow: skin.edge ? `inset 0 0 0 1px ${skin.edge}` : undefined,
      }
    : undefined

  return (
    <span
      className={`nameplate${hasBand ? ' is-banded' : ''}${dense ? ' is-dense' : ''}${className ? ` ${className}` : ''}`}
      style={bandStyle}
    >
      {children}
    </span>
  )
}
