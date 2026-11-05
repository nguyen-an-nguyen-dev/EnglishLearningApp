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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(({ token, user }) => {
    localStorage.setItem('englearn_token', token)
    localStorage.setItem('englearn_user', JSON.stringify(user))
    localStorage.setItem('engorace_theme', 'light')
  }, { token: auth.token, user: auth.user })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.locator('.nav-item:has-text("Dịch Tài Liệu")').click()
  await page.waitForTimeout(800)
  const metrics = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height),
        scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
        overflowY: getComputedStyle(el).overflowY,
        flex: getComputedStyle(el).flex,
        minHeight: getComputedStyle(el).minHeight,
      }
    }
    return {
      win: { h: window.innerHeight, scrollY: window.scrollY, docH: document.documentElement.scrollHeight },
      layout: box('.learning-page-translate'),
      page: box('.translate-page'),
      desk: box('.translate-desk'),
      rail: box('.translate-rail'),
      head: box('.translate-rail-head'),
      pair: box('.translate-pair'),
      history: box('.translate-history'),
      list: box('.translate-history-list'),
      foot: box('.translate-rail-foot'),
      sheet: box('.translate-sheet'),
    }
  })
  console.log(JSON.stringify(metrics, null, 2))
  await ctx.close()
  await browser.close()
}

main().catch((err) => { console.error(err); process.exit(1) })
