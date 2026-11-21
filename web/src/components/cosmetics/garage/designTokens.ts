/** Engorace garage art tokens - one palette for all cars and frame rings. Each flat shape gets a base colour, a 15% darker lower tone, and a 35% white highlight. */
export const INK = '#14203a'
export const GLASS = '#bfe9ff'
export const HEADLIGHT = '#fff3b0'
export const TAILLIGHT = '#ff5a5f'
export const METAL = '#c9d6ea'
export const GOLD = '#ffd23f'
export const ORANGE = '#ff9f2e'
export const BLUE = '#19b6f0'
export const GREEN = '#38c98a'
export const PURPLE = '#a78bfa'
export const WHITE = '#ffffff'

export const STROKE = {
  /** Silhouette / outer contour. */
  outer: 3,
  /** Interior detail: seams, glass, lamps. */
  inner: 2,
  /** Wheels spokes and tiny accents. */
  detail: 1.5,
} as const

/** Side-view cars: one coordinate system, one ground line. */
export const CAR = {
  viewWidth: 240,
  viewHeight: 130,
  ground: 108,
  minX: 20,
  maxX: 220,
  maxWidth: 200,
  maxHeight: 80,
  defaultWheelR: 17,
  bodyStroke: STROKE.outer,
} as const

/** Avatar frames: four layers around one fixed slot. */
export const FRAME = {
  view: 200,
  cx: 100,
  cxAvatar: 100,
  avatarY: 112,
  avatarR: 46,
  ringInner: 46,
  ringOuter: 60,
  ringDefaultOuter: 54,
  headX: 100,
  headY: 40,
  headWidth: 60,
  headHeight: 52,
  decorationRadius: 68,
  decorationMaxRadius: 74,
  safeMargin: 8,
} as const

/** Rarity is also a detail ladder; card backgrounds must be distinct. */
export const RARITY = {
  common: { label: 'Cơ bản', card: '#e4eaf2' },
  rare: { label: 'Hiếm', card: '#cfe8ff' },
  epic: { label: 'Sử thi', card: '#e3d7ff' },
  legendary: { label: 'Huyền thoại', card: '#ffe9a8' },
} as const

export type RarityKey = keyof typeof RARITY

/** Deliberately named paint slots so every car reads from the same recipe. */
export interface CarPaint {
  body: string
  dark: string
  glass?: string
  metal?: string
  light?: string
  tail?: string
  accent?: string
  wheelSpoke?: string
}
