const { chromium } = require('playwright')

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

  for (const [width, height] of [[1440, 900], [1440, 768], [1280, 720]]) {
    const ctx = await browser.newContext({ viewport: { width, height } })
    await ctx.addInitScript(({ token, user }) => {
      localStorage.setItem('englearn_token', token)
      localStorage.setItem('englearn_user', JSON.stringify(user))
      localStorage.setItem('engorace_theme', 'light')
    }, { token: auth.token, user: auth.user })
    const page = await ctx.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    await page.locator('.nav-item:has-text("Dịch Tài Liệu")').click()
    await page.waitForTimeout(1000)
    const metrics = await page.evaluate(() => {
      const list = document.querySelector('.translate-history-list')
      const foot = document.querySelector('.translate-rail-foot')
      return {
        viewport: window.innerWidth + 'x' + window.innerHeight,
        items: document.querySelectorAll('.translate-history-item').length,
        page: document.querySelector('.translate-history-page-label')?.textContent?.trim() ?? null,
        listClient: list?.clientHeight ?? 0,
        listScroll: list?.scrollHeight ?? 0,
        listBottom: list ? Math.round(list.getBoundingClientRect().bottom) : null,
        footerBottom: foot ? Math.round(foot.getBoundingClientRect().bottom) : null,
        docHeight: document.documentElement.scrollHeight,
      }
    })
    console.log(metrics)
    await page.screenshot({ path: `../.workbuddy-ai/tmp-shots/dashboard-audit/light-${width}x${height}.png` })
    await ctx.close()
  }

  await browser.close()
}

main().catch((err) => { console.error(err); process.exit(1) })
