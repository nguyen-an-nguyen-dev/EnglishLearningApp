const { chromium } = require('playwright')
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'
;(async () => {
  const res = await fetch('http://localhost:3000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@test.com', password: '123456' }) })
  const auth = (await res.json()).data
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  for (const width of [390, 360]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 } })
    await ctx.addInitScript(({ auth }) => {
      localStorage.setItem('engorace_theme', 'dark')
      localStorage.setItem('englearn_token', auth.token)
      localStorage.setItem('englearn_user', JSON.stringify(auth.user))
      sessionStorage.setItem('engorace_active_tab', 'admin')
    }, { auth })
    const page = await ctx.newPage()
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    const probe = await page.evaluate(() => {
      const nav = document.querySelector('.mobile-nav')
      const rect = nav.getBoundingClientRect()
      const buttons = Array.from(nav.querySelectorAll('button')).map((b) => {
        const r = b.getBoundingClientRect()
        return { text: b.textContent.trim(), right: Math.round(r.right), left: Math.round(r.left), height: Math.round(r.height) }
      })
      return { navHeight: Math.round(rect.height), navTop: Math.round(rect.top), viewport: innerWidth, buttons, scrollWidth: document.documentElement.scrollWidth }
    })
    console.log(width, JSON.stringify(probe))
    await page.screenshot({ path: `.workbuddy-ai/tmp-shots/qa-admin/mobile-nav-${width}.png`, clip: { x: 0, y: 700, width, height: 144 } })
    await ctx.close()
  }
  await browser.close()
})()
