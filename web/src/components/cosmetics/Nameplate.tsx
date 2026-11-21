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

/**
 * The band that sits behind a display name. It hugs its own text
 * (inline-flex, own padding) and appears wherever a name is shown: ranking
 * rows and the arena scoreboard. The profile paints the same skin as the
 * background of its own blocks instead — see `nameplateSurface.ts`.
 */
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
