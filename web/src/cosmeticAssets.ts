/** CSS images for the nameplate catalog. Photo credits are in public/cosmetics/CREDITS.md. */
const PLATE_ART: Record<string, string> = {
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

/** CSS `background-image` value for a known nameplate key. */
export function plateArt(visualKey: string | null | undefined): string | null {
  return (visualKey && PLATE_ART[visualKey]) || null
}
