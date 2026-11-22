import { useState } from 'react'

const DEFAULT_AVATAR = '/default-avatar.svg'

export interface AvatarProps {
  src?: string | null
  size?: number
  alt?: string
  className?: string
  loading?: 'eager' | 'lazy'
}

/** One resilient avatar surface for every learner image in the app. */
export function Avatar({ src, size = 44, alt = '', className = '', loading = 'lazy' }: AvatarProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const imageSrc = src && failedSource !== src ? src : DEFAULT_AVATAR

  return (
    <span
      className={`user-avatar${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      aria-hidden={alt ? undefined : true}
    >
      <img
        src={imageSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          if (src) setFailedSource(src)
        }}
      />
    </span>
  )
}
