import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CARS, FRAMES } from '../src/components/cosmetics/garage/catalog'
import { CarSidePreview } from '../src/components/cosmetics/CarSideArt'
import { AvatarFrame } from '../src/components/cosmetics/AvatarFrame'
import { CosmeticPreview } from '../src/components/shop/CosmeticPreview'

const checks: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail })

for (const entry of CARS) {
  const markup = renderToStaticMarkup(createElement(CarSidePreview, { visualKey: entry.visualKey }))
  check(`${entry.visualKey} viewBox`, markup.includes('viewBox="0 0 240 130"'), '240×130')
  check(`${entry.visualKey} no raster`, !markup.includes('<img') && !markup.includes('.png'), 'inline SVG only')
  check(`${entry.visualKey} no heavy paint`, !/linearGradient|radialGradient|<filter/i.test(markup), 'no gradients/filters')

  const wheelMatches = [...markup.matchAll(/<g class="car-wheel"><circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)]
  if (entry.visualKey === 'car_aurora') {
    const pads = [...markup.matchAll(/<ellipse cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)"/g)]
      .filter((m) => Number(m[3]) === 22)
    const padOk = pads.length === 2 && pads.every((m) => Math.abs(Number(m[2]) + Number(m[4]) - 102) < 0.2)
    check(`${entry.visualKey} pads`, padOk, pads.map((m) => `bottom=${Number(m[2]) + Number(m[4])}`).join(', '))
  } else {
    const contact = wheelMatches.map((m) => Number(m[2]) + Number(m[3]))
    check(`${entry.visualKey} ground`, wheelMatches.length === entry.wheels?.length && contact.every((y) => Math.abs(y - 108) < 0.01), contact.join(', '))
  }
}

for (const entry of FRAMES) {
  const full = renderToStaticMarkup(createElement(AvatarFrame, { name: 'Khoa', visualKey: entry.visualKey, size: 92 }))
  const small = renderToStaticMarkup(createElement(AvatarFrame, { name: 'Khoa', visualKey: entry.visualKey, size: 38 }))
  const preview = renderToStaticMarkup(createElement(CosmeticPreview, { slot: 'frame', visualKey: entry.visualKey, size: 150 }))
  const smallFile = renderToStaticMarkup(createElement(entry.Small))

  check(`${entry.visualKey} viewBox`, full.includes('viewBox="0 0 200 200"'), '200×200')
  check(`${entry.visualKey} no raster`, !/\.png|<img/i.test(full), 'no PNG head')
  check(`${entry.visualKey} rings`, full.includes('r="46"') && full.includes(`r="${entry.ringOuter ?? 60}"`), '46 / outer')
  check(`${entry.visualKey} small`, small.length <= full.length + 20 && small.includes('r="46"'), `${small.length} vs ${full.length}`)
  check(`${entry.visualKey} shop wrapper`, preview.includes('cosmetic-preview-frame') && preview.includes('width:123px'), 'CosmeticPreview → AvatarFrame 123')
  check(`${entry.visualKey} small asset`, smallFile.length < 2600 && smallFile.includes('cỡ nhỏ'), `${smallFile.length} bytes`)
}

for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name.padEnd(36)} ${item.detail}`)
}
const failed = checks.filter((item) => !item.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
if (failed.length > 0) process.exitCode = 1
