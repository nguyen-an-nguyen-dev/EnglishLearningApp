/**
 * Landing demo QA: the "Học qua video" tab must run a REAL lesson from the app
 * (shortest one), let a visitor finish only the free segments, then gate the
 * rest behind sign-up. Also checks the save-word gate and both viewports.
 *
 * Run: node .workbuddy-ai/tmp-shots/qa-landing-demo.cjs
 */
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const OUT = path.join(ROOT, '.workbuddy-ai/tmp-shots/qa-landing-demo')
const BASE = 'http://localhost:5173/'
const API = 'http://localhost:3000'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

const overflowProbe = `(() => {
  const wrap = document.querySelector('.landing-page-wrapper')
  const panel = document.querySelector('.lp-mode-panel')
  const bad = []
  if (panel) {
    const box = panel.getBoundingClientRect()
    for (const el of panel.querySelectorAll('button, textarea, input')) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1)) {
        bad.push({ tag: el.tagName, cls: el.className.toString().slice(0, 30), right: Math.round(r.right), boxRight: Math.round(box.right) })
      }
    }
  }
  return {
    pageScrollWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    wrapperPresent: Boolean(wrap),
    panelOverflow: bad,
  }
})()`

async function openDemo(page) {
  await page.locator('#modes').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  const videoTab = page.getByRole('tab', { name: /Học qua video/ })
  if (await videoTab.count()) {
    await videoTab.first().click().catch(() => {})
    await page.waitForTimeout(300)
  }
  await page.waitForSelector('.lp-demo', { timeout: 15000 })
  await page.waitForSelector('.practice-input', { timeout: 15000 })
  await page.waitForTimeout(500)
}

/** Types the dictation for the current segment until the words all unlock. */
async function solveCurrentSegment(page, segmentIndex) {
  const demo = await fetch(`${API}/api/demo/video`).then((r) => r.json())
  const text = demo.data.video.segments[segmentIndex].text_en
  const input = page.locator('.practice-input')
  await input.click()
  await input.fill('')
  await input.fill(text)
  await page.waitForTimeout(600)
  const state = await page.evaluate(() => ({
    complete: Boolean(document.querySelector('.practice-success')),
    revealed: document.querySelectorAll('.practice-word.is-revealed').length,
    hidden: document.querySelectorAll('.practice-word.is-hidden').length,
  }))
  return { text, ...state }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const demo = await fetch(`${API}/api/demo/video`).then((r) => r.json())
  const demoVideo = demo.data.video
  console.log('demo payload:', JSON.stringify({
    id: demoVideo.id, title: demoVideo.title.slice(0, 40),
    segments: demoVideo.segments.length, total: demoVideo.total_segments,
  }))

  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const report = {}

  for (const viewport of [{ name: '1440', width: 1440, height: 900 }, { name: '390', width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(e.message))

    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(1200)
    await openDemo(page)

    const entry = { pageErrors }
    entry.usesRealVideo = await page.locator(`.lp-demo[data-demo-video="${demoVideo.id}"]`).count()
    entry.stripe = (await page.locator('.lp-demo-badge').first().textContent().catch(() => ''))?.trim() ?? ''
    entry.oldMockIframe = await page.locator('.lp-yt-iframe').count()
    entry.segmentFirst = await solveCurrentSegment(page, 0)
    entry.progressLabel = (await page.locator('.practice-player-index').first().textContent().catch(() => ''))?.trim() ?? ''
    entry.pageErrorsAfterFirst = [...pageErrors]

    await page.screenshot({ path: path.join(OUT, `solve-1-${viewport.name}.png`) })

    // Save-word gate: click a revealed word, the auth dialog must open.
    const revealedWord = page.locator('.practice-word.is-revealed').nth(2)
    if (await revealedWord.count()) {
      await revealedWord.click()
      await page.waitForTimeout(600)
      entry.saveWordGated = await page.locator('.auth-dialog').count()
      await page.screenshot({ path: path.join(OUT, `saveword-gate-${viewport.name}.png`) })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    } else {
      entry.saveWordGated = 0
    }

    // Finish the remaining free segments, then the gate card must appear.
    for (let index = 1; index < demoVideo.segments.length; index += 1) {
      await page.locator('.practice-next').click()
      await page.waitForTimeout(500)
      await solveCurrentSegment(page, index)
    }
    await page.locator('.practice-next').click()
    await page.waitForTimeout(800)

    entry.gateVisible = await page.locator('.practice-gate').count()
    entry.gateTitle = (await page.locator('.practice-gate h2').first().textContent().catch(() => ''))?.trim() ?? ''
    entry.gatePoints = await page.locator('.practice-gate-list li').count()
    entry.gateCta = (await page.locator('.practice-gate-actions button').first().textContent().catch(() => ''))?.trim() ?? ''
    Object.assign(entry, await page.evaluate(overflowProbe))

    await page.screenshot({ path: path.join(OUT, `gate-${viewport.name}.png`) })

    // The gate CTA must open the sign-up dialog.
    await page.locator('.practice-gate-actions button').first().click()
    await page.waitForTimeout(700)
    entry.gateOpensAuth = await page.locator('.auth-dialog').count()
    await page.screenshot({ path: path.join(OUT, `gate-auth-${viewport.name}.png`) })

    report[viewport.name] = entry
    console.log(viewport.name, JSON.stringify(entry))
    await context.close()
  }

  await browser.close()
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log('wrote', path.join(OUT, 'report.json'))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
