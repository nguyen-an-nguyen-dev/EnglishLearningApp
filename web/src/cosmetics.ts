/**
 * Cosmetic art catalogue keyed by `visual_key`. The backend sends only a key,
 * ownership and price; every colour and shape lives here so shop preview, roadmap
 * car, avatar frame and background plate draw from one definition. Skins are
 * procedural SVG — no external assets.
 */

import { plateScene, SCENIC_ART } from './components/cosmetics/scenicArt'
import type { ScenicScene } from './components/cosmetics/scenicArt'
import { plateArt } from './cosmeticAssets'

/** Distinct body shapes, so a new car is more than a repaint. */
export type CarModel =
  | 'classic'
  | 'sport'
  | 'hatch'
  | 'muscle'
  | 'hover'
  | 'limo'
  | 'taxi'
  | 'monster'
  | 'formula'
  | 'jeep'

export const CAR_MODELS: readonly CarModel[] = [
  'classic', 'sport', 'hatch', 'muscle', 'hover',
  'limo', 'taxi', 'monster', 'formula', 'jeep',
]

export interface CarSkin {
  model: CarModel
  body: string
  bodyDark: string
  trim: string
  glass: string
  glassLight: string
  wheel: string
  light: string
  trail: string
}

/** Ornament drawn around an avatar ring; each motif has its own silhouette. */
export type FrameMotif =
  | 'none'
  | 'laurel'
  | 'wings'
  | 'crown'
  | 'stars'
  | 'crystal'
  | 'sakura'
  | 'dragon'
  | 'ocean'
  | 'neon'

export const FRAME_MOTIFS: readonly FrameMotif[] = [
  'none', 'laurel', 'wings', 'crown', 'stars',
  'crystal', 'sakura', 'dragon', 'ocean', 'neon',
]

export interface FrameSkin {
  ring: string
  ringDark: string
  accent: string | null
  motif: FrameMotif
}

export interface NameplateSkin {
  /** CSS background value for blocks and bands; 'transparent' means text-only. */
  bg: string
  fg: string | null
  edge: string | null
  /** Scenery-only art for the shop thumbnail (no text scrim). */
  art: string
}

/** Fallback used whenever an unknown visual_key arrives from the API. */
export const DEFAULT_CAR_SKIN: CarSkin = {
  model: 'classic',
  body: '#F2B544',
  bodyDark: '#D39A2A',
  trim: '#A96E13',
  glass: '#5D8497',
  glassLight: '#83A8B8',
  wheel: '#42586B',
  light: '#FFF4C7',
  trail: '#F2B544',
}

export const DEFAULT_FRAME_SKIN: FrameSkin = {
  ring: '#C9E0EB',
  ringDark: '#A3C9DA',
  accent: null,
  motif: 'none',
}

export const DEFAULT_NAMEPLATE_SKIN: NameplateSkin = {
  bg: 'transparent',
  fg: null,
  edge: null,
  art: SCENIC_ART.plain,
}

export const CAR_SKINS: Record<string, CarSkin> = {
  car_classic_yellow: DEFAULT_CAR_SKIN,
  car_sport_red: {
    model: 'sport',
    body: '#E5484D', bodyDark: '#B32D31', trim: '#7F1D1F',
    glass: '#45566B', glassLight: '#7C90A8', wheel: '#2B3442',
    light: '#FFE9A8', trail: '#FF7A5C',
  },
  car_mint: {
    model: 'hatch',
    body: '#6FD3B8', bodyDark: '#3FA994', trim: '#1F7A6B',
    glass: '#4A6C7C', glassLight: '#8FB6C4', wheel: '#33474F',
    light: '#EAFFF8', trail: '#8BEFD4',
  },
  car_navy: {
    model: 'muscle',
    body: '#2F4B7C', bodyDark: '#20355A', trim: '#141F38',
    glass: '#5B7691', glassLight: '#93AEC6', wheel: '#1B2534',
    light: '#DCE9FF', trail: '#6C9BE8',
  },
  car_aurora: {
    model: 'hover',
    body: '#6E7BE8', bodyDark: '#4A55B8', trim: '#2E3593',
    glass: '#4C5F8C', glassLight: '#96A6E0', wheel: '#2C3350',
    light: '#E4E7FF', trail: '#8CE0F0',
  },
  car_gold: {
    model: 'limo',
    body: '#E8BE55', bodyDark: '#C2963A', trim: '#8A6A1F',
    glass: '#6C6252', glassLight: '#C0B296', wheel: '#4B4438',
    light: '#FFF6D6', trail: '#FFDE8A',
  },
  car_rickshaw: {
    model: 'taxi',
    body: '#2E8B57', bodyDark: '#1B5E3B', trim: '#E3B93F',
    glass: '#4E6476', glassLight: '#9DB2C2', wheel: '#2B3442',
    light: '#FFF6D6', trail: '#7BD389',
  },
  car_monster: {
    model: 'monster',
    body: '#7BC043', bodyDark: '#4C8A24', trim: '#2F5A13',
    glass: '#374A2E', glassLight: '#9ABD7A', wheel: '#20262E',
    light: '#F4FFD6', trail: '#A6E85C',
  },
  car_formula: {
    model: 'formula',
    body: '#F25C4A', bodyDark: '#B6322A', trim: '#6E1714',
    glass: '#3A4652', glassLight: '#8FA2B2', wheel: '#1F2630',
    light: '#FFF0C2', trail: '#FF8A5C',
  },
  car_jeep: {
    model: 'jeep',
    body: '#C98A55', bodyDark: '#9A6236', trim: '#5E3A1C',
    glass: '#4B5C63', glassLight: '#9FB4B8', wheel: '#2A2622',
    light: '#FFF1C9', trail: '#E0A76E',
  },
}

/** Legacy frame palette retained for old rows; live frame art lives in `garage/frames`. */
export const FRAME_SKINS: Record<string, FrameSkin> = {
  frame_plain: DEFAULT_FRAME_SKIN,
  // Palette mirrors the raster frame art. The motif is only used by the
  // procedural fallback when a custom style targets one of these keys.
  frame_bronze: { ring: '#F2B544', ringDark: '#C88A22', accent: '#FFF0B8', motif: 'laurel' },
  frame_silver: { ring: '#D8E2EA', ringDark: '#93A3B3', accent: '#FFFFFF', motif: 'stars' },
  frame_gold: { ring: '#E8BE55', ringDark: '#C2963A', accent: '#FFF3C4', motif: 'crown' },
  frame_violet: { ring: '#9A7BE0', ringDark: '#6E52B4', accent: '#FFE9A8', motif: 'stars' },
  frame_prism: { ring: '#7FD8E8', ringDark: '#4E9FB5', accent: '#E7C6F7', motif: 'crystal' },
  frame_sakura: { ring: '#F2A7C3', ringDark: '#C86B92', accent: '#FFE3EF', motif: 'sakura' },
  frame_dragon: { ring: '#2E8B57', ringDark: '#1B5E3B', accent: '#FFB03A', motif: 'dragon' },
  frame_ocean: { ring: '#3AA6C9', ringDark: '#1F6F8B', accent: '#C8F4FF', motif: 'ocean' },
  frame_neon: { ring: '#5B4BC4', ringDark: '#312A78', accent: '#3EF2E0', motif: 'neon' },
}

/** Scenic plate backed by a photo when one exists, else the procedural scene. */
function photoPlate(
  key: string,
  scene: ScenicScene,
  scrim: string,
  fg: string,
  edge: string,
): NameplateSkin {
  const art = plateArt(key) ?? SCENIC_ART[scene]
  return { bg: plateScene(scene, scrim, art), fg, edge, art }
}

export const NAMEPLATE_SKINS: Record<string, NameplateSkin> = {
  plate_plain: DEFAULT_NAMEPLATE_SKIN,
  // The same art fills the shop card thumbnails (without the text scrim).
  plate_slate: photoPlate('plate_slate', 'slate', 'rgba(10,24,38,0.46)', '#F3FAFF', 'rgba(255,255,255,0.38)'),
  plate_cyan: photoPlate('plate_cyan', 'sky', 'rgba(4,34,48,0.4)', '#F4FCFF', 'rgba(255,255,255,0.4)'),
  plate_sunset: photoPlate('plate_sunset', 'sunset', 'rgba(46,14,40,0.4)', '#FFF7F2', 'rgba(255,255,255,0.36)'),
  plate_forest: photoPlate('plate_forest', 'forest', 'rgba(6,36,26,0.44)', '#F2FFF8', 'rgba(255,255,255,0.34)'),
  plate_royal: photoPlate('plate_royal', 'royal', 'rgba(4,8,26,0.4)', '#EAF4FF', 'rgba(164,196,255,0.55)'),
  plate_desert: photoPlate('plate_desert', 'desert', 'rgba(58,26,20,0.36)', '#FFF6E8', 'rgba(255,224,176,0.48)'),
  plate_space: photoPlate('plate_space', 'space', 'rgba(3,7,24,0.3)', '#EAF4FF', 'rgba(164,196,255,0.55)'),
  plate_sakura: photoPlate('plate_sakura', 'sakura', 'rgba(76,20,48,0.34)', '#FFF2F8', 'rgba(255,212,232,0.62)'),
  plate_ocean: photoPlate('plate_ocean', 'ocean', 'rgba(2,30,44,0.34)', '#E6FBFF', 'rgba(150,240,255,0.48)'),
  plate_aurora: photoPlate('plate_aurora', 'aurora', 'rgba(2,10,26,0.38)', '#EFFBFF', 'rgba(160,255,220,0.5)'),
}

export function carSkin(visualKey: string | null | undefined, style?: Record<string, string | null> | null): CarSkin {
  const base = (visualKey && CAR_SKINS[visualKey]) || DEFAULT_CAR_SKIN
  if (!style) return base
  const merged: CarSkin = { ...base, ...mergeKnown(base, style) }
  // The shape is part of the skin, but an admin cannot invent a new model from
  // the style box: unknown values keep the key's own silhouette.
  if (style.model && CAR_MODELS.includes(style.model as CarModel)) {
    merged.model = style.model as CarModel
  }
  return merged
}

export function frameSkin(visualKey: string | null | undefined, style?: Record<string, string | null> | null): FrameSkin {
  const base = (visualKey && FRAME_SKINS[visualKey]) || DEFAULT_FRAME_SKIN
  if (!style) return base
  const motif = style.motif && FRAME_MOTIFS.includes(style.motif as FrameMotif)
    ? style.motif as FrameMotif
    : base.motif
  return {
    ring: style.ring || base.ring,
    ringDark: style.ringDark || base.ringDark,
    accent: style.accent === undefined ? base.accent : (style.accent || null),
    motif,
  }
}

export function nameplateSkin(
  visualKey: string | null | undefined,
  style?: Record<string, string | null> | null,
): NameplateSkin {
  const base = (visualKey && NAMEPLATE_SKINS[visualKey]) || DEFAULT_NAMEPLATE_SKIN
  if (!style) return base
  // Keys with a photo plate keep that photo. The scene metadata stored on the
  // shop row is only a fallback hint for the procedural catalogue; letting it
  // win here would swap every photograph back to the old drawn landscape.
  if (plateArt(visualKey) && !style.bg) return base
  // A scene name paints the procedural art; otherwise `bg` is used verbatim so
  // an admin can ship gradients or external images without a code change.
  const scene = style.scene && style.scene in SCENIC_ART ? style.scene as keyof typeof SCENIC_ART : null
  if (scene) {
    return {
      bg: plateScene(scene, style.scrim || 'rgba(8, 20, 32, 0.42)'),
      fg: style.fg || base.fg,
      edge: style.edge || base.edge,
      art: SCENIC_ART[scene],
    }
  }
  if (style.bg) {
    return {
      bg: style.bg,
      fg: style.fg || base.fg,
      edge: style.edge || base.edge,
      art: style.art || base.art,
    }
  }
  return base
}

function mergeKnown(base: CarSkin, style: Record<string, string | null>): Partial<CarSkin> {
  const merged: Partial<CarSkin> = {}
  const colours = merged as unknown as Record<string, string>
  for (const key of Object.keys(base) as Array<keyof CarSkin>) {
    // `model` is a closed union and handled separately; the rest are colours.
    if (key === 'model') continue
    if (style[key]) colours[key] = style[key] as string
  }
  return merged
}

/** Rarity → label + token colours, shared by shop rows and tooltips. */
export const RARITY_META: Record<string, { label: string; fg: string; bg: string }> = {
  common: { label: 'Cơ bản', fg: 'var(--rarity-common-fg)', bg: 'var(--rarity-common-bg)' },
  rare: { label: 'Hiếm', fg: 'var(--rarity-rare-fg)', bg: 'var(--rarity-rare-bg)' },
  epic: { label: 'Sử thi', fg: 'var(--rarity-epic-fg)', bg: 'var(--rarity-epic-bg)' },
  legendary: { label: 'Huyền thoại', fg: 'var(--rarity-legendary-fg)', bg: 'var(--rarity-legendary-bg)' },
}
