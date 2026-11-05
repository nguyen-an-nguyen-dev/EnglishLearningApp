const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const OUT = path.join(ROOT, '.workbuddy-ai/tmp-shots/color-compare')
const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function login() {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: '123456' }),
  })
  return (await res.json()).data
}

async function shoot(page, name) {
  await page.screenshot({ path: path.join(OUT, name) })
  console.log('saved', name)
}

async function probeColors(page) {
  return page.evaluate(() => {
    const get = (sel, prop, fallback = null) => {
      const el = document.querySelector(sel)
      if (!el) return fallback
      const v = getComputedStyle(el)[prop]
      return v || fallback
    }
    const root = getComputedStyle(document.documentElement)
    const v = (name) => root.getPropertyValue(name).trim()
    return {
      '--brand-50': v('--brand-50'),
      '--brand-100': v('--brand-100'),
      '--brand-200': v('--brand-200'),
      '--brand-500': v('--brand-500'),
      '--brand-600': v('--brand-600'),
      '--brand-700': v('--brand-700'),
      '--paper': v('--paper'),
      '--ink': v('--ink'),
      '--muted': v('--muted'),
      '--line': v('--line'),
      '--line-strong': v('--line-strong'),
      '--accent-500': v('--accent-500'),
      '--ok-600': v('--ok-600'),
      bodyBg: get('body', 'backgroundColor'),
      sidebarBg: get('.sidebar', 'backgroundColor'),
      headerBg: get('.lp-header', 'backgroundColor'),
    }
  })
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const auth = await login()
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })

  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx.addInitScript(({ token, user, theme }) => {
      localStorage.setItem('englearn_token', token)
      localStorage.setItem('englearn_user', JSON.stringify(user))
      localStorage.setItem('engorace_theme', theme)
    }, { token: auth.token, user: auth.user, theme })

    const page = await ctx.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    console.log(`\n[${theme}] dashboard`)
    console.log(JSON.stringify(await probeColors(page), null, 2))
    await shoot(page, `${theme}-dashboard-main.png`)
    await page.locator('.app-shell').scrollIntoViewIfNeeded().catch(() => {})
    await ctx.close()
  }

  // Landing (light-only)
  const landingCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await landingCtx.addInitScript(() => localStorage.setItem('engorace_theme', 'dark'))
  const lp = await landingCtx.newPage()
  await lp.goto(BASE, { waitUntil: 'networkidle' })
  await lp.waitForSelector('.landing-page-wrapper')
  await lp.waitForTimeout(900)
  console.log('\n[landing, saved=dark]')
  console.log(JSON.stringify(await probeColors(lp), null, 2))
  await shoot(lp, 'landing-1440.png')
  await landingCtx.close()

  await browser.close()
}

main().catch((err) => { console.error(err); process.exit(1) })
