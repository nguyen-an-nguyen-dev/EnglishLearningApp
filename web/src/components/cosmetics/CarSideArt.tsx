import { carEntry } from './garage/catalog'
import { CarClassicYellow } from './garage/cars/car_classic_yellow'

/** Side-profile car art for the Gara. Silhouette and palette live in garage/catalog.ts keyed by visual_key; style/idPrefix stay for API compatibility. */
export interface CarSideArtProps {
  visualKey?: string | null
  style?: Record<string, string | null> | null
  /** Kept for API compatibility; the new art has no gradient ids. */
  idPrefix: string
}

export function CarSideArt({ visualKey }: CarSideArtProps) {
  const Art = carEntry(visualKey)?.Art ?? CarClassicYellow
  return <Art />
}

export interface CarSidePreviewProps {
  visualKey?: string | null
  style?: Record<string, string | null> | null
  className?: string
}

/** Wide 2:1 preview for Gara cards and the garage bay. All models share the 240×130 canvas and ground y=108. */
export function CarSidePreview({ visualKey, className = 'car-side-preview' }: CarSidePreviewProps) {
  const Art = carEntry(visualKey)?.Art ?? CarClassicYellow
  return <Art className={className} />
}
