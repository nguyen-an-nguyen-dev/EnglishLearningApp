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
    sessionStorage.setItem('engorace_active_tab', 'videos')
  }, { auth })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.locator('.video-thumb').first().click()
  await page.waitForTimeout(1800)
  const probe = await page.evaluate(() => ({
    practice: document.querySelectorAll('.practice-practice').length,
    gate: document.querySelectorAll('.practice-gate').length,
    total: document.querySelector('.practice-player-index')?.textContent?.trim() ?? null,
    demoWrapper: document.querySelectorAll('.lp-demo').length,
  }))
  console.log(JSON.stringify({ ...probe, errors }))
  await page.screenshot({ path: '.workbuddy-ai/tmp-shots/qa-landing-demo/signedin-practice.png' })
  await browser.close()
})()
