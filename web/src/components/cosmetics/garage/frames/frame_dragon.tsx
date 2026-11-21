import { FRAME, GOLD, GREEN, INK, STROKE, WHITE } from '../designTokens'
import {
  AvatarSlot,
  DecorStar,
  FrameSvg,
  MascotEye,
  SmallRing,
  Ring,
} from '../parts/frameParts'
import { onRing } from '../parts/frameGeometry'
import type { FrameArtProps } from '../parts/frameParts'

const paint = {
  ring: GREEN,
  dark: '#2b9b6b',
  scale: '#a7f3d0',
}

function DragonBack() {
  return (
    <g strokeLinejoin="round">
      <path d="M74 30L72 22L80 24ZM126 30L128 22L120 24Z" fill={paint.ring} stroke={INK} strokeWidth={STROKE.outer} />
      <path d="M80 26C78 19 82 14 89 14C86 18 89 23 94 26ZM120 26C122 19 118 14 111 14C114 18 111 23 106 26Z" fill={GOLD} stroke={INK} strokeWidth={STROKE.inner} />
      <path d="M72 40C72 25 83 15 100 15C117 15 128 25 128 40C128 51 122 60 112 64C106 66 94 66 88 64C78 60 72 51 72 40Z" fill={paint.ring} stroke={INK} strokeWidth={STROKE.outer} />
      <path d="M82 23C88 19 94 18 99 18" fill="none" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <path d="M79 31C82 28 86 27 89 28L89 30C86 29 82 30 80 32ZM121 31C118 28 114 27 111 28L111 30C114 29 118 30 120 32Z" fill={GOLD} />
      <ellipse cx={100} cy={47} rx={15} ry={8.5} fill={paint.scale} stroke={INK} strokeWidth={STROKE.inner} />
      <MascotEye x={88} y={34} />
      <MascotEye x={112} y={34} />
      <circle cx={96} cy={45} r={1.5} fill={INK} />
      <circle cx={104} cy={45} r={1.5} fill={INK} />
      <path d="M94 51Q100 56 106 51" fill="none" stroke={INK} strokeWidth={STROKE.inner} strokeLinecap="round" />
      <path d="M95 49L97 53L99 49M101 49L103 53L105 49" fill={WHITE} stroke={INK} strokeWidth={1.5} />
      <circle cx={76} cy={44} r={2} fill={GOLD} />
      <circle cx={124} cy={44} r={2} fill={GOLD} />
    </g>
  )
}

function Laurel({ angle }: { angle: number }) {
  const leaves = [-13, 0, 13].map((offset) => {
    const p = onRing(56, angle + offset)
    return { ...p, rotation: angle + offset + 90 }
  })
  return (
    <g>
      {leaves.map((leaf, index) => (
        <ellipse
          key={index}
          cx={leaf.x}
          cy={leaf.y}
          rx={8}
          ry={3.4}
          transform={`rotate(${leaf.rotation} ${leaf.x} ${leaf.y})`}
          fill={GOLD}
          stroke={INK}
          strokeWidth={STROKE.inner}
        />
      ))}
    </g>
  )
}

function DragonWingsAndTail() {
  return (
    <g strokeLinejoin="round">
      <path d="M50 84L14 66L20 96L12 114L34 118L48 114ZM150 84L186 66L180 96L188 114L166 118L152 114ZM112 166C136 178 164 176 176 154C166 152 156 158 148 160C136 164 126 160 118 154Z" fill={paint.ring} stroke={INK} strokeWidth={STROKE.outer} />
      <path d="M22 76L44 96M24 98L46 106M178 76L156 96M176 98L154 106" stroke={INK} strokeWidth={STROKE.inner} strokeLinecap="round" />
      <path d="M170 154L184 146L179 162Z" fill={GOLD} stroke={INK} strokeWidth={STROKE.inner} />
    </g>
  )
}

function Claw({ angle, upper = false }: { angle: number; upper?: boolean }) {
  const p = onRing(59, angle)
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${angle + 270}) scale(${upper ? 0.86 : 1})`}>
      <path d="M-9 6C-10 0 -6 -5 0 -5C6 -5 10 0 9 6C9 9 6 11 3 11H-3C-6 11 -9 9 -9 6Z" fill={GOLD} stroke={INK} strokeWidth={STROKE.inner} strokeLinejoin="round" />
      <path d="M-6 -4L-8 -10L-3 -6M0 -5V-12L3 -6M6 -4L8 -10L9 -5" fill={GOLD} stroke={INK} strokeWidth={STROKE.detail} strokeLinejoin="round" />
    </g>
  )
}

/** 12 · frame_dragon — jade dragon with wings, spiked tail, four golden claws and laurel ring. */
export function FrameDragon({ letter = 'K', fontSize = 48, small = false }: FrameArtProps = {}) {
  if (small) {
    return <SmallRing fill={paint.ring} dark={paint.dark} goldEdge letter={letter} fontSize={fontSize} label="Khung rồng lửa cỡ nhỏ" />
  }
  return (
    <FrameSvg label="Khung rồng lửa">
      <circle cx={FRAME.cxAvatar} cy={FRAME.avatarY} r={66} fill="none" stroke={GOLD} strokeWidth={5} opacity={0.18} />
      <DragonWingsAndTail />
      <DragonBack />
      <AvatarSlot letter={letter} fontSize={fontSize} />
      <Ring fill={paint.ring} dark={paint.dark} goldEdge />
      <Laurel angle={180} />
      <Laurel angle={0} />
      <Claw angle={216} upper />
      <Claw angle={324} upper />
      <Claw angle={132} />
      <Claw angle={48} />
      <DecorStar angle={90} radius={67} r={5.5} />
    </FrameSvg>
  )
}

export function FrameDragonSmall() {
  return <FrameDragon small />
}
