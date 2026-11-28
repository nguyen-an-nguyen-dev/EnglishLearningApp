import { useEffect, useState } from 'react'

export interface SpotlightRequest {
  token: string
}

export interface SpotlightState {
  request: SpotlightRequest
  rect: { top: number; left: number; width: number; height: number }
}

export function useBuddySpotlight(request: SpotlightRequest | null): SpotlightState | null {
  const [spot, setSpot] = useState<SpotlightState | null>(null)

  useEffect(() => {
    if (!request) return
    const activeRequest = request
    const delay = request.token === 'control:arena-start' ? 1_000 : 0
    const startedAt = performance.now()
    let target: HTMLElement | null = null
    let timer: number | undefined
    let frame: number | undefined

    function measure() {
      frame = undefined
      if (!target?.isConnected || !target.getClientRects().length) {
        setSpot(null)
        return
      }
      const { top, left, width, height } = target.getBoundingClientRect()
      setSpot((previous) => {
        const rect = previous?.rect
        return previous?.request === activeRequest && rect?.top === top && rect.left === left &&
          rect.width === width && rect.height === height ? previous : { request: activeRequest, rect: { top, left, width, height } }
      })
    }

    function scheduleMeasure() {
      frame ??= window.requestAnimationFrame(measure)
    }

    const observer = new ResizeObserver(scheduleMeasure)
    const selector = `[data-buddy-target="${CSS.escape(request.token)}"]`
    function find() {
      target = document.querySelector<HTMLElement>(selector)
      if (!target?.getClientRects().length) {
        if (performance.now() - startedAt < 8_000) timer = window.setTimeout(find, 80)
        return
      }
      target.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      })
      observer.observe(target)
      scheduleMeasure()
      timer = window.setTimeout(() => {
        target = null
        observer.disconnect()
        setSpot(null)
      }, 4_200)
    }

    timer = window.setTimeout(find, delay)
    window.addEventListener('scroll', scheduleMeasure, { capture: true, passive: true })
    window.addEventListener('resize', scheduleMeasure)
    return () => {
      window.clearTimeout(timer)
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', scheduleMeasure, true)
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [request])

  return spot?.request === request ? spot : null
}
