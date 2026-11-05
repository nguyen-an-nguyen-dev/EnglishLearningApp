const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const OUT = path.join(ROOT, '.workbuddy-ai/tmp-shots/landing-audit')
const BASE = 'http://localhost:5174/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function shoot(page, name) {
  await page.screenshot({ path: path.join(OUT, name) })
  console.log('saved', name)
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const dp = await desktop.newPage()
  await dp.goto(BASE, { waitUntil: 'networkidle' })
  await dp.waitForSelector('.landing-page-wrapper')
  await dp.waitForTimeout(600)
  await dp.locator('#mode-tab-duel').click()
  await dp.waitForTimeout(700)
  await dp.locator('#modes').scrollIntoViewIfNeeded()
  await dp.waitForTimeout(500)
  await shoot(dp, 'desktop-1440-duel.png')
  const tabInfo = await dp.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: Math.round(r.top + window.scrollY), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) }
    }
    return {
      panel: rect('.lp-mode-panel'),
      arena: rect('.lp-arena'),
      arenaRail: rect('.lp-arena-rail'),
      stage: rect('.lp-arena-stage'),
      options: [...document.querySelectorAll('.lp-arena-option')].map((el) => {
        const r = el.getBoundingClientRect()
        return { right: Math.round(r.right), width: Math.round(r.width) }
      }),
      panelRight: rect('.lp-mode-panel')?.right,
    }
  })
  console.log(JSON.stringify(tabInfo, null, 2))

  await dp.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0) })
  await dp.waitForTimeout(300)
  await dp.locator('.lp-header-actions .lp-nav-login').click()
  await dp.waitForTimeout(600)
  await shoot(dp, 'desktop-1440-auth-login.png')
  const auth = await dp.evaluate(() => {
    const d = document.querySelector('.auth-dialog')
    if (!d) return null
    const r = d.getBoundingClientRect()
    return {
      rect: { width: Math.round(r.width), height: Math.round(r.height) },
      texts: [...d.querySelectorAll('button, .auth-footer, .auth-divider')].map((el) => (el.textContent || '').trim()).filter(Boolean).slice(0, 14),
      socialButtons: d.querySelectorAll('.auth-social-btn').length,
      html: d.querySelector('.auth-social')?.innerHTML.slice(0, 500),
    }
  })
  console.log(JSON.stringify(auth, null, 2))
  await desktop.close()

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 })
  const mp = await mobile.newPage()
  await mp.goto(BASE, { waitUntil: 'networkidle' })
  await mp.waitForSelector('.landing-page-wrapper')
  await mp.waitForTimeout(600)
  await mp.locator('.lp-menu-toggle').click()
  await mp.waitForTimeout(400)
  await shoot(mp, 'mobile-390-menu.png')
  await mp.locator('.lp-menu-toggle').click()
  await mp.locator('#mode-tab-duel').scrollIntoViewIfNeeded()
  await mp.waitForTimeout(300)
  await mp.locator('#mode-tab-duel').click()
  await mp.waitForTimeout(700)
  await mp.locator('#mode-tab-duel').scrollIntoViewIfNeeded()
  await mp.waitForTimeout(400)
  await shoot(mp, 'mobile-390-duel.png')
  const mobileDuel = await mp.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: Math.round(r.top + window.scrollY), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) }
    }
    return {
      panel: rect('.lp-mode-panel'),
      arena: rect('.lp-arena'),
      rail: rect('.lp-arena-rail'),
      stage: rect('.lp-arena-stage'),
      options: [...document.querySelectorAll('.lp-arena-option')].map((el) => {
        const r = el.getBoundingClientRect()
        return { text: el.textContent.trim().slice(0, 30), left: Math.round(r.left), right: Math.round(r.right) }
      }),
    }
  })
  console.log(JSON.stringify(mobileDuel, null, 2))
  await mp.locator('#mode-tab-duel').scrollIntoViewIfNeeded()
  await mp.evaluate(() => window.scrollBy(0, -100))
  await mp.waitForTimeout(300)
  await mp.locator('.lp-nav-login').count().then((n) => console.log('mobile login in header', n))
  await mobile.close()

  await browser.close()
}

main().catch((err) => { console.error(err); process.exit(1) })
