const { chromium } = require('playwright')
const path = require('path')

const OUT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/.workbuddy-ai/tmp-shots/dashboard-audit'
const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })

  for (const [width, height, name] of [[1440, 900, 'desktop'], [390, 844, 'mobile-light']]) {
    const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 500 })
    const page = await ctx.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(OUT, `landing-${name}-header.png`), clip: { x: 0, y: 0, width, height: name === 'mobile-light' ? 260 : 320 } })
    await page.screenshot({ path: path.join(OUT, `landing-${name}-full.png`), fullPage: true })

    if (width < 500) {
      await page.locator('.lp-menu-toggle').click()
      await page.waitForTimeout(400)
      await page.screenshot({ path: path.join(OUT, 'landing-mobile-menu-open.png'), clip: { x: 0, y: 0, width: 390, height: 420 } })
    }
    await ctx.close()
  }

  await browser.close()
}

main().catch((err) => { console.error(err); process.exit(1) })
