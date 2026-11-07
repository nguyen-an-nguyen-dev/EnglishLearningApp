import { useEffect, useRef, useState } from 'react'

export const BUDDY_TARGET_ATTR = 'data-buddy-target'
const HIGHLIGHT_MS = 4_200

/** Marks a real element so the buddy can circle it. */
export function buddyTarget(token: string): Record<string, string> {
  return { [BUDDY_TARGET_ATTR]: token }
}

export function findBuddyTarget(token: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${BUDDY_TARGET_ATTR}="${CSS.escape(token)}"]`)
}

export interface SpotlightState {
  token: string
  /** Viewport-space box of the circled element. */
  rect: { top: number; left: number; width: number; height: number }
}

/**
 * Follows a highlight token to the element that declares it, scrolls it into
 * view and reports its box so a ring can be drawn over it. The ring is a plain
 * overlay, so nothing about the target's own layout or hit area changes.
 */
export function useBuddySpotlight(token: string | null, enabled: boolean): SpotlightState | null {
  const [spot, setSpot] = useState<SpotlightState | null>(null)
  const frame = useRef<number | null>(null)
  const targetRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!token || !enabled) {
      // Cleared from a deferred callback, not synchronously in the effect body.
      const id = window.setTimeout(() => {
        setSpot(null)
        targetRef.current = null
      }, 0)
      return () => window.clearTimeout(id)
    }

    let stopped = false
    let attempts = 0

    const measure = () => {
      const element = targetRef.current
      if (!element || stopped) return
      const box = element.getBoundingClientRect()
      setSpot({
        token,
        rect: { top: box.top, left: box.left, width: box.width, height: box.height },
      })
    }

    // The destination screen may render after the navigation, so retry briefly.
    const find = () => {
      if (stopped) return
      const element = findBuddyTarget(token)
      if (!element) {
        attempts += 1
        if (attempts < 24) frame.current = window.requestAnimationFrame(() => window.setTimeout(find, 60))
        return
      }
      targetRef.current = element
      element.scrollIntoView({ block: 'center', behavior: 'smooth' })
      measure()
    }

    find()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    const clear = window.setTimeout(() => {
      stopped = true
      setSpot(null)
      targetRef.current = null
    }, HIGHLIGHT_MS)

    return () => {
      stopped = true
      window.clearTimeout(clear)
      if (frame.current !== null) window.cancelAnimationFrame(frame.current)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
    }
  }, [token, enabled])

  return spot
}

