const { chromium } = require('C:/Users/ADMIN/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright')

const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function sample(page) {
  return page.evaluate(() => {
    const de = document.documentElement
    const tab = document.querySelector('.tab-view-container')
    return {
      scrollHeight: de.scrollHeight,
      clientHeight: de.clientHeight,
      overflow: de.scrollHeight - de.clientHeight,
      animation: tab ? getComputedStyle(tab).animationName : null,
      transform: tab ? getComputedStyle(tab).transform : null,
    }
  })
}

async function main() {
  const login = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: '123456' }),
  })
  const { data: auth } = await login.json()
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })

  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx.addInitScript(({ token, user, theme }) => {
      localStorage.setItem('englearn_token', token)
      localStorage.setItem('englearn_user', JSON.stringify(user))
      localStorage.setItem('engorace_theme', theme)
      sessionStorage.setItem('engorace_active_tab', 'study')
    }, { token: auth.token, user: auth.user, theme })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(BASE, { waitUntil: 'networkidle' })

    await page.locator('.nav-item:has-text("Dịch Tài Liệu")').click()
    const rows = []
    for (const delay of [0, 40, 80, 120, 180, 260, 400]) {
      if (delay) await page.waitForTimeout(delay)
      rows.push({ delay, ...(await sample(page)) })
    }
    console.log(theme, JSON.stringify(rows))
    console.log(theme, 'maxOverflow', Math.max(...rows.map((r) => r.overflow)), 'errors', errors.length ? errors : 'NONE')
    await ctx.close()
  }

  // A normal tab keeps the original slide-in animation.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(({ token, user }) => {
    localStorage.setItem('englearn_token', token)
    localStorage.setItem('englearn_user', JSON.stringify(user))
    sessionStorage.setItem('engorace_active_tab', 'study')
  }, { token: auth.token, user: auth.user })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  console.log('study animation', (await sample(page)).animation)
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
