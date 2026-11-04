const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const OUT = path.join(ROOT, '.workbuddy-ai/tmp-shots/qa-landing-pale-cyan')
const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'
const CANVAS = 'rgb(228, 247, 255)'

async function login() {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: '123456' }),
  })
  return (await res.json()).data
}

const probe = `(() => {
  const bg = (sel) => {
    const el = document.querySelector(sel)
    return el ? getComputedStyle(el).backgroundColor : null
  }
  const footer = document.querySelector('.lp-footer')
  const cta = document.querySelector('.lp-final-cta')
  return {
    theme: document.documentElement.dataset.theme,
    colorScheme: document.documentElement.style.colorScheme,
    lpActive: document.documentElement.classList.contains('lp-active'),
    body: bg('body'),
    wrapper: bg('.landing-page-wrapper'),
    header: bg('.lp-header'),
    heroBand: bg('.lp-band-hero'),
    modesBand: bg('.lp-band-modes'),
    conclusionBand: bg('.lp-band-conclusion'),
    footer: bg('.lp-footer'),
    footerWidth: footer ? Math.round(footer.getBoundingClientRect().width) : null,
    viewportWidth: window.innerWidth,
    footerInsideContentColumn: footer ? !!footer.closest('.lp-conclusion-content') : null,
    cta: cta ? getComputedStyle(cta).backgroundColor : null,
    ctaTitle: cta ? getComputedStyle(cta.querySelector('h2')).color : null,
    heroTitle: bg('.lp-hero') === null ? null : getComputedStyle(document.querySelector('.lp-hero h1')).color,
    toggles: document.querySelectorAll('.theme-toggle').length,
    tagline: document.querySelector('.lp-footer-tagline')?.textContent || null,
  }
})()`

async function shoot(page, name, fullPage = false) {
  await page.screenshot({ path: path.join(OUT, name), fullPage })
  console.log('  saved', name)
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const auth = await login()
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })

  for (const saved of ['dark', 'light']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await context.addInitScript((theme) => {
      localStorage.setItem('engorace_theme', theme)
    }, saved)
    const page = await context.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForSelector('.landing-page-wrapper')
    await page.waitForTimeout(400)

    const p = await page.evaluate(probe)
    console.log(`\n[saved theme = ${saved}] @1440`)
    console.log(JSON.stringify(p, null, 2))

    await shoot(page, `landing-${saved}-1440-top.png`)
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto'
      window.scrollTo(0, document.body.scrollHeight)
    })
    await page.waitForTimeout(350)
    await shoot(page, `landing-${saved}-1440-footer.png`)
    if (saved === 'dark') await shoot(page, 'landing-dark-1440-full.png', true)

    await context.close()
  }

  // Mobile
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 })
  await mobile.addInitScript(() => localStorage.setItem('engorace_theme', 'dark'))
  const mp = await mobile.newPage()
  await mp.goto(BASE, { waitUntil: 'networkidle' })
  await mp.waitForSelector('.landing-page-wrapper')
  await mp.waitForTimeout(400)
  console.log('\n[saved theme = dark] @390')
  console.log(JSON.stringify(await mp.evaluate(probe), null, 2))
  await shoot(mp, 'landing-dark-390-top.png')
  await mp.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo(0, document.body.scrollHeight)
  })
  await mp.waitForTimeout(350)
  await shoot(mp, 'landing-dark-390-footer.png')
  await mobile.close()

  // Dashboard must get the saved dark theme back after leaving the landing.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(({ token, user, theme }) => {
    localStorage.setItem('englearn_token', token)
    localStorage.setItem('englearn_user', JSON.stringify(user))
    localStorage.setItem('engorace_theme', theme)
  }, { token: auth.token, user: auth.user, theme: 'dark' })
  const dp = await ctx.newPage()
  await dp.goto(BASE, { waitUntil: 'networkidle' })
  await dp.waitForTimeout(800)
  const dash = await dp.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    lpActive: document.documentElement.classList.contains('lp-active'),
    body: getComputedStyle(document.body).backgroundColor,
    shell: !!document.querySelector('.app-shell'),
    themeToggle: document.querySelectorAll('.theme-toggle').length,
  }))
  console.log('\n[dashboard after login, saved dark]')
  console.log(JSON.stringify(dash, null, 2))
  await ctx.close()

  await browser.close()

  const ok = true
  console.log('\nprobe done. files in', OUT)
}

main().catch((err) => { console.error(err); process.exit(1) })
