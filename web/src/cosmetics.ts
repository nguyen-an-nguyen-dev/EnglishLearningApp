/**
 * Cosmetic art catalogue, keyed by `visual_key`.
 *
 * The backend only sends a key, ownership and price; every colour and shape
 * lives here so the shop preview, the roadmap car, the avatar frame and the
 * background plate all draw from one definition. Skins are procedural SVG — no
 * external assets — which keeps the look consistent in light and dark.
 */

import { plateScene, SCENIC_ART } from './components/cosmetics/scenicArt'

export interface CarSkin {
  body: string
  bodyDark: string
  trim: string
  glass: string
  glassLight: string
  wheel: string
  light: string
  trail: string
}

export interface FrameSkin {
  ring: string
  ringDark: string
  accent: string | null
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
    body: '#E5484D', bodyDark: '#B32D31', trim: '#7F1D1F',
    glass: '#45566B', glassLight: '#7C90A8', wheel: '#2B3442',
    light: '#FFE9A8', trail: '#FF7A5C',
  },
  car_mint: {
    body: '#6FD3B8', bodyDark: '#3FA994', trim: '#1F7A6B',
    glass: '#4A6C7C', glassLight: '#8FB6C4', wheel: '#33474F',
    light: '#EAFFF8', trail: '#8BEFD4',
  },
  car_navy: {
    body: '#2F4B7C', bodyDark: '#20355A', trim: '#141F38',
    glass: '#5B7691', glassLight: '#93AEC6', wheel: '#1B2534',
    light: '#DCE9FF', trail: '#6C9BE8',
  },
  car_aurora: {
    body: '#6E7BE8', bodyDark: '#4A55B8', trim: '#2E3593',
    glass: '#4C5F8C', glassLight: '#96A6E0', wheel: '#2C3350',
    light: '#E4E7FF', trail: '#8CE0F0',
  },
  car_gold: {
    body: '#E8BE55', bodyDark: '#C2963A', trim: '#8A6A1F',
    glass: '#6C6252', glassLight: '#C0B296', wheel: '#4B4438',
    light: '#FFF6D6', trail: '#FFDE8A',
  },
}

export const FRAME_SKINS: Record<string, FrameSkin> = {
  frame_plain: DEFAULT_FRAME_SKIN,
  frame_bronze: { ring: '#C98A55', ringDark: '#9A6236', accent: '#E9BE93' },
  frame_silver: { ring: '#B8C4CE', ringDark: '#8A98A6', accent: '#E6EDF2' },
  frame_gold: { ring: '#E0B34A', ringDark: '#AE8420', accent: '#FFE9A8' },
  frame_violet: { ring: '#9A7BE0', ringDark: '#6E52B4', accent: '#D9CBFF' },
  frame_prism: { ring: '#7FD8E8', ringDark: '#4E9FB5', accent: '#E7C6F7' },
}

export const NAMEPLATE_SKINS: Record<string, NameplateSkin> = {
  plate_plain: DEFAULT_NAMEPLATE_SKIN,
  // Scenic plates paint the block with an illustrated landscape. The scrim in
  // each background keeps white/gold copy readable over the art; the same art
  // (without the scrim) fills the shop card thumbnails.
  plate_slate: {
    bg: plateScene('slate', 'rgba(10,24,38,0.48)'),
    fg: '#F3FAFF',
    edge: 'rgba(255,255,255,0.38)',
    art: SCENIC_ART.slate,
  },
  plate_cyan: {
    bg: plateScene('sky', 'rgba(4,34,48,0.4)'),
    fg: '#F4FCFF',
    edge: 'rgba(255,255,255,0.4)',
    art: SCENIC_ART.sky,
  },
  plate_sunset: {
    bg: plateScene('sunset', 'rgba(46,14,40,0.42)'),
    fg: '#FFF7F2',
    edge: 'rgba(255,255,255,0.36)',
    art: SCENIC_ART.sunset,
  },
  plate_forest: {
    bg: plateScene('forest', 'rgba(6,36,26,0.48)'),
    fg: '#F2FFF8',
    edge: 'rgba(255,255,255,0.34)',
    art: SCENIC_ART.forest,
  },
  plate_royal: {
    bg: plateScene('royal', 'rgba(4,8,26,0.36)'),
    fg: '#FFE9A8',
    edge: 'rgba(201,162,39,0.82)',
    art: SCENIC_ART.royal,
  },
}

export function carSkin(visualKey: string | null | undefined): CarSkin {
  return (visualKey && CAR_SKINS[visualKey]) || DEFAULT_CAR_SKIN
}

export function frameSkin(visualKey: string | null | undefined): FrameSkin {
  return (visualKey && FRAME_SKINS[visualKey]) || DEFAULT_FRAME_SKIN
}

export function nameplateSkin(visualKey: string | null | undefined): NameplateSkin {
  return (visualKey && NAMEPLATE_SKINS[visualKey]) || DEFAULT_NAMEPLATE_SKIN
}

/** Rarity → label + token colours, shared by shop rows and tooltips. */
export const RARITY_META: Record<string, { label: string; fg: string; bg: string }> = {
  common: { label: 'Cơ bản', fg: 'var(--rarity-common-fg)', bg: 'var(--rarity-common-bg)' },
  rare: { label: 'Hiếm', fg: 'var(--rarity-rare-fg)', bg: 'var(--rarity-rare-bg)' },
  epic: { label: 'Sử thi', fg: 'var(--rarity-epic-fg)', bg: 'var(--rarity-epic-bg)' },
  legendary: { label: 'Huyền thoại', fg: 'var(--rarity-legendary-fg)', bg: 'var(--rarity-legendary-bg)' },
}

export const TIER_META: Record<string, { label: string; color: string }> = {
  bronze: { label: 'Đồng', color: '#C98A55' },
  silver: { label: 'Bạc', color: '#B8C4CE' },
  gold: { label: 'Vàng', color: '#E0B34A' },
  diamond: { label: 'Kim Cương', color: '#7FD8E8' },
}

export function tierMeta(tier: string | null | undefined): { label: string; color: string } {
  return (tier && TIER_META[tier]) || { label: 'Chưa xếp hạng', color: 'var(--muted)' }
}
