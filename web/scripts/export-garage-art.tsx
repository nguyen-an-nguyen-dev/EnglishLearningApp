import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CarClassicYellow } from '../src/components/cosmetics/garage/cars/car_classic_yellow'
import { CarSportRed } from '../src/components/cosmetics/garage/cars/car_sport_red'
import { CarMint } from '../src/components/cosmetics/garage/cars/car_mint'
import { CarNavy } from '../src/components/cosmetics/garage/cars/car_navy'
import { CarAurora } from '../src/components/cosmetics/garage/cars/car_aurora'
import { CarGold } from '../src/components/cosmetics/garage/cars/car_gold'
import { CarRickshaw } from '../src/components/cosmetics/garage/cars/car_rickshaw'
import { CarMonster } from '../src/components/cosmetics/garage/cars/car_monster'
import { CarFormula } from '../src/components/cosmetics/garage/cars/car_formula'
import { CarJeep } from '../src/components/cosmetics/garage/cars/car_jeep'
import { FramePlain, FramePlainSmall } from '../src/components/cosmetics/garage/frames/frame_plain'
import { FrameBronze, FrameBronzeSmall } from '../src/components/cosmetics/garage/frames/frame_bronze'
import { FrameSilver, FrameSilverSmall } from '../src/components/cosmetics/garage/frames/frame_silver'
import { FrameGold, FrameGoldSmall } from '../src/components/cosmetics/garage/frames/frame_gold'
import { FrameViolet, FrameVioletSmall } from '../src/components/cosmetics/garage/frames/frame_violet'
import { FramePrism, FramePrismSmall } from '../src/components/cosmetics/garage/frames/frame_prism'
import { FrameSakura, FrameSakuraSmall } from '../src/components/cosmetics/garage/frames/frame_sakura'
import { FrameDragon, FrameDragonSmall } from '../src/components/cosmetics/garage/frames/frame_dragon'
import { FrameOcean, FrameOceanSmall } from '../src/components/cosmetics/garage/frames/frame_ocean'
import { FrameNeon, FrameNeonSmall } from '../src/components/cosmetics/garage/frames/frame_neon'

const outDir = join(process.cwd(), 'public', 'cosmetics', 'garage')
mkdirSync(outDir, { recursive: true })

const files = [
  ['car_classic_yellow.svg', CarClassicYellow],
  ['car_sport_red.svg', CarSportRed],
  ['car_mint.svg', CarMint],
  ['car_navy.svg', CarNavy],
  ['car_aurora.svg', CarAurora],
  ['car_gold.svg', CarGold],
  ['car_rickshaw.svg', CarRickshaw],
  ['car_monster.svg', CarMonster],
  ['car_formula.svg', CarFormula],
  ['car_jeep.svg', CarJeep],
  ['frame_plain.svg', FramePlain],
  ['frame_plain.small.svg', FramePlainSmall],
  ['frame_bronze.svg', FrameBronze],
  ['frame_bronze.small.svg', FrameBronzeSmall],
  ['frame_silver.svg', FrameSilver],
  ['frame_silver.small.svg', FrameSilverSmall],
  ['frame_gold.svg', FrameGold],
  ['frame_gold.small.svg', FrameGoldSmall],
  ['frame_violet.svg', FrameViolet],
  ['frame_violet.small.svg', FrameVioletSmall],
  ['frame_prism.svg', FramePrism],
  ['frame_prism.small.svg', FramePrismSmall],
  ['frame_sakura.svg', FrameSakura],
  ['frame_sakura.small.svg', FrameSakuraSmall],
  ['frame_dragon.svg', FrameDragon],
  ['frame_dragon.small.svg', FrameDragonSmall],
  ['frame_ocean.svg', FrameOcean],
  ['frame_ocean.small.svg', FrameOceanSmall],
  ['frame_neon.svg', FrameNeon],
  ['frame_neon.small.svg', FrameNeonSmall],
] as const

let failed = false
for (const [name, Art] of files) {
  const markup = renderToStaticMarkup(createElement(Art))
  const path = join(outDir, name)
  writeFileSync(path, `${markup}\n`, 'utf8')
  const bytes = statSync(path).size
  const kb = (bytes / 1024).toFixed(2)
  if (bytes >= 6 * 1024) failed = true
  console.log(`${name.padEnd(28)} ${kb.padStart(6)} KB${bytes >= 6 * 1024 ? '  OVER' : ''}`)
}

if (failed) {
  console.error('At least one SVG is over the 6 KB budget.')
  process.exitCode = 1
}
