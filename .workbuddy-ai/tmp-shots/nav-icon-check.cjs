const { chromium } = require('playwright')
const path = require('path')

const OUT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/.workbuddy-ai/tmp-shots/dashboard-audit'
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

async function main() {
  const auth = await login()
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })

  // desktop: sidebar active translate icon, both themes
  for (const theme of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx.addInitScript(({ token, user, theme }) => {
      localStorage.setItem('englearn_token', token)
      localStorage.setItem('englearn_user', JSON.stringify(user))
      localStorage.setItem('engorace_theme', theme)
    }, { token: auth.token, user: auth.user, theme })
    const page = await ctx.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.locator('.nav-item:has-text("Dịch Tài Liệu")').click()
    await page.waitForTimeout(700)
    const weightInfo = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.nav-item')].find((el) => el.textContent?.includes('Dịch Tài Liệu'))
      const svg = btn?.querySelector('svg')
      return {
        active: btn?.className,
        paths: svg?.querySelectorAll('path').length,
        fill: svg?.getAttribute('fill'),
        stroke: svg?.getAttribute('stroke'),
        fontWeight: getComputedStyle(btn).fontWeight,
      }
    })
    console.log(theme, 'nav icon:', JSON.stringify(weightInfo))
    await page.screenshot({ path: path.join(OUT, `${theme}-nav-translate-active.png`), clip: { x: 0, y: 0, width: 296, height: 420 } })
    await ctx.close()
  }

  // mobile: bottom nav active translate icon, both themes
  for (const theme of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
    await ctx.addInitScript(({ token, user, theme }) => {
      localStorage.setItem('englearn_token', token)
      localStorage.setItem('englearn_user', JSON.stringify(user))
      localStorage.setItem('engorace_theme', theme)
    }, { token: auth.token, user: auth.user, theme })
    const page = await ctx.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.locator('.mobile-nav button:has-text("Dịch")').click()
    await page.waitForTimeout(700)
    const weightInfo = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.mobile-nav button')].find((el) => el.textContent?.includes('Dịch'))
      const svg = btn?.querySelector('svg')
      return { fill: svg?.getAttribute('fill'), stroke: svg?.getAttribute('stroke') }
    })
    console.log(theme, 'mobile icon:', JSON.stringify(weightInfo))
    await page.screenshot({ path: path.join(OUT, `${theme}-mobile-nav-active.png`), clip: { x: 0, y: 844 - 90, width: 390, height: 90 } })
    await ctx.close()
  }

  await browser.close()
}

main().catch((err) => { console.error(err); process.exit(1) })
