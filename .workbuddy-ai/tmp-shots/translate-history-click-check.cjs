const { chromium } = require('playwright')

const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function main() {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: '123456' }),
  })
  const { data: auth } = await res.json()

  const browser = await chromium.launch({ headless: true, executablePath: CHROME })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('console: ' + msg.text())
  })
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message))

  await ctx.addInitScript(({ token, user }) => {
    localStorage.setItem('englearn_token', token)
    localStorage.setItem('englearn_user', JSON.stringify(user))
    localStorage.setItem('engorace_theme', 'light')
  }, { token: auth.token, user: auth.user })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.locator('.nav-item:has-text("Dịch Tài Liệu")').click()
  await page.waitForTimeout(1200)

  const pages = await page.locator('.translate-history-page').count()
  console.log('history items page1:', await page.locator('.translate-history-item').count())
  console.log('pager present:', pages > 0)

  for (let idx = 0; idx < await page.locator('.translate-history-item').count(); idx += 1) {
    const before = await page.evaluate(() => ({
      listOk: Boolean(document.querySelector('.translate-history-list')),
      count: document.querySelectorAll('.translate-history-item').length,
    }))
    await page.locator('.translate-history-item').nth(idx).click()
    await page.waitForTimeout(600)
    const after = await page.evaluate(() => ({
      listOk: Boolean(document.querySelector('.translate-history-list')),
      count: document.querySelectorAll('.translate-history-item').length,
      input: document.querySelector('.translate-textarea')?.value?.slice(0, 40),
      errorText: document.querySelector('.translate-error')?.textContent ?? null,
    }))
    console.log(`click[${idx}]`, JSON.stringify({ before, after }))
  }

  // page 2 if any
  const page2 = page.locator('.translate-history-page').nth(1)
  if (await page2.isVisible().catch(() => false)) {
    await page2.click()
    await page.waitForTimeout(300)
    for (let idx = 0; idx < await page.locator('.translate-history-item').count(); idx += 1) {
      await page.locator('.translate-history-item').nth(idx).click()
      await page.waitForTimeout(500)
      const after = await page.evaluate(() => ({
        count: document.querySelectorAll('.translate-history-item').length,
        input: document.querySelector('.translate-textarea')?.value?.slice(0, 40),
        errorText: document.querySelector('.translate-error')?.textContent ?? null,
      }))
      console.log(`page2 click[${idx}]`, JSON.stringify(after))
    }
  }

  console.log('console errors:', errors.length ? errors : 'none')
  await ctx.close()
  await browser.close()
}

main().catch((err) => { console.error(err); process.exit(1) })
