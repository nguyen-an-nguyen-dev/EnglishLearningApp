import type { FrameMotif as FrameMotifKind, FrameSkin } from '../../cosmetics'

const INK = '#14203A'

/** Point on the frame ring: viewBox is 0–100, ring radius 50, art radius ≥41. */
function ringPoint(radius: number, angle: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180
  return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) }
}

function Star({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const inner = r * 0.3
  return (
    <path
      d={`M${x} ${y - r} L${x + inner} ${y - inner} L${x + r} ${y} L${x + inner} ${y + inner} L${x} ${y + r} L${x - inner} ${y + inner} L${x - r} ${y} L${x - inner} ${y - inner} Z`}
      fill={fill}
      stroke={INK}
      strokeWidth={1}
      strokeLinejoin="round"
    />
  )
}

function Blossom({ cx, cy, scale, petal, core }: { cx: number; cy: number; scale: number; petal: string; core: string }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx={0}
          cy={-10}
          rx={6}
          ry={10}
          transform={`rotate(${angle})`}
          fill={petal}
          stroke={INK}
          strokeWidth={1.1}
        />
      ))}
      <circle r={4} fill={core} stroke={INK} strokeWidth={1.1} />
    </g>
  )
}

/** Ornaments that turn a plain avatar ring into a themed frame, drawn in the outer band (radius ~41-55 of a 100-unit box) so the avatar core stays readable; each motif has its own silhouette. */
export function FrameMotif({ motif, skin }: { motif: FrameMotifKind; skin: FrameSkin }) {
  const accent = skin.accent ?? '#E6EDF2'

  if (motif === 'laurel') {
    // Leaves follow the ring itself, tangent to the circle, on both sides.
    const leaves = Array.from({ length: 8 }, (_, index) => {
      const angle = 116 + index * 19
      const point = ringPoint(46, angle)
      return { ...point, angle }
    })
    const branch = (
      <g>
        <path d="M46 94 A44 44 0 1 1 42 7" fill="none" stroke={skin.ringDark} strokeWidth="2.4" strokeLinecap="round" />
        {leaves.map((leaf, index) => (
          <ellipse
            key={index}
            cx={leaf.x}
            cy={leaf.y}
            rx={6}
            ry={3.1}
            transform={`rotate(${leaf.angle + 90} ${leaf.x} ${leaf.y})`}
            fill={index % 2 === 0 ? accent : skin.ringDark}
            stroke={INK}
            strokeWidth={1}
          />
        ))}
      </g>
    )
    return (
      <g>
        {branch}
        <g transform="translate(100 0) scale(-1 1)">{branch}</g>
        <circle cx="50" cy="96" r="3.2" fill={accent} stroke={INK} strokeWidth="1" />
        <circle cx="40" cy="93" r="2.4" fill={skin.ringDark} stroke={INK} strokeWidth="1" />
        <circle cx="60" cy="93" r="2.4" fill={skin.ringDark} stroke={INK} strokeWidth="1" />
      </g>
    )
  }

  if (motif === 'wings') {
    const wing = (
      <g>
        <path
          d="M33 20C19 20 7 13 1 3C11 5 20 5 28 8C31 11 33 15 33 20Z"
          fill={accent}
          stroke={INK}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M27 9C20 7 14 6 8 5" fill="none" stroke={skin.ringDark} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M29 14C23 12 17 11 11 10" fill="none" stroke={skin.ringDark} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M25 16C22 15 20 14 17 13" fill="none" stroke={INK} strokeWidth="1" opacity=".35" />
      </g>
    )
    return (
      <g>
        {wing}
        <g transform="translate(100 0) scale(-1 1)">{wing}</g>
      </g>
    )
  }

  if (motif === 'crown') {
    return (
      <g>
        <path
          d="M31 8L33 -8L42 2L50 -12L58 2L67 -8L69 8Z"
          fill={accent}
          stroke={INK}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <rect x="30" y="7" width="40" height="7" rx="2" fill={skin.ringDark} stroke={INK} strokeWidth="1.8" />
        <circle cx="50" cy="-1" r="3.2" fill={skin.ring} stroke={INK} strokeWidth="1.2" />
        <circle cx="37" cy="0" r="2.2" fill={skin.ringDark} stroke={INK} strokeWidth="1" />
        <circle cx="63" cy="0" r="2.2" fill={skin.ringDark} stroke={INK} strokeWidth="1" />
        <path d="M35 10.5H65" stroke={accent} strokeWidth="1.4" strokeLinecap="round" />
      </g>
    )
  }

  if (motif === 'stars') {
    const spots = [
      { angle: 28, radius: 47, size: 5.4 },
      { angle: 66, radius: 44, size: 3.4 },
      { angle: 118, radius: 47, size: 4.6 },
      { angle: 152, radius: 44, size: 3.1 },
      { angle: 198, radius: 46, size: 5.8 },
      { angle: 234, radius: 44, size: 3.2 },
      { angle: 288, radius: 46, size: 4.4 },
      { angle: 326, radius: 45, size: 3 },
    ]
    return (
      <g>
        {spots.map((spot) => {
          const point = ringPoint(spot.radius, spot.angle)
          return <Star key={spot.angle} x={point.x} y={point.y} r={spot.size} fill={spot.size > 4 ? accent : skin.ringDark} />
        })}
        <circle cx="97" cy="50" r="1.5" fill={accent} />
        <circle cx="3" cy="50" r="1.5" fill={skin.ringDark} />
        <circle cx="50" cy="97" r="1.5" fill={accent} />
      </g>
    )
  }

  if (motif === 'crystal') {
    const gem = (x: number, y: number, w: number, h: number, fill: string) => (
      <g>
        <path d={`M${x} ${y - h} L${x + w} ${y} L${x} ${y + h} L${x - w} ${y} Z`} fill={fill} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d={`M${x} ${y - h} L${x} ${y + h}`} stroke="#FFFFFF" strokeWidth="1.2" opacity=".6" />
      </g>
    )
    return (
      <g>
        {gem(13, 31, 8, 12, skin.ringDark)}
        {gem(87, 31, 8, 12, skin.ringDark)}
        {gem(50, 98, 10, 14, skin.ring)}
        <Star x={16} y={16} r={3} fill={accent} />
        <Star x={84} y={16} r={2.6} fill={accent} />
        <Star x={22} y={76} r={2.4} fill={skin.ringDark} />
        <Star x={78} y={76} r={2.4} fill={skin.ringDark} />
      </g>
    )
  }

  if (motif === 'sakura') {
    const drop = (x: number, y: number, angle: number, fill: string) => (
      <ellipse cx={x} cy={y} rx={4.4} ry={2.4} transform={`rotate(${angle} ${x} ${y})`} fill={fill} stroke={INK} strokeWidth=".8" />
    )
    return (
      <g>
        <path d="M105 0C94 8 88 18 86 30C86 36 88 42 92 48" fill="none" stroke="#7A4A3A" strokeWidth="3" strokeLinecap="round" />
        <path d="M89 22C94 24 98 28 101 34" fill="none" stroke="#7A4A3A" strokeWidth="1.8" strokeLinecap="round" />
        <Blossom cx={92} cy={13} scale={0.76} petal={accent} core="#FFD23F" />
        <Blossom cx={80} cy={4} scale={0.56} petal={accent} core="#FFD23F" />
        <Blossom cx={86} cy={32} scale={0.5} petal={skin.ringDark} core="#FFD23F" />
        <Blossom cx={97} cy={52} scale={0.56} petal={accent} core="#FFD23F" />
        {drop(72, 10, -28, accent)}
        {drop(18, 24, 18, accent)}
        {drop(88, 68, -16, skin.ringDark)}
        {drop(30, 84, 12, accent)}
      </g>
    )
  }

  if (motif === 'dragon') {
    return (
      <g>
        {/* The 3D dragon head comes from the frame asset; the motif supplies the
            claws and the pearl so it does not grow a second head. */}
        <path d="M34 66C24 70 20 78 23 87" fill="none" stroke={skin.ringDark} strokeWidth="3" strokeLinecap="round" />
        <path d="M66 66C76 70 80 78 77 87" fill="none" stroke={skin.ringDark} strokeWidth="3" strokeLinecap="round" />
        <circle cx="23" cy="87" r="3" fill={accent} stroke={INK} strokeWidth="1" />
        <circle cx="77" cy="87" r="3" fill={accent} stroke={INK} strokeWidth="1" />
        <circle cx="50" cy="97" r="4" fill={accent} stroke={INK} strokeWidth="1.2" />
        <circle cx="48.6" cy="95.6" r="1.2" fill="#FFFFFF" opacity=".8" />
      </g>
    )
  }

  if (motif === 'ocean') {
    return (
      <g>
        <path d="M80 78 A42 42 0 0 1 20 78" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round" />
        <path d="M88 66 A52 52 0 0 1 12 66" fill="none" stroke={skin.ring} strokeWidth="4" strokeLinecap="round" opacity=".85" />
        <path d="M72 86 A12 12 0 0 1 56 88" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity=".55" />
        <circle cx="14" cy="30" r="4.4" fill="none" stroke={accent} strokeWidth="1.6" />
        <circle cx="88" cy="34" r="3.4" fill="none" stroke={accent} strokeWidth="1.5" />
        <circle cx="78" cy="12" r="2" fill={accent} />
        <circle cx="24" cy="14" r="1.7" fill={accent} />
        <circle cx="94" cy="56" r="1.8" fill={skin.ringDark} />
        <circle cx="8" cy="56" r="1.8" fill={skin.ringDark} />
      </g>
    )
  }

  if (motif === 'neon') {
    const bracket = (transform: string) => (
      <g transform={transform}>
        <path d="M24 8H9V24" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round" opacity=".22" />
        <path d="M24 8H9V24" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
      </g>
    )
    const bolt = (
      <g>
        <path d="M96 2L88 16H94L86 30L102 12H95L102 2Z" fill={accent} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      </g>
    )
    return (
      <g>
        {bracket('')}
        {bracket('translate(100 0) scale(-1 1)')}
        {bracket('translate(0 100) scale(1 -1)')}
        {bracket('translate(100 100) scale(-1 -1)')}
        {bolt}
        <g transform="translate(100 100) scale(-1 -1)">{bolt}</g>
        <circle cx="2" cy="50" r="1.8" fill={skin.ring} />
        <circle cx="98" cy="50" r="1.8" fill={skin.ring} />
      </g>
    )
  }

  return null
}
