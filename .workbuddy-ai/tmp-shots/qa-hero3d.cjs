const { chromium } = require('playwright')
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'
;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  for (const vp of [{ n: '1440', w: 1440, h: 900 }, { n: '390', w: 390, h: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } })
    const page = await ctx.newPage()
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    const probe = await page.evaluate(() => {
      const art = document.querySelector('.lp-hero-art-panel')
      const card = document.querySelector('.lp-lesson-preview')
      const a = art.getBoundingClientRect(), c = card.getBoundingClientRect()
      return {
        cardInsidePanel: c.left >= a.left - 2 && c.right <= a.right + 2 && c.top >= a.top - 2 && c.bottom <= a.bottom + 2,
        pageScrollWidth: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        transform: getComputedStyle(document.querySelector('.lp-hero-3d')).transform.slice(0, 40),
      }
    })
    console.log(vp.n, JSON.stringify(probe))
    await page.screenshot({ path: `.workbuddy-ai/tmp-shots/qa-hero3d/hero-${vp.n}.png` })
    await ctx.close()
  }
  await browser.close()
})()
