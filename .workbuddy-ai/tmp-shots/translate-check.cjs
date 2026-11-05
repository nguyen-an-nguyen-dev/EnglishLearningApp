const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const OUT = path.join(ROOT, '.workbuddy-ai/tmp-shots/dashboard-audit')
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
    await page.waitForTimeout(400)
    await page.locator('.nav-item:has-text("Dịch Tài Liệu")').click()
    await page.waitForTimeout(500)

    // Type a short sentence and submit with the button
    await page.locator('.translate-textarea').fill('English learning is fun and useful for everyone.')
    await page.waitForTimeout(200)
    await page.screenshot({ path: path.join(OUT, `${theme}-translate-filled.png`) })
    await page.locator('.translate-cta').click()
    await page.waitForTimeout(6000) // AI response wait
    await page.screenshot({ path: path.join(OUT, `${theme}-translate-result.png`) })

    // Click copy (clipboard may fail headless — button still exists)
    const copyBtn = page.locator('.translate-copy-btn')
    console.log('copy disabled?', await copyBtn.isDisabled())

    // Switch language direction
    await page.locator('.translate-swap').click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(OUT, `${theme}-translate-swapped.png`) })
    await ctx.close()
  }

  // Mobile 390
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
  await ctx.addInitScript(({ token, user }) => {
    localStorage.setItem('englearn_token', token)
    localStorage.setItem('englearn_user', JSON.stringify(user))
    localStorage.setItem('engorace_theme', 'dark')
  }, { token: auth.token, user: auth.user })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.locator('.mobile-nav button:has-text("Dịch")').click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(OUT, 'mobile-dark-translate.png'), fullPage: true })
  await ctx.close()

  await browser.close()
}

main().catch((err) => { console.error(err); process.exit(1) })
