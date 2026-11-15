import { frameSkin } from '../../cosmetics'
import { initialOf } from '../../utils/avatar'

export interface AvatarFrameProps {
  name: string | null | undefined
  /** `visual_key` of the equipped frame; unknown keys render the plain ring. */
  visualKey?: string | null
  size?: number
  className?: string
}

/**
 * The initial-letter avatar, ringed by the equipped frame. The ring is drawn as
 * an inset box-shadow ring on the wrapper so it scales with `size` and leaves
 * the avatar circle itself untouched.
 */
export function AvatarFrame({ name, visualKey, size = 44, className }: AvatarFrameProps) {
  const skin = frameSkin(visualKey)
  return (
    <span
      className={`avatar-frame${className ? ` ${className}` : ''}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: skin.ring,
        boxShadow: `inset 0 0 0 2px ${skin.ringDark}${skin.accent ? `, 0 0 0 2px ${skin.accent}` : ''}`,
      }}
      aria-hidden="true"
    >
      <span className="avatar-frame-core">{initialOf(name)}</span>
    </span>
  )
}
