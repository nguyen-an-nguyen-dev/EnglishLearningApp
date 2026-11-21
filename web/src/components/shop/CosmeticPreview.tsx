import { CarSidePreview } from '../cosmetics/CarSideArt'
import { AvatarFrame } from '../cosmetics/AvatarFrame'
import { Nameplate } from '../cosmetics/Nameplate'
import type { CosmeticSlot } from '../../types/gamification'

export interface CosmeticPreviewProps {
  slot: CosmeticSlot
  visualKey: string
  /** Admin-defined palette from the shop row. */
  style?: Record<string, string | null> | null
  /** Name shown inside the frame/nameplate previews. */
  sampleName?: string
  size?: number
}

/**
 * One preview surface per cosmetic slot, all reading the same `cosmetics.ts`
 * palette. Locked items still render their full preview (the shop dims them with
 * CSS), so a learner can always see what they are working toward.
 */
export function CosmeticPreview({ slot, visualKey, style, sampleName = 'Engorace', size = 132 }: CosmeticPreviewProps) {
  if (slot === 'car') {
    // Cars are shown in profile, not top-down: the shop art box is landscape,
    // so a side view is what fills it legibly.
    return <CarSidePreview className="car-side-preview" visualKey={visualKey} style={style} />
  }
  if (slot === 'frame') {
    return (
      <div className="cosmetic-preview-frame" style={{ width: size, height: size }}>
        <AvatarFrame name={sampleName} visualKey={visualKey} style={style} size={Math.round(size * 0.82)} />
      </div>
    )
  }
  return (
    <div className="cosmetic-preview-plate" style={{ width: size, height: size }}>
      <Nameplate visualKey={visualKey} style={style}>{sampleName}</Nameplate>
    </div>
  )
}
