import type { SpotlightState } from './useBuddySpotlight'

/**
 * Draws a ring around the element the buddy pointed at. Pointer events are off,
 * so the learner can still click whatever is circled.
 */
export function BuddySpotlight({ spot }: { spot: SpotlightState | null }) {
  if (!spot) return null
  const { top, left, width, height } = spot.rect
  const pad = 8
  return (
    <div
      className="buddy-spotlight"
      aria-hidden="true"
      style={{
        top: `${Math.max(4, top - pad)}px`,
        left: `${Math.max(4, left - pad)}px`,
        width: `${width + pad * 2}px`,
        height: `${height + pad * 2}px`,
      }}
    />
  )
}
