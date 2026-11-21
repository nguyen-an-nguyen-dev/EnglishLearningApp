interface StreakFlameProps {
  size?: number
  className?: string
}

/**
 * Decorative streak mascot — a smiling flame, matching the streak design
 * reference. It is illustration art (like the booster item art), not a UI icon,
 * so it stays a hand-tuned SVG instead of a Phosphor glyph. `active` adds the
 * gentle flicker so a kept streak looks alive; an empty streak renders dimmed.
 */
export function StreakFlame({ size = 48, className = '', active = true }: StreakFlameProps & { active?: boolean }) {
  return (
    <svg
      className={`streak-flame${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      width={size}
      height={size * 1.25}
      viewBox="0 0 64 80"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M32 4C34 20 52 28 52 50A20 20 0 0 1 12 50C12 40 18 34 22 28C24 34 28 36 30 36C28 24 28 14 32 4Z"
        fill="var(--flame-outer, #ff9f2e)"
        stroke="var(--flame-ink, #14203a)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M32 40C34 48 42 50 42 58A10 10 0 0 1 22 58C22 52 28 48 32 40Z"
        fill="var(--flame-inner, #ffd23f)"
      />
      <circle cx="28" cy="56" r="2.4" fill="var(--flame-ink, #14203a)" />
      <circle cx="36" cy="56" r="2.4" fill="var(--flame-ink, #14203a)" />
      <path
        d="M29 61Q32 64 35 61"
        stroke="var(--flame-ink, #14203a)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}
