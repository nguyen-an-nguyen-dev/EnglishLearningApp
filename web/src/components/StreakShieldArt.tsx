interface StreakShieldArtProps {
  size?: number
}

/**
 * The streak-shield booster illustration, shared by the Gara card and the
 * sidebar streak line so the same shield shows up everywhere the shield count
 * is mentioned. It is item art, so it keeps the hand-tuned SVG instead of a
 * Phosphor glyph.
 */
export function StreakShieldArt({ size = 52 }: StreakShieldArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M32 4l24 8v18c0 16-10 26-24 30C18 56 8 46 8 30V12z"
        fill="#38c98a"
        stroke="#14203a"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M32 20c6 8 10 12 10 18a10 10 0 0 1-20 0c0-6 4-8 5-14 3 2 4 4 5 6 0-4 0-7 0-10z"
        fill="#ffd23f"
        stroke="#14203a"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  )
}
