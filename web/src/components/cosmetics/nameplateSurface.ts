import type { CSSProperties } from 'react'
import { nameplateSkin } from '../../cosmetics'

export interface NameplateSurface {
  /** Extra class to add to the block; empty when the plate is transparent. */
  className: string
  /** CSS variables consumed by the `.is-plated` rules in the stylesheets. */
  style?: CSSProperties
}

/**
 * Turns the equipped nameplate into a block surface instead of a band around
 * one name. The profile head and the sidebar profile row own a real width, so
 * the plate skin is actually visible there; a plain plate leaves the block's
 * usual paper surface untouched.
 */
export function nameplateSurface(
  visualKey: string | null | undefined,
  style?: Record<string, string | null> | null,
): NameplateSurface {
  const skin = nameplateSkin(visualKey, style)
  if (skin.bg === 'transparent') return { className: '' }
  return {
    className: ' is-plated',
    style: {
      '--plate-bg': skin.bg,
      '--plate-fg': skin.fg ?? 'inherit',
      '--plate-edge': skin.edge ?? 'transparent',
    } as CSSProperties,
  }
}
