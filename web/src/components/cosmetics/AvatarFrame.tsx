import { frameEntry } from './garage/catalog'
import { FramePlain } from './garage/frames/frame_plain'
import { initialOf } from '../../utils/avatar'

export interface AvatarFrameProps {
  name: string | null | undefined
  /** `visual_key` of the equipped frame; unknown keys render the plain ring. */
  visualKey?: string | null
  /** Admin palette from the shop row; catalog art is canonical, kept for API. */
  style?: Record<string, string | null> | null
  size?: number
  className?: string
}

/**
 * The initial-letter avatar, ringed by the equipped frame.
 *
 * Four layers are already composed inside each frame component:
 * mascot back → avatar slot → material ring → paws/petals/beads. The slot is
 * fixed at (100,112) r=46, so profile, arena and rankings cannot drift.
 *
 * At 30–48 px the matching small variant drops the mascot and ornaments and
 * keeps only the material ring around the same slot.
 */
export function AvatarFrame({ name, visualKey, size = 44, className }: AvatarFrameProps) {
  const entry = frameEntry(visualKey)
  const Art = entry?.Art ?? FramePlain
  const isSmall = size <= 48
  const classes = `avatar-frame has-mascot${isSmall ? ' is-small' : ''}${className ? ` ${className}` : ''}`
  return (
    <span
      className={classes}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Art letter={initialOf(name)} fontSize={48} small={isSmall} />
    </span>
  )
}
