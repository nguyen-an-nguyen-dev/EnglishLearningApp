import { useEffect, useRef, useState } from 'react'
import './streak-flame.css'

export type StreakFlameState = 'happy' | 'sad' | 'ice' | 'grey'

interface StreakFlameProps {
  size?: number
  state: StreakFlameState
}

export function StreakFlame({ size = 48, state }: StreakFlameProps) {
  const flameRef = useRef<HTMLSpanElement>(null)
  const [playing, setPlaying] = useState(false)
  const height = size * 86 / 64

  useEffect(() => {
    const flame = flameRef.current
    if (!flame || typeof IntersectionObserver === 'undefined') return

    let inView = false
    const updatePlayback = () => setPlaying(inView && !document.hidden)
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      updatePlayback()
    })
    observer.observe(flame)
    document.addEventListener('visibilitychange', updatePlayback)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', updatePlayback)
    }
  }, [])

  return (
    <span
      ref={flameRef}
      className="streak-flame"
      data-playing={playing ? 'true' : undefined}
      style={{ width: size, height }}
      aria-hidden="true"
    >
      <img
        key={state}
        className="streak-flame-sprite"
        src={`/media/flames/flame-${state}.svg`}
        width={size}
        height={height * 5}
        alt=""
      />
    </span>
  )
}
