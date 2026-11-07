/**
 * Hero 3D motion QA: the card must (a) float on its own, (b) follow the pointer
 * with a smoothed ease rather than a snap, and (c) return when the pointer
 * leaves. Also captures the rest / hover / tilt frames for eyeballing.
 *
 * Run: node .workbuddy-ai/tmp-shots/qa-hero-motion.cjs
 */
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const OUT = path.join(ROOT, '.workbuddy-ai/tmp-shots/qa-hero3d')
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function readTransform(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.lp-hero-3d')
    return el ? getComputedStyle(el).transform : null
  })
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  const card = page.locator('.lp-hero-3d')
  const box = await card.boundingBox()

  const samples = []
  samples.push({ at: 'rest-1', transform: await readTransform(page) })
  await page.waitForTimeout(700)
  samples.push({ at: 'rest-2', transform: await readTransform(page) })

  // Pointer to the top-left corner of the card.
  await page.mouse.move(box.x + 10, box.y + 10)
  await page.waitForTimeout(120)
  samples.push({ at: 'tilt-mid', transform: await readTransform(page) })
  await page.waitForTimeout(900)
  samples.push({ at: 'tilt-settled', transform: await readTransform(page) })
  await page.screenshot({ path: path.join(OUT, 'tilt-topleft.png') })

  // Pointer to the bottom-right corner.
  await page.mouse.move(box.x + box.width - 12, box.y + box.height - 12)
  await page.waitForTimeout(900)
  samples.push({ at: 'tilt-bottomright', transform: await readTransform(page) })
  await page.screenshot({ path: path.join(OUT, 'tilt-bottomright.png') })

  // Leave: it should ease back toward the resting angle.
  await page.mouse.move(40, 40)
  await page.waitForTimeout(1200)
  samples.push({ at: 'after-leave', transform: await readTransform(page) })

  const report = {
    pageErrors,
    floats: samples[0].transform !== samples[1].transform,
    reactsToPointer: samples[3].transform !== samples[1].transform,
    intermediateFrame: samples[2].transform !== samples[1].transform
      && samples[2].transform !== samples[3].transform,
    samples,
  }
  console.log(JSON.stringify({
    pageErrors: report.pageErrors,
    floats: report.floats,
    reactsToPointer: report.reactsToPointer,
    intermediateFrame: report.intermediateFrame,
  }))
  fs.writeFileSync(path.join(OUT, 'motion-report.json'), JSON.stringify(report, null, 2))
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
