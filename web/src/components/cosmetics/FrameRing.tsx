import { useId } from 'react'
import type { FrameMotif, FrameSkin } from '../../cosmetics'

const INK = '#14203A'

function hexPoints(radius: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = ((-90 + index * 60) * Math.PI) / 180
    return `${50 + radius * Math.cos(angle)},${50 + radius * Math.sin(angle)}`
  }).join(' ')
}

/** Metal/energy ring under a mascot frame. Each motif gets its own ring language; the gradient comes from the shop palette. */
export function FrameRing({ motif, skin }: { motif: FrameMotif; skin: FrameSkin }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const gradientId = `frame-ring-${uid}`
  const accent = skin.accent ?? '#FFFFFF'
  const gradient = (
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={skin.ringDark} />
        <stop offset="34%" stopColor={skin.ring} />
        <stop offset="58%" stopColor={accent} />
        <stop offset="100%" stopColor={skin.ringDark} />
      </linearGradient>
    </defs>
  )
  const paint = `url(#${gradientId})`
  const shine = (
    <path
      d="M20 31A36 36 0 0 1 78 22"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="3"
      strokeLinecap="round"
      opacity="0.42"
    />
  )

  if (motif === 'crystal' || motif === 'neon') {
    const outer = hexPoints(48)
    const inner = hexPoints(35.5)
    return (
      <svg className="avatar-frame-ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        {gradient}
        <polygon points={outer} fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" opacity=".92" />
        <polygon
          points={hexPoints(43)}
          fill="none"
          stroke={paint}
          strokeWidth={motif === 'neon' ? 10 : 12.5}
          strokeLinejoin="round"
        />
        {motif === 'neon' && (
          <polygon
            points={hexPoints(45.5)}
            fill="none"
            stroke={accent}
            strokeWidth="1.6"
            strokeDasharray="4 5"
            strokeLinejoin="round"
            opacity=".9"
          />
        )}
        <polygon points={inner} fill="none" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" opacity=".92" />
        {shine}
      </svg>
    )
  }

  if (motif === 'wings') {
    return (
      <svg className="avatar-frame-ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        {gradient}
        <circle cx="50" cy="50" r="48" fill="none" stroke={INK} strokeWidth="1.7" opacity=".9" />
        <circle cx="50" cy="50" r="46.5" fill="none" stroke={paint} strokeWidth="2.6" />
        <circle cx="50" cy="50" r="41" fill="none" stroke={paint} strokeWidth="9.5" />
        <circle cx="50" cy="50" r="36" fill="none" stroke={INK} strokeWidth="1.7" opacity=".9" />
        {shine}
      </svg>
    )
  }

  if (motif === 'stars') {
    return (
      <svg className="avatar-frame-ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        {gradient}
        <circle cx="50" cy="50" r="48.5" fill="none" stroke={INK} strokeWidth="1.6" opacity=".85" />
        <circle cx="50" cy="50" r="43" fill="none" stroke={paint} strokeWidth="12" strokeDasharray="5 3.5" strokeLinecap="round" />
        <circle cx="50" cy="50" r="36" fill="none" stroke={INK} strokeWidth="1.5" opacity=".85" />
        {shine}
      </svg>
    )
  }

  return (
    <svg className="avatar-frame-ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {gradient}
      <circle cx="50" cy="50" r="49" fill="none" stroke={INK} strokeWidth="1.8" opacity=".92" />
      <circle cx="50" cy="50" r="43" fill="none" stroke={paint} strokeWidth={motif === 'dragon' ? 14 : 13.5} />
      {motif === 'dragon' && (
        <circle cx="50" cy="50" r="36.8" fill="none" stroke={accent} strokeWidth="2" opacity=".9" />
      )}
      <circle cx="50" cy="50" r="36" fill="none" stroke={INK} strokeWidth="1.7" opacity=".92" />
      {shine}
    </svg>
  )
}
