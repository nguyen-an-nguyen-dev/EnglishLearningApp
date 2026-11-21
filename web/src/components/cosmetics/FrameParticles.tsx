import type { CSSProperties } from 'react'
import type { FrameMotif } from '../../cosmetics'

type ParticleKind = 'ember' | 'star' | 'petal' | 'bubble' | 'shard' | 'bolt'

interface Particle {
  x: number
  y: number
  size: number
  delay: number
  duration: number
  kind: ParticleKind
  color: string
}

/** Themed particles drawn around the ring, never over the avatar core; each motif animates differently (embers drift, petals fall, stars twinkle, bolts flicker). */
const PARTICLES: Record<FrameMotif, Particle[]> = {
  none: [],
  laurel: [
    { x: 16, y: 44, size: 4.6, delay: 0, duration: 3.2, kind: 'ember', color: '#FFB347' },
    { x: 80, y: 50, size: 3.6, delay: 0.8, duration: 3.8, kind: 'ember', color: '#FFD27A' },
    { x: 25, y: 76, size: 3.2, delay: 1.5, duration: 4.2, kind: 'ember', color: '#FF8A3D' },
    { x: 72, y: 70, size: 4.2, delay: 0.4, duration: 3.5, kind: 'ember', color: '#FFE0A0' },
  ],
  wings: [
    { x: 12, y: 36, size: 4.8, delay: 0.2, duration: 2.8, kind: 'star', color: '#F4FBFF' },
    { x: 84, y: 42, size: 3.6, delay: 1.1, duration: 3.2, kind: 'star', color: '#D8E2EA' },
    { x: 22, y: 68, size: 3.2, delay: 0.6, duration: 2.6, kind: 'star', color: '#FFFFFF' },
    { x: 75, y: 74, size: 4.2, delay: 1.6, duration: 3.4, kind: 'star', color: '#FFFFFF' },
  ],
  crown: [
    { x: 20, y: 24, size: 5, delay: 0.3, duration: 2.6, kind: 'star', color: '#FFF3C4' },
    { x: 78, y: 22, size: 4, delay: 1.2, duration: 3, kind: 'star', color: '#FFE08A' },
    { x: 16, y: 62, size: 3.4, delay: 0.7, duration: 2.8, kind: 'star', color: '#FFE9A8' },
    { x: 82, y: 58, size: 4.6, delay: 1.8, duration: 3.4, kind: 'star', color: '#FFF6D6' },
  ],
  stars: [
    { x: 14, y: 48, size: 5.4, delay: 0.1, duration: 2.4, kind: 'star', color: '#FFF6C7' },
    { x: 84, y: 52, size: 4.2, delay: 0.9, duration: 2.9, kind: 'star', color: '#D9CBFF' },
    { x: 28, y: 20, size: 3.4, delay: 1.4, duration: 2.2, kind: 'star', color: '#FFE9A8' },
    { x: 70, y: 80, size: 4.8, delay: 0.5, duration: 3.1, kind: 'star', color: '#FFF6C7' },
  ],
  crystal: [
    { x: 18, y: 32, size: 6, delay: 0.2, duration: 2.6, kind: 'shard', color: '#B8F4FF' },
    { x: 80, y: 38, size: 4.4, delay: 1, duration: 3.1, kind: 'shard', color: '#FFD1F0' },
    { x: 26, y: 74, size: 4.8, delay: 0.6, duration: 2.8, kind: 'shard', color: '#E7C6F7' },
    { x: 72, y: 70, size: 3.8, delay: 1.7, duration: 3.4, kind: 'shard', color: '#FFFFFF' },
  ],
  sakura: [
    { x: 16, y: 34, size: 5.8, delay: 0.2, duration: 5.2, kind: 'petal', color: '#FFC2D8' },
    { x: 82, y: 30, size: 4.6, delay: 1.3, duration: 6, kind: 'petal', color: '#FFE3EF' },
    { x: 24, y: 66, size: 4.2, delay: 0.7, duration: 4.6, kind: 'petal', color: '#FFD1E3' },
    { x: 76, y: 74, size: 5.2, delay: 2.1, duration: 5.4, kind: 'petal', color: '#FFC2D8' },
  ],
  dragon: [
    { x: 18, y: 56, size: 5.2, delay: 0.1, duration: 3, kind: 'ember', color: '#FFB03A' },
    { x: 80, y: 60, size: 4.2, delay: 0.9, duration: 3.6, kind: 'ember', color: '#FF8A3D' },
    { x: 26, y: 28, size: 3.6, delay: 1.5, duration: 3.2, kind: 'ember', color: '#7CF7C4' },
    { x: 74, y: 26, size: 4.8, delay: 0.5, duration: 3.8, kind: 'ember', color: '#FFE0A0' },
  ],
  ocean: [
    { x: 15, y: 44, size: 5.4, delay: 0.2, duration: 3.8, kind: 'bubble', color: '#B8F0FF' },
    { x: 82, y: 50, size: 3.8, delay: 1, duration: 4.4, kind: 'bubble', color: '#8DE1F0' },
    { x: 26, y: 72, size: 4.6, delay: 0.6, duration: 4, kind: 'bubble', color: '#C8F4FF' },
    { x: 70, y: 68, size: 3.4, delay: 1.7, duration: 3.6, kind: 'bubble', color: '#B8F0FF' },
  ],
  neon: [
    { x: 12, y: 34, size: 6, delay: 0.1, duration: 2.2, kind: 'bolt', color: '#3EF2E0' },
    { x: 84, y: 38, size: 4.6, delay: 0.8, duration: 2.8, kind: 'bolt', color: '#6C7CFF' },
    { x: 24, y: 72, size: 4, delay: 1.4, duration: 2.4, kind: 'bolt', color: '#3EF2E0' },
    { x: 74, y: 70, size: 5, delay: 0.5, duration: 3, kind: 'bolt', color: '#8B7CFF' },
  ],
}

export function FrameParticles({ motif }: { motif: FrameMotif }) {
  const particles = PARTICLES[motif]
  if (particles.length === 0) return null
  return (
    <span className="avatar-frame-particles" aria-hidden="true">
      {particles.map((particle, index) => (
        <span
          key={`${motif}-${index}`}
          className={`frame-particle is-${particle.kind}`}
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}%`,
            height: `${particle.size}%`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            '--particle-color': particle.color,
          } as CSSProperties}
        />
      ))}
    </span>
  )
}
