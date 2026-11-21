/** Bác Turbo, drawn inline as procedural SVG so it scales crisply and needs no asset. One component serves the stall banner and the coaching bubble. */
export function TurboMascot({ className, label = 'Bác Turbo, chủ gara, đang vẫy tay chào' }: { className?: string; label?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 240"
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMax meet"
    >
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Arms behind the torso so the outline stays clean. */}
        <path d="M42 150Q14 140 18 100" stroke="#14203a" strokeWidth="30" fill="none" />
        <path d="M42 150Q14 140 18 100" stroke="#ff9f2e" strokeWidth="22" fill="none" />
        <path d="M158 150Q186 170 176 200" stroke="#14203a" strokeWidth="30" fill="none" />
        <path d="M158 150Q186 170 176 200" stroke="#ff9f2e" strokeWidth="22" fill="none" />

        <g stroke="#14203a" strokeWidth="4">
          <path d="M36 240V150q0-34 34-38h60q34 4 34 38v90z" fill="#ff9f2e" />
          <rect x="68" y="165" width="64" height="75" rx="8" fill="#2b6cb0" />
          <rect x="170" y="168" width="9" height="52" rx="4" fill="#c9d6ea" transform="rotate(20 174 195)" />
          <circle cx="18" cy="92" r="12" fill="#f2c29b" />
          <circle cx="176" cy="204" r="12" fill="#f2c29b" />
          <circle cx="62" cy="82" r="7" fill="#f2c29b" />
          <circle cx="138" cy="82" r="7" fill="#f2c29b" />
          <circle cx="100" cy="78" r="38" fill="#f2c29b" />
          <path d="M60 70q0-44 40-44t40 44z" fill="#19b6f0" />
          <path d="M96 66h64q8 0 8 9H96z" fill="#0e8fc2" />
          <path d="M78 98q22-12 44 0q-6 12-22 6q-16 6-22-6z" fill="#5a3a22" />
        </g>

        <circle cx="86" cy="84" r="4" fill="#14203a" />
        <circle cx="114" cy="84" r="4" fill="#14203a" />
        <path d="M90 114q10 8 20 0" stroke="#14203a" strokeWidth="3" fill="none" />
      </g>
    </svg>
  )
}
