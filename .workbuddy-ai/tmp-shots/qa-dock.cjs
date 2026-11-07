const { chromium } = require('playwright')
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'
;(async () => {
  const r = await fetch('http://localhost:3000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@test.com', password: '123456' }) })
  const auth = (await r.json()).data
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(({ auth }) => {
    localStorage.setItem('engorace_theme', 'light')
    localStorage.setItem('englearn_token', auth.token)
    localStorage.setItem('englearn_user', JSON.stringify(auth.user))
    sessionStorage.setItem('engorace_active_tab', 'study')
  }, { auth })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  const probe = await page.evaluate(() => {
    const dock = document.querySelector('.buddy-dock')
    const cs = getComputedStyle(dock)
    return {
      background: cs.backgroundColor,
      boxShadow: cs.boxShadow,
      border: cs.borderWidth,
      radius: cs.borderRadius,
    }
  })
  console.log(JSON.stringify(probe))
  await page.screenshot({ path: '.workbuddy-ai/tmp-shots/qa-hero3d/dock-corner.png', clip: { x: 1440 - 320, y: 900 - 200, width: 320, height: 200 } })
  await browser.close()
})()
