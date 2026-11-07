/**
 * Empty-state QA: stub the admin endpoints with zero rows so the composed
 * empty states render, then screenshot the lessons and videos panels.
 *
 * Run: node .workbuddy-ai/tmp-shots/qa-admin-empty.cjs
 */
const { chromium } = require('playwright')
const path = require('path')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const OUT = path.join(ROOT, '.workbuddy-ai/tmp-shots/qa-admin')
const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function main() {
  const login = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: '123456' }),
  })
  const auth = (await login.json()).data

  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await context.addInitScript(({ auth, theme }) => {
      localStorage.setItem('engorace_theme', theme)
      localStorage.setItem('englearn_token', auth.token)
      localStorage.setItem('englearn_user', JSON.stringify(auth.user))
      sessionStorage.setItem('engorace_active_tab', 'admin')
    }, { auth, theme })

    const page = await context.newPage()
    await page.route('**/api/admin/content', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { stages: [] } }),
    }))
    await page.route('**/api/admin/videos', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { videos: [] } }),
    }))

    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: path.join(OUT, `empty-lessons-${theme}.png`) })

    await page.getByRole('tab', { name: /Video chung|Shared videos/ }).click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(OUT, `empty-videos-${theme}.png`) })

    const probe = await page.evaluate(() => ({
      emptyBlocks: document.querySelectorAll('.admin-empty').length,
      emptyCtas: document.querySelectorAll('.admin-empty .admin-link-btn').length,
      pageErrors: 0,
    }))
    console.log(theme, JSON.stringify(probe))
    await context.close()
  }
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
