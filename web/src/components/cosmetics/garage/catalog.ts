import type { ComponentType } from 'react'
import type { RarityKey } from './designTokens'
import type { CarArtProps } from './parts/carParts'
import type { FrameArtProps } from './parts/frameParts'
import { CarClassicYellow } from './cars/car_classic_yellow'
import { CarSportRed } from './cars/car_sport_red'
import { CarMint } from './cars/car_mint'
import { CarNavy } from './cars/car_navy'
import { CarAurora } from './cars/car_aurora'
import { CarGold } from './cars/car_gold'
import { CarRickshaw } from './cars/car_rickshaw'
import { CarMonster } from './cars/car_monster'
import { CarFormula } from './cars/car_formula'
import { CarJeep } from './cars/car_jeep'
import { FramePlain, FramePlainSmall } from './frames/frame_plain'
import { FrameBronze, FrameBronzeSmall } from './frames/frame_bronze'
import { FrameSilver, FrameSilverSmall } from './frames/frame_silver'
import { FrameGold, FrameGoldSmall } from './frames/frame_gold'
import { FrameViolet, FrameVioletSmall } from './frames/frame_violet'
import { FramePrism, FramePrismSmall } from './frames/frame_prism'
import { FrameSakura, FrameSakuraSmall } from './frames/frame_sakura'
import { FrameDragon, FrameDragonSmall } from './frames/frame_dragon'
import { FrameOcean, FrameOceanSmall } from './frames/frame_ocean'
import { FrameNeon, FrameNeonSmall } from './frames/frame_neon'

/**
 * Catalogue keyed by the shop's existing `visual_key`. The `code` and numeric
 * `id` are the rows in `shop_items`; nothing here changes the API.
 */
export interface CarEntry {
  id: number
  code: string
  visualKey: string
  name: string
  description: string
  rarity: RarityKey
  width: number
  wheelR: number
  wheelLabel?: string
  wheels?: readonly { cx: number; r: number }[]
  /** Extra attachment points: spoiler struts, rack feet, antenna base... */
  anchors?: readonly { x: number; y: number; label: string }[]
  status: 'ready'
  Art: ComponentType<CarArtProps>
}

export interface FrameEntry {
  id: number
  code: string
  visualKey: string
  name: string
  description: string
  rarity: RarityKey
  ringOuter?: 54 | 60
  locked?: boolean
  status: 'ready'
  Art: ComponentType<FrameArtProps>
  Small: ComponentType
}

export const CARS: readonly CarEntry[] = [
  {
    id: 1, code: 'car_default', visualKey: 'car_classic_yellow', name: 'Xe vàng kinh điển',
    description: 'Chiếc xe đầu tiên của mọi tay đua Engorace.', rarity: 'common', width: 190, wheelR: 17,
    wheels: [{ cx: 61, r: 17 }, { cx: 183, r: 17 }], status: 'ready', Art: CarClassicYellow,
  },
  {
    id: 2, code: 'car_sport_red', visualKey: 'car_sport_red', name: 'Xe thể thao đỏ',
    description: 'Thân xe đỏ gọn, tem đua kéo dài tới đuôi.', rarity: 'rare', width: 193, wheelR: 17,
    wheels: [{ cx: 58, r: 17 }, { cx: 184, r: 17 }],
    anchors: [{ x: 44, y: 60, label: 'cánh gió' }, { x: 60, y: 60, label: 'cánh gió' }],
    status: 'ready', Art: CarSportRed,
  },
  {
    id: 3, code: 'car_mint', visualKey: 'car_mint', name: 'Xe van bạc hà',
    description: 'Van nhỏ bạc hà, cao ráo và len lỏi tốt trong phố.', rarity: 'rare', width: 170, wheelR: 15,
    wheels: [{ cx: 68, r: 15 }, { cx: 176, r: 15 }],
    anchors: [{ x: 91, y: 40, label: 'giá nóc' }, { x: 139, y: 40, label: 'giá nóc' }],
    status: 'ready', Art: CarMint,
  },
  {
    id: 4, code: 'car_navy', visualKey: 'car_navy', name: 'Xe navy đêm',
    description: 'Xanh navy sâu, chỉ dành cho người qua chặng 3.', rarity: 'epic', width: 190, wheelR: 17,
    wheels: [{ cx: 60, r: 17 }, { cx: 184, r: 17 }], status: 'ready', Art: CarNavy,
  },
  {
    id: 5, code: 'car_aurora', visualKey: 'car_aurora', name: 'Xe cực quang',
    description: 'Dải cực quang xanh tím chạy dọc thân xe.', rarity: 'epic', width: 196, wheelR: 0,
    wheelLabel: '2 hoverpad', wheels: [],
    anchors: [{ x: 70, y: 102, label: 'hoverpad' }, { x: 172, y: 102, label: 'hoverpad' }],
    status: 'ready', Art: CarAurora,
  },
  {
    id: 6, code: 'car_gold', visualKey: 'car_gold', name: 'Xe hoàng kim',
    description: 'Toàn thân vàng kim, của những tay đua cấp 9.', rarity: 'legendary', width: 200, wheelR: 17,
    wheels: [{ cx: 54, r: 17 }, { cx: 186, r: 17 }], status: 'ready', Art: CarGold,
  },
  {
    id: 23, code: 'car_rickshaw', visualKey: 'car_rickshaw', name: 'Xe lam tốc độ',
    description: 'Chiếc xe lam ba bánh sơn xanh, lách qua mọi con phố.', rarity: 'rare', width: 140, wheelR: 14,
    wheels: [{ cx: 78, r: 14 }, { cx: 84, r: 14 }, { cx: 176, r: 14 }],
    anchors: [{ x: 70, y: 76, label: 'mui vải' }, { x: 184, y: 64, label: 'mui vải' }],
    status: 'ready', Art: CarRickshaw,
  },
  {
    id: 24, code: 'car_monster', visualKey: 'car_monster', name: 'Xe quái vật',
    description: 'Bánh khổng lồ và tiếng máy gầm vang cả đường đua.', rarity: 'epic', width: 190, wheelR: 26,
    wheels: [{ cx: 62, r: 26 }, { cx: 182, r: 26 }],
    anchors: [{ x: 61, y: 51, label: 'ống xả' }], status: 'ready', Art: CarMonster,
  },
  {
    id: 25, code: 'car_formula', visualKey: 'car_formula', name: 'Xe đua công thức',
    description: 'Bản thu nhỏ của một chiếc F1 đỏ rực, chỉ dành cho tay đua cứng.', rarity: 'legendary', width: 196, wheelR: 21,
    wheelLabel: 'R19 / R21', wheels: [{ cx: 52, r: 21 }, { cx: 170, r: 19 }],
    anchors: [{ x: 32, y: 68, label: 'cánh sau' }, { x: 50, y: 68, label: 'cánh sau' }, { x: 198, y: 84, label: 'cánh trước' }, { x: 210, y: 84, label: 'cánh trước' }],
    status: 'ready', Art: CarFormula,
  },
  {
    id: 26, code: 'car_jeep', visualKey: 'car_jeep', name: 'Jeep đường dài',
    description: 'Gầm cao, lốp dự phòng, sẵn sàng cho mọi chặng đường.', rarity: 'epic', width: 190, wheelR: 21,
    wheels: [{ cx: 62, r: 21 }, { cx: 182, r: 21 }],
    anchors: [{ x: 107, y: 41, label: 'giá nóc' }, { x: 137, y: 41, label: 'giá nóc' }, { x: 38, y: 56, label: 'lốp dự phòng' }],
    status: 'ready', Art: CarJeep,
  },
] as const

export const FRAMES: readonly FrameEntry[] = [
  { id: 7, code: 'frame_default', visualKey: 'frame_plain', name: 'Khung mặc định', description: 'Khung tròn đơn giản, ai cũng có.', rarity: 'common', ringOuter: 54, status: 'ready', Art: FramePlain, Small: FramePlainSmall },
  { id: 8, code: 'frame_bronze', visualKey: 'frame_bronze', name: 'Khung hổ lửa', description: 'Hổ con cam lửa ôm vành đồng, sọc hổ chạy quanh viền.', rarity: 'rare', status: 'ready', Art: FrameBronze, Small: FrameBronzeSmall },
  { id: 9, code: 'frame_silver', visualKey: 'frame_silver', name: 'Khung gấu túi bạc', description: 'Gấu túi xám ôm vòng bạc lấp lánh.', rarity: 'rare', status: 'ready', Art: FrameSilver, Small: FrameSilverSmall },
  { id: 10, code: 'frame_gold', visualKey: 'frame_gold', name: 'Khung cún vàng', description: 'Cún vàng mũm mĩm với những tia sáng quanh viền.', rarity: 'epic', status: 'ready', Art: FrameGold, Small: FrameGoldSmall },
  { id: 11, code: 'frame_violet', visualKey: 'frame_violet', name: 'Khung cú tinh tú', description: 'Cú nâu đội vòng sao tím, mắt tròn xoe.', rarity: 'epic', status: 'ready', Art: FrameViolet, Small: FrameVioletSmall },
  { id: 12, code: 'frame_prism', visualKey: 'frame_prism', name: 'Khung kỳ lân', description: 'Kỳ lân pastel với sừng cầu vồng và đốm sáng thủy tinh.', rarity: 'legendary', status: 'ready', Art: FramePrism, Small: FramePrismSmall },
  { id: 27, code: 'frame_sakura', visualKey: 'frame_sakura', name: 'Khung mèo anh đào', description: 'Mèo vàng tinh nghịch trong vòng hoa anh đào.', rarity: 'epic', status: 'ready', Art: FrameSakura, Small: FrameSakuraSmall },
  { id: 28, code: 'frame_dragon', visualKey: 'frame_dragon', name: 'Khung rồng lửa', description: 'Rồng ngọc canh vòng nguyệt quế, ánh vàng trên nền xanh.', rarity: 'legendary', locked: true, status: 'ready', Art: FrameDragon, Small: FrameDragonSmall },
  { id: 29, code: 'frame_ocean', visualKey: 'frame_ocean', name: 'Khung cánh cụt biển', description: 'Cánh cụt nhỏ với những bong bóng biển xanh.', rarity: 'rare', status: 'ready', Art: FrameOcean, Small: FrameOceanSmall },
  { id: 30, code: 'frame_neon', visualKey: 'frame_neon', name: 'Khung cáo neon', description: 'Cáo cam tinh nghịch trong vầng sáng neon tím.', rarity: 'epic', status: 'ready', Art: FrameNeon, Small: FrameNeonSmall },
] as const

export function carEntry(visualKey: string | null | undefined): CarEntry | null {
  return CARS.find((entry) => entry.visualKey === visualKey) ?? null
}

export function frameEntry(visualKey: string | null | undefined): FrameEntry | null {
  return FRAMES.find((entry) => entry.visualKey === visualKey) ?? null
}
