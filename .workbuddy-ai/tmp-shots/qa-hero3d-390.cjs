const { chromium } = require('playwright')
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'
;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  const m = await page.evaluate(() => {
    const panel = document.querySelector('.lp-hero-art-panel').getBoundingClientRect()
    const card = document.querySelector('.lp-lesson-preview').getBoundingClientRect()
    return {
      panelH: Math.round(panel.height), cardH: Math.round(card.height),
      panelBottom: Math.round(panel.bottom), cardBottom: Math.round(card.bottom),
      clipped: card.bottom > panel.bottom + 1,
      scrollW: document.documentElement.scrollWidth,
    }
  })
  console.log(JSON.stringify(m))
  await page.locator('.lp-hero-art-panel').screenshot({ path: '.workbuddy-ai/tmp-shots/qa-hero3d/panel-390.png' })
  await browser.close()
})()
