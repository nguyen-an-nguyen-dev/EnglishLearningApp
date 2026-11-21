import { useEffect, useRef, useState } from 'react'

export const BUDDY_TARGET_ATTR = 'data-buddy-target'
const HIGHLIGHT_MS = 4_200

export function findBuddyTarget(token: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${BUDDY_TARGET_ATTR}="${CSS.escape(token)}"]`)
}

export interface SpotlightState {
  token: string
  /** Viewport-space box of the circled element. */
  rect: { top: number; left: number; width: number; height: number }
}

/**
 * Follows a highlight token to its element, scrolls it into view and reports its
 * box so a ring can be drawn. The ring is a plain overlay, so the target's own
 * layout and hit area are unchanged.
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
    let measureFrame: number | null = null

    const measure = () => {
      const element = targetRef.current
      if (!element || stopped) return
      const box = element.getBoundingClientRect()
      setSpot((previous) => {
        if (
          previous &&
          previous.token === token &&
          previous.rect.top === box.top &&
          previous.rect.left === box.left &&
          previous.rect.width === box.width &&
          previous.rect.height === box.height
        ) {
          return previous
        }
        return {
          token,
          rect: { top: box.top, left: box.left, width: box.width, height: box.height },
        }
      })
    }

    // Scroll and resize can fire several times per frame; measuring once per
    // frame avoids repeated layout reads and redundant React renders.
    const scheduleMeasure = () => {
      if (measureFrame !== null || stopped) return
      measureFrame = window.requestAnimationFrame(() => {
        measureFrame = null
        measure()
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
    window.addEventListener('resize', scheduleMeasure)
    window.addEventListener('scroll', scheduleMeasure, { passive: true })
    const clear = window.setTimeout(() => {
      stopped = true
      setSpot(null)
      targetRef.current = null
    }, HIGHLIGHT_MS)

    return () => {
      stopped = true
      window.clearTimeout(clear)
      if (frame.current !== null) window.cancelAnimationFrame(frame.current)
      if (measureFrame !== null) window.cancelAnimationFrame(measureFrame)
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('scroll', scheduleMeasure)
    }
  }, [token, enabled])

  return spot
}

