import { useEffect, useRef } from 'react'
import type { MicMeter, VoiceSignal } from './micMeter'

const BAR_COUNT = 5
const MIN_HEIGHT = 5
const RANGE = 16

interface AudioBarsProps {
  meter: MicMeter
  /** True while the spoken reply is playing. */
  active: boolean
}

/**
 * Five rounded bars inside the voice button. During playback, each bar
 * follows its own frequency band plus the overall level.
 */
export function AudioBars({ meter, active }: AudioBarsProps) {
  const hostRef = useRef<HTMLSpanElement | null>(null)
  const signal = useRef<VoiceSignal>({
    level: 0,
    pitch: 0,
    bands: new Float32Array(BAR_COUNT),
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const bars = Array.from(host.children) as HTMLElement[]
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (!active || reduceMotion) {
      for (const bar of bars) bar.style.removeProperty('--bar-live-height')
      return
    }

    let frame = 0
    const tick = () => {
      meter.readSignal(signal.current)
      const level = signal.current.level
      for (let index = 0; index < bars.length; index += 1) {
        const band = signal.current.bands[index] ?? 0
        const energy = Math.min(1, band * 0.8 + level * 0.45)
        bars[index].style.setProperty('--bar-live-height', `${(MIN_HEIGHT + energy * RANGE).toFixed(1)}px`)
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frame)
      for (const bar of bars) bar.style.removeProperty('--bar-live-height')
    }
  }, [active, meter])

  return (
    <span ref={hostRef} className="voice-bars" aria-hidden="true">
      {Array.from({ length: BAR_COUNT }, (_, index) => <i key={index} />)}
    </span>
  )
}
