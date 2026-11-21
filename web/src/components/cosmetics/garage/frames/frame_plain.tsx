import { FRAME } from '../designTokens'
import { AvatarSlot, FrameSvg, Ring, SmallRing } from '../parts/frameParts'
import type { FrameArtProps } from '../parts/frameParts'

const paint = {
  ring: '#bfe9ff',
  dark: '#8ec9e8',
}

/** 07 · frame_plain — eight-unit light-blue ring, no mascot, no ornament. */
export function FramePlain({ letter = 'K', fontSize = 48 }: FrameArtProps = {}) {
  return (
    <FrameSvg label="Khung mặc định">
      <AvatarSlot letter={letter} fontSize={fontSize} />
      <Ring outer={FRAME.ringDefaultOuter} fill={paint.ring} dark={paint.dark} />
    </FrameSvg>
  )
}

export function FramePlainSmall() {
  return <SmallRing outer={FRAME.ringDefaultOuter} fill={paint.ring} dark={paint.dark} label="Khung mặc định cỡ nhỏ" />
}
