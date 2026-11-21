/**
 * Legacy raster cosmetic artwork keyed by `visual_key`. Live frames are vector art
 * in `components/cosmetics/garage/frames`; `FRAME_HEAD` is kept for old data and is
 * no longer imported by `AvatarFrame`. Nameplate photos are Unsplash (see
 * `public/cosmetics/CREDITS.md`). Keep paths in sync with `shop_items` rows.
 */

export const FRAME_HEAD: Record<string, string> = {
  frame_bronze: '/cosmetics/frames/heads/tiger.png',
  frame_silver: '/cosmetics/frames/heads/koala.png',
  frame_gold: '/cosmetics/frames/heads/dog.png',
  frame_violet: '/cosmetics/frames/heads/owl.png',
  frame_prism: '/cosmetics/frames/heads/unicorn.png',
  frame_sakura: '/cosmetics/frames/heads/cat.png',
  frame_dragon: '/cosmetics/frames/heads/dragon.png',
  frame_ocean: '/cosmetics/frames/heads/penguin.png',
  frame_neon: '/cosmetics/frames/heads/fox.png',
}

export const PLATE_ART: Record<string, string> = {
  plate_slate: 'url("/cosmetics/plates/plate_slate.jpg")',
  plate_cyan: 'url("/cosmetics/plates/plate_cyan.jpg")',
  plate_sunset: 'url("/cosmetics/plates/plate_sunset.jpg")',
  plate_forest: 'url("/cosmetics/plates/plate_forest.jpg")',
  plate_royal: 'url("/cosmetics/plates/plate_royal.jpg")',
  plate_desert: 'url("/cosmetics/plates/plate_desert.jpg")',
  plate_space: 'url("/cosmetics/plates/plate_space.jpg")',
  plate_sakura: 'url("/cosmetics/plates/plate_sakura.jpg")',
  plate_ocean: 'url("/cosmetics/plates/plate_ocean.jpg")',
  plate_aurora: 'url("/cosmetics/plates/plate_aurora.jpg")',
}

/** Mascot head for a known frame key; unknown keys stay fully vector. */
export function frameHead(visualKey: string | null | undefined): string | null {
  return (visualKey && FRAME_HEAD[visualKey]) || null
}

/** CSS `background-image` value for a known nameplate key. */
export function plateArt(visualKey: string | null | undefined): string | null {
  return (visualKey && PLATE_ART[visualKey]) || null
}
