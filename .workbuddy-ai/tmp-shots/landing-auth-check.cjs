const { chromium } = require('playwright')
const path = require('path')

const OUT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/.workbuddy-ai/tmp-shots/dashboard-audit'
const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function main() {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: '123456' }),
  })
  const { data: auth } = await res.json()

  const browser = await chromium.launch({ headless: true, executablePath: CHROME })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(({ token, user }) => {
    localStorage.setItem('englearn_token', token)
    localStorage.setItem('englearn_user', JSON.stringify(user))
  }, auth)
  const page = await ctx.newPage()
  // The authenticated landing is shown when navigating directly with a token; SPA routing stays on dashboard by default.
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  console.log('url:', page.url())
  await page.screenshot({ path: path.join(OUT, 'landing-auth-header.png'), clip: { x: 0, y: 0, width: 1440, height: 320 } })
  await ctx.close()
  await browser.close()
}

main().catch((err) => { console.error(err); process.exit(1) })
