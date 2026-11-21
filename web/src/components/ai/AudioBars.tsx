import { useEffect, useMemo, useRef } from 'react'
import type { MicMeter } from './micMeter'

export interface AudioBarsProps {
  meter: MicMeter
  /** True while the microphone is open: bars follow real voice. */
  active: boolean
  bands?: number
  /** Tallest a bar can grow, in px (the container is exactly this tall). */
  size?: number
  className?: string
}

/**
 * A compact row of rounded vertical bars. Idle they breathe (CSS); while listening
 * each bar is written to the DOM from the AnalyserNode every frame, so React never
 * re-renders for audio and the motion is real, not faked.
 */
export function AudioBars({ meter, active, bands = 5, size = 26, className }: AudioBarsProps) {
  const hostRef = useRef<HTMLSpanElement | null>(null)
  const levels = useMemo(() => new Float32Array(bands), [bands])
  const minHeight = Math.max(3, Math.round(size * 0.16))
  const range = size - minHeight

  useEffect(() => {
    if (!active) return
    const host = hostRef.current
    if (!host) return
    const bars = Array.from(host.children) as HTMLElement[]
    let frame = 0
    const tick = () => {
      meter.read(levels)
      for (let index = 0; index < bars.length; index += 1) {
        const height = minHeight + levels[index] * range
        bars[index].style.height = `${height.toFixed(1)}px`
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frame)
      for (const bar of bars) bar.style.height = ''
    }
  }, [active, meter, levels, minHeight, range])

  return (
    <span
      ref={hostRef}
      className={`audio-bars${active ? ' is-active' : ' is-idle'}${className ? ` ${className}` : ''}`}
      style={{ height: `${size}px` }}
      aria-hidden="true"
    >
      {Array.from({ length: bands }, (_, index) => <i key={index} />)}
    </span>
  )
}
