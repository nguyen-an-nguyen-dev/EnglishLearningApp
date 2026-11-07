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
  await page.waitForTimeout(800)
  const info = await page.evaluate(() => {
    const nav = document.querySelector('.sidebar-nav')
    const items = Array.from(nav.children).map((el) => ({
      text: el.textContent.trim(),
      rect: el.getBoundingClientRect().toJSON(),
      borders: getComputedStyle(el).borderTopWidth + '/' + getComputedStyle(el).borderTopColor,
    }))
    return { navRect: nav.getBoundingClientRect().toJSON(), items }
  })
  console.log(JSON.stringify(info, null, 1))
  await page.screenshot({ path: '.workbuddy-ai/tmp-shots/qa-admin/sidebar-check.png', clip: { x: 0, y: 0, width: 280, height: 620 } })
  await browser.close()
})()
