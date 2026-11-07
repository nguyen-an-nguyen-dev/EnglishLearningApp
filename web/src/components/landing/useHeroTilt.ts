import { useEffect, useRef } from 'react'

interface HeroTiltOptions {
  /** How far the pointer can push the tilt, in degrees. */
  rangeX?: number
  rangeY?: number
  /** 0..1 — how much of the remaining distance is covered each frame. */
  easing?: number
}

/** Reads `--tilt-x/-y/-z` off the element so CSS stays the source of truth for
 *  the resting angle (the mobile breakpoint sets a flatter one). */
function readBaseTilt(element: HTMLElement): { x: number; y: number; z: number } {
  const styles = getComputedStyle(element)
  const num = (name: string, fallback: number): number => {
    const raw = styles.getPropertyValue(name).trim().replace('deg', '')
    const value = Number(raw)
    return Number.isFinite(value) ? value : fallback
  }
  return {
    x: num('--tilt-x', 9),
    y: num('--tilt-y', -13),
    z: num('--tilt-z', 1.2),
  }
}

/**
 * Smoothed pointer tilt for the landing hero card.
 *
 * A CSS keyframe animation would fight with the pointer transform, so both the
 * idle float and the pointer offset are composed here and written once per frame
 * on the element itself. The motion is an exponential ease toward the target
 * (fast at first, then settling), which is what makes it read as weight rather
 * than a snap.
 *
 * Skips pointer tracking on touch, honours `prefers-reduced-motion`, pauses while
 * off-screen, and re-reads the resting angle when the viewport crosses a
 * breakpoint so the CSS tablet/phone tilt is not overwritten by the hook.
 */
export function useHeroTilt<T extends HTMLElement>(
  options: HeroTiltOptions = {},
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null)
  const { rangeX = 7, rangeY = 10, easing = 0.075 } = options

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const coarsePointer = window.matchMedia('(hover: none)').matches
    let base = readBaseTilt(element)
    let frame = 0
    let visible = true
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    let start = performance.now()

    const onPointerMove = (event: PointerEvent) => {
      if (coarsePointer) return
      const box = element.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) return
      const nx = Math.max(-1, Math.min(1, (event.clientX - (box.left + box.width / 2)) / (box.width / 2)))
      const ny = Math.max(-1, Math.min(1, (event.clientY - (box.top + box.height / 2)) / (box.height / 2)))
      targetY = nx * rangeY
      targetX = -ny * rangeX
    }

    const onPointerLeave = () => {
      targetX = 0
      targetY = 0
    }

    const tick = (now: number) => {
      const elapsed = (now - start) / 1000
      currentX += (targetX - currentX) * easing
      currentY += (targetY - currentY) * easing

      // Idle drift: small, slow, and always running so the card never looks frozen.
      const float = Math.sin(elapsed * 0.62) * 4
      const roll = Math.sin(elapsed * 0.41) * 0.5

      element.style.transform =
        `translate3d(0, ${float.toFixed(2)}px, 0) `
        + `rotateX(${(base.x + currentX).toFixed(2)}deg) `
        + `rotateY(${(base.y + currentY).toFixed(2)}deg) `
        + `rotateZ(${(base.z + roll).toFixed(2)}deg)`

      frame = window.requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver((entries) => {
      const next = entries[0]?.isIntersecting ?? true
      if (next === visible) return
      visible = next
      if (visible) {
        start = performance.now()
        frame = window.requestAnimationFrame(tick)
      } else {
        window.cancelAnimationFrame(frame)
        frame = 0
      }
    }, { threshold: 0.05 })

    // The breakpoint that changes the resting tilt must win over the hook.
    const breakpoint = window.matchMedia('(max-width: 760px)')
    const onBreakpoint = () => {
      base = readBaseTilt(element)
      currentX = 0
      currentY = 0
      targetX = 0
      targetY = 0
    }

    observer.observe(element)
    breakpoint.addEventListener('change', onBreakpoint)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerleave', onPointerLeave)
    frame = window.requestAnimationFrame(tick)

    return () => {
      observer.disconnect()
      breakpoint.removeEventListener('change', onBreakpoint)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerleave', onPointerLeave)
      if (frame) window.cancelAnimationFrame(frame)
      element.style.transform = ''
    }
  }, [rangeX, rangeY, easing])

  return ref
}
