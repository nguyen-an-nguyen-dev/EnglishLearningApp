const { chromium } = require('playwright')
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'
;(async () => {
  const res = await fetch('http://localhost:3000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@test.com', password: '123456' }) })
  const auth = (await res.json()).data
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(({ auth }) => {
    localStorage.setItem('engorace_theme', 'light')
    localStorage.setItem('englearn_token', auth.token)
    localStorage.setItem('englearn_user', JSON.stringify(auth.user))
    sessionStorage.setItem('engorace_active_tab', 'admin')
  }, { auth })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const loaded = await page.evaluate(() => Array.from(document.querySelectorAll('.admin-column-head')).map((h) => Math.round(h.getBoundingClientRect().height)))
  await page.route('**/api/admin/content', (route) => new Promise(() => {}))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const loading = await page.evaluate(() => Array.from(document.querySelectorAll('.admin-column-head')).map((h) => Math.round(h.getBoundingClientRect().height)))
  console.log(JSON.stringify({ loaded, loading }))
  await browser.close()
})()
