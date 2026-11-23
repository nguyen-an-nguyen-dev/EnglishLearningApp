import { ROADMAP_LAYOUT, STAGE_VISUALS, type StageThemeKey } from '../../roadmap'

const SCENES = {
  forest: { name: 'meadow', sizes: [151, 128, 85, 142, 80, 81, 85, 167, 91] },
  river: { name: 'lake', sizes: [116, 103, 131, 93, 93, 122, 90, 140, 106], mirror: true },
  autumn: { name: 'autumn', sizes: [148, 124, 95, 144, 82, 82, 103, 102, 101] },
  alpine: { name: 'snow', sizes: [154, 122, 102, 141, 106, 83, 95, 120, 91], mirror: true },
  coast: { name: 'coast', sizes: [120, 151, 142, 120, 102, 95, 108, 109, 88] },
  sakura: { name: 'sakura', sizes: [150, 131, 105, 125, 162, 84, 114, 151, 90], mirror: true },
} satisfies Record<StageThemeKey, { name: string; sizes: readonly number[]; mirror?: boolean }>

const TRANSITIONS = new Map([
  ['forest-river', 'meadow-to-lake'],
  ['river-autumn', 'lake-to-autumn'],
  ['autumn-alpine', 'autumn-to-snow'],
  ['alpine-coast', 'snow-to-coast'],
  ['coast-sakura', 'coast-to-sakura'],
])

const CELL_SIZE = 320
const TILE_HEIGHT = ROADMAP_LAYOUT.width * 2 / 3

// The props follow the order of cells in each atlas.
const PROP_POSITIONS = [
  { x: 177, depth: 0.07 },
  { x: 953, depth: 0.12 },
  { x: 1020, depth: 0.27 },
  { x: 218, depth: 0.32 },
  { x: 840, depth: 0.41 },
  { x: 316, depth: 0.46 },
  { x: 187, depth: 0.62 },
  { x: 941, depth: 0.65 },
  { x: 272, depth: 0.77 },
] as const

export function StageScene({ id, y, height, theme }: { id: string; y: number; height: number; theme: StageThemeKey }) {
  const scene = SCENES[theme]
  const terrain = `/roadmap/${scene.name}.webp`
  const atlas = `/roadmap/${scene.name}-props.webp`
  const patternId = `${id}-ground`
  const width = ROADMAP_LAYOUT.width

  return (
    <g aria-hidden="true" pointerEvents="none" data-roadmap-scene={scene.name}>
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" y={y} width={width} height={TILE_HEIGHT * 2}>
          <image href={terrain} width={width} height={TILE_HEIGHT} preserveAspectRatio="none" />
          <image
            href={terrain}
            width={width}
            height={TILE_HEIGHT}
            transform={`translate(0 ${TILE_HEIGHT * 2}) scale(1 -1)`}
            preserveAspectRatio="none"
          />
        </pattern>
      </defs>
      <rect x="0" y={y} width={width} height={height} fill={`url(#${patternId})`} />
      {PROP_POSITIONS.map(({ x, depth }, cell) => {
        const size = scene.sizes[cell]
        const center = 'mirror' in scene && scene.mirror ? width - x : x
        return (
          <svg
            key={cell}
            x={center - size / 2}
            y={y + depth * (height - size)}
            width={size}
            height={size}
            viewBox={`${cell % 3 * CELL_SIZE} ${Math.floor(cell / 3) * CELL_SIZE} ${CELL_SIZE} ${CELL_SIZE}`}
            overflow="hidden"
          >
            <image href={atlas} width={CELL_SIZE * 3} height={CELL_SIZE * 3} />
          </svg>
        )
      })}
    </g>
  )
}

export function StageTransition({ id, y, from, to }: { id: string; y: number; from: StageThemeKey; to: StageThemeKey }) {
  const pair = `${from}-${to}`
  const art = TRANSITIONS.get(pair)
  const height = art ? 244 : 128
  const top = y - height / 2
  const width = ROADMAP_LAYOUT.width
  const paint = `url(#${id})`
  const start = art ? 'white' : STAGE_VISUALS[from].bg
  const end = art ? 'white' : STAGE_VISUALS[to].bg

  return (
    <g aria-hidden="true" pointerEvents="none" data-roadmap-transition={pair}>
      <defs>
        <linearGradient id={id} x2="0" y2="1">
          <stop offset="0" stopColor={start} stopOpacity="0" />
          <stop offset=".24" stopColor={start} />
          <stop offset=".76" stopColor={end} />
          <stop offset="1" stopColor={end} stopOpacity="0" />
        </linearGradient>
        {art && (
          <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x={0} y={top} width={width} height={height}>
            <rect x={0} y={top} width={width} height={height} fill={paint} />
          </mask>
        )}
      </defs>
      {art ? (
        <image
          href={`/roadmap/${art}.webp`}
          x={0}
          y={top}
          width={width}
          height={height}
          preserveAspectRatio="none"
          mask={`url(#${id}-mask)`}
        />
      ) : (
        <rect x={0} y={top} width={width} height={height} fill={paint} />
      )}
    </g>
  )
}
