const { chromium } = require('playwright')
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'
;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  for (const vp of [{ n: '1440', w: 1440, h: 900 }, { n: '390', w: 390, h: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } })
    const page = await ctx.newPage()
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1400)
    const m = await page.evaluate(() => {
      const el = document.querySelector('.lp-hero-3d')
      const cs = getComputedStyle(el)
      return {
        tiltVars: [cs.getPropertyValue('--tilt-x').trim(), cs.getPropertyValue('--tilt-y').trim()],
        inlineTransform: el.style.transform.slice(0, 60),
        pageScrollW: document.documentElement.scrollWidth,
        viewport: innerWidth,
      }
    })
    console.log(vp.n, JSON.stringify(m))
    await ctx.close()
  }
  await browser.close()
})()
