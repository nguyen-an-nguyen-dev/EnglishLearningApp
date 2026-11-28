import { frameEntry } from './garage/catalog'
import { FramePlain } from './garage/frames/frame_plain'
import { Avatar } from '../Avatar'

interface AvatarFrameProps {
  avatarUrl?: string | null
  /** `visual_key` of the equipped frame; unknown keys render the plain ring. */
  visualKey?: string | null
  size?: number
  className?: string
}

/** Renders the avatar in its catalog frame, using the compact ring at small sizes. */
export function AvatarFrame({ avatarUrl, visualKey, size = 44, className }: AvatarFrameProps) {
  const entry = frameEntry(visualKey)
  const Art = entry?.Art ?? FramePlain
  const isSmall = size <= 48
  const classes = `avatar-frame${isSmall ? ' is-small' : ''}${className ? ` ${className}` : ''}`
  return (
    <span
      className={classes}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Art letter="" fontSize={48} small={isSmall} />
      <Avatar src={avatarUrl} size={size * 0.42} className="avatar-frame-image" />
    </span>
  )
}
