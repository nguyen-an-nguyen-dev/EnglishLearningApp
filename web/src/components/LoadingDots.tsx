export interface LoadingDotsProps {
  /**
   * The wait line, announced to assistive tech via `role="status"`.
   * Omit it where a heading already carries the message — the dots then render
   * as decoration only and the existing heading does the announcing.
   */
  label?: string
  /** `large` matches the roadmap/leaderboard state blocks; `small` for inline rows. */
  size?: 'small' | 'large'
  className?: string
}

/**
 * Three pulsing dots for a pending region — the same rhythm as the arena
 * matchmaking orb (`.arena-v2-search-orb i`: 1.1s per cycle, 180ms stagger),
 * reused here so waiting looks the same wherever it happens.
 *
 * The dots are decoration (`aria-hidden`); the wait is announced either by the
 * label's `role="status"` or, when `label` is omitted, by the surrounding
 * heading, so assistive tech never hears three meaningless elements.
 *
 * Under `prefers-reduced-motion` the lift is dropped and only the opacity wave
 * runs (`.loading-dot-soft`), so the indicator still reads as working without
 * any spatial movement.
 */
export function LoadingDots({ label, size = 'large', className = '' }: LoadingDotsProps) {
  return (
    <div className={`loading-dots is-${size}${className ? ' ' + className : ''}`}>
      <span className="loading-dots-track" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {label ? (
        <span className="loading-dots-label" role="status">
          {label}
        </span>
      ) : null}
    </div>
  )
}
