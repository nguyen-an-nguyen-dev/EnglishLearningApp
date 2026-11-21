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

/** Initial-letter avatar ringed by the equipped frame. Frames compose four layers around a fixed (100,112) r=46 slot, so profile, arena and rankings cannot drift; small variants keep only the material ring. */
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
