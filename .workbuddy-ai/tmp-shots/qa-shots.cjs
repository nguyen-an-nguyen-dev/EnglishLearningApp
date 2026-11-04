const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const OUT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/.workbuddy-ai/tmp-shots/qa'
const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function login() {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: '123456' }),
  })
  const json = await res.json()
  return json.data
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const auth = await login()
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })

  const cases = [
    { name: 'landing', tab: null, width: 1440, height: 900, theme: 'light' },
    { name: 'landing', tab: null, width: 1440, height: 900, theme: 'dark' },
    { name: 'landing', tab: null, width: 390, height: 844, theme: 'light' },
    { name: 'dashboard', tab: 'study', width: 1440, height: 900, theme: 'light' },
    { name: 'dashboard', tab: 'study', width: 1440, height: 900, theme: 'dark' },
    { name: 'dashboard', tab: 'study', width: 390, height: 844, theme: 'light' },
    { name: 'videos', tab: 'videos', width: 1440, height: 900, theme: 'light' },
    { name: 'videos', tab: 'videos', width: 1440, height: 900, theme: 'dark' },
    { name: 'arena', tab: 'compete', width: 1440, height: 900, theme: 'light' },
    { name: 'arena', tab: 'compete', width: 1440, height: 900, theme: 'dark' },
  ]

  for (const c of cases) {
    const context = await browser.newContext({
      viewport: { width: c.width, height: c.height },
      deviceScaleFactor: 1,
    })
    await context.addInitScript(({ auth, theme, tab }) => {
      localStorage.setItem('engorace_theme', theme)
      // No credentials for the landing cases: an authenticated session goes
      // straight to the dashboard.
      if (tab) {
        localStorage.setItem('englearn_token', auth.token)
        localStorage.setItem('englearn_user', JSON.stringify(auth.user))
        sessionStorage.setItem('engorace_active_tab', tab)
      }
    }, { auth, theme: c.theme, tab: c.tab })
    const page = await context.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(900)
    if (!c.tab) {
      await page.evaluate(() => {
        // Landing view is forced by clicking the brand on the dashboard.
        document.documentElement.scrollTop = 0
      })
    }
    const file = path.join(OUT, `${c.name}-${c.theme}-${c.width}.png`)
    await page.screenshot({ path: file, fullPage: false })
    console.log('shot', path.basename(file))
    await context.close()
  }
  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
