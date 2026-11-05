const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const OUT = path.join(ROOT, '.workbuddy-ai/tmp-shots/landing-audit')
const BASE = 'http://localhost:5174/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function shoot(page, name, options = {}) {
  await page.screenshot({ path: path.join(OUT, name), ...options })
  console.log('saved', name)
}

async function audit(page, label) {
  const data = await page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: Math.round(r.top + window.scrollY), bottom: Math.round(r.bottom + window.scrollY), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) }
    }
    const cs = (sel, prop) => {
      const el = document.querySelector(sel)
      return el ? getComputedStyle(el)[prop] : null
    }
    const all = (sel) => [...document.querySelectorAll(sel)].map((el) => {
      const r = el.getBoundingClientRect()
      return { text: (el.textContent || '').trim().slice(0, 40), top: Math.round(r.top + window.scrollY), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) }
    })
    const overflow = [...document.querySelectorAll('.landing-page-wrapper *')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && (r.right > document.documentElement.clientWidth + 1 || r.left < -1)
      })
      .slice(0, 12)
      .map((el) => ({ tag: el.tagName, cls: el.className?.baseVal ?? el.className, right: Math.round(el.getBoundingClientRect().right) }))
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      docHeight: document.documentElement.scrollHeight,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      header: rect('.lp-header'),
      hero: rect('.lp-hero'),
      heroGrid: rect('.lp-hero-grid'),
      heroCopy: rect('.lp-hero-copy'),
      heroArt: rect('.lp-hero-art'),
      heroPanel: rect('.lp-hero-art-panel'),
      heroTitleSize: cs('.lp-hero h1', 'fontSize'),
      heroTitleLine: cs('.lp-hero h1', 'lineHeight'),
      heroDescWidth: rect('.lp-hero-description'),
      heroFacts: rect('.lp-hero-facts'),
      curriculum: rect('.lp-curriculum'),
      curriculumHeading: rect('#curriculum-title'),
      curriculumIntro: rect('.lp-curriculum-intro'),
      stageTrack: rect('.lp-stage-track'),
      stageCards: all('.lp-stage-card'),
      modes: rect('.lp-modes'),
      modePanel: rect('.lp-mode-panel'),
      finalCta: rect('.lp-final-cta'),
      footer: rect('.lp-footer'),
      bigGaps: (() => {
        const sections = ['.lp-band-hero', '.lp-band-curriculum', '.lp-band-modes', '.lp-band-conclusion'].map((s) => {
          const el = document.querySelector(s)
          const r = el.getBoundingClientRect()
          return { sel: s, top: Math.round(r.top + window.scrollY), bottom: Math.round(r.bottom + window.scrollY) }
        })
        return sections
      })(),
      overflow,
    }
  })
  console.log(`\n===== ${label} =====`)
  console.log(JSON.stringify(data, null, 2))
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const dp = await desktop.newPage()
  await dp.goto(BASE, { waitUntil: 'networkidle' })
  await dp.waitForSelector('.landing-page-wrapper')
  await dp.waitForTimeout(900)
  await audit(dp, 'desktop 1440')
  await shoot(dp, 'desktop-1440-top.png')
  await dp.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 760) })
  await dp.waitForTimeout(500)
  await shoot(dp, 'desktop-1440-curriculum.png')
  await dp.evaluate(() => window.scrollTo(0, 1650))
  await dp.waitForTimeout(500)
  await shoot(dp, 'desktop-1440-modes.png')
  await dp.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await dp.waitForTimeout(500)
  await shoot(dp, 'desktop-1440-footer.png')
  await dp.evaluate(() => window.scrollTo(0, 0))
  await dp.waitForTimeout(300)
  await dp.locator('.lp-hero .lp-button-primary').click()
  await dp.waitForTimeout(500)
  await shoot(dp, 'desktop-1440-auth.png')
  await desktop.close()

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 })
  const mp = await mobile.newPage()
  await mp.goto(BASE, { waitUntil: 'networkidle' })
  await mp.waitForSelector('.landing-page-wrapper')
  await mp.waitForTimeout(900)
  await audit(mp, 'mobile 390')
  await shoot(mp, 'mobile-390-top.png')
  for (const [i, y] of [700, 1400, 2100, 2800, 3500, 4200].entries()) {
    await mp.evaluate((top) => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, top) }, y)
    await mp.waitForTimeout(350)
    await shoot(mp, `mobile-390-${i + 1}.png`)
  }
  await mp.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await mp.waitForTimeout(350)
  await shoot(mp, 'mobile-390-footer.png')
  await mobile.close()

  await browser.close()
}

main().catch((err) => { console.error(err); process.exit(1) })
