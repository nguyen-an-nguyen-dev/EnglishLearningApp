import { CarPreview } from '../cosmetics/CarArt'
import { AvatarFrame } from '../cosmetics/AvatarFrame'
import { Nameplate } from '../cosmetics/Nameplate'
import type { CosmeticSlot } from '../../types/gamification'

export interface CosmeticPreviewProps {
  slot: CosmeticSlot
  visualKey: string
  /** Name shown inside the frame/nameplate previews. */
  sampleName?: string
  size?: number
}

/**
 * One preview surface per cosmetic slot, all reading the same `cosmetics.ts`
 * palette. Locked items still render their full preview (the shop dims them with
 * CSS), so a learner can always see what they are working toward.
 */
export function CosmeticPreview({ slot, visualKey, sampleName = 'Engorace', size = 132 }: CosmeticPreviewProps) {
  if (slot === 'car') {
    return <CarPreview visualKey={visualKey} size={size} />
  }
  if (slot === 'frame') {
    return (
      <div className="cosmetic-preview-frame" style={{ width: size, height: size }}>
        <AvatarFrame name={sampleName} visualKey={visualKey} size={Math.round(size * 0.62)} />
      </div>
    )
  }
  return (
    <div className="cosmetic-preview-plate" style={{ width: size, height: size }}>
      <Nameplate visualKey={visualKey}>{sampleName}</Nameplate>
    </div>
  )
}
