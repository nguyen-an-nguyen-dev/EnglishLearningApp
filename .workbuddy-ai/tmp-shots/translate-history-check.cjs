const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const OUT = path.join(ROOT, '.workbuddy-ai/tmp-shots/dashboard-audit')
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

const rects = () => `(() => {
  const pick = (selector) => [...document.querySelectorAll(selector)].map((el) => {
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x * 10) / 10, w: Math.round(r.width * 10) / 10 }
  })
  return {
    labels: pick('.translate-pair-label'),
    langs: pick('.translate-pair-lang'),
    swap: pick('.translate-swap'),
  }
})()`

const historyMetrics = () => `(() => {
  const list = document.querySelector('.translate-history-list')
  const foot = document.querySelector('.translate-rail-foot')
  return {
    items: document.querySelectorAll('.translate-history-item').length,
    page: document.querySelector('.translate-history-page-label')?.textContent?.trim() ?? null,
    scrollHeight: list?.scrollHeight ?? 0,
    clientHeight: list?.clientHeight ?? 0,
    overflowY: list ? getComputedStyle(list).overflowY : null,
    footerBottom: foot ? Math.round(foot.getBoundingClientRect().bottom) : null,
    docHeight: document.documentElement.scrollHeight,
    winHeight: window.innerHeight,
  }
})()`

async function openTranslate(browser, auth, theme) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(({ token, user, theme }) => {
    localStorage.setItem('englearn_token', token)
    localStorage.setItem('englearn_user', JSON.stringify(user))
    localStorage.setItem('engorace_theme', theme)
  }, { token: auth.token, user: auth.user, theme })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.locator('.nav-item:has-text("Dịch Tài Liệu")').click()
  await page.waitForTimeout(1200)
  return { ctx, page }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const auth = await login()
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })

  for (const theme of ['light', 'dark']) {
    const { ctx, page } = await openTranslate(browser, auth, theme)
    console.log(`[${theme}] history`, await page.evaluate(historyMetrics()))
    await page.screenshot({ path: path.join(OUT, `${theme}-history-page1.png`) })

    const pageLabel = await page.locator('.translate-history-page-label').textContent().catch(() => null)
    if (pageLabel && pageLabel.includes('/') && !pageLabel.startsWith('1/')) {
      throw new Error(`history should start on page 1, got ${pageLabel}`)
    }
    const next = page.locator('.translate-history-page').nth(1)
    if (await next.isEnabled().catch(() => false)) {
      const firstBefore = await page.locator('.translate-history-text').first().innerText()
      await next.click()
      await page.waitForTimeout(250)
      const firstAfter = await page.locator('.translate-history-text').first().innerText()
      console.log(`[${theme}] page2`, await page.evaluate(historyMetrics()), 'changed:', firstBefore !== firstAfter)
      await page.screenshot({ path: path.join(OUT, `${theme}-history-page2.png`) })
      await page.locator('.translate-history-page').first().click()
      await page.waitForTimeout(200)
    }

    const before = await page.evaluate(rects())
    await page.locator('.translate-swap').click()
    await page.mouse.move(0, 0)
    await page.waitForTimeout(300)
    const after = await page.evaluate(rects())
    console.log(`[${theme}] swap stable:`, JSON.stringify(before) === JSON.stringify(after))

    if (theme === 'dark') {
      await page.locator('.translate-textarea').fill('The cat is sleeping on the sofa.')
      await page.locator('.translate-cta').click()
      await page.waitForSelector('.translate-result-text', { timeout: 60000 })
      await page.waitForTimeout(400)
      console.log('copy label:', (await page.locator('.translate-copy-btn').innerText()).trim())
      console.log('history after translate:', await page.evaluate(historyMetrics()))
      await page.screenshot({ path: path.join(OUT, 'dark-translate-history-result.png') })

      await page.locator('.translate-history-item').first().click()
      await page.waitForTimeout(400)
      console.log('restored input:', await page.locator('.translate-textarea').inputValue())

      await page.locator('.translate-tab:has-text("Tệp .txt")').click()
      await page.waitForTimeout(300)
      console.log('dropzone small count:', await page.locator('.translate-dropzone small').count())
      console.log('file hint count:', await page.locator('.translate-form-foot .translate-hint').count())
      console.log('file counter text:', JSON.stringify((await page.locator('.translate-counter').innerText()).trim()))
      await page.screenshot({ path: path.join(OUT, 'dark-translate-file-clean.png') })
    }

    await ctx.close()
  }

  // mobile light: history should be hidden
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
  await mctx.addInitScript(({ token, user }) => {
    localStorage.setItem('englearn_token', token)
    localStorage.setItem('englearn_user', JSON.stringify(user))
    localStorage.setItem('engorace_theme', 'light')
  }, { token: auth.token, user: auth.user })
  const mpage = await mctx.newPage()
  await mpage.goto(BASE, { waitUntil: 'networkidle' })
  await mpage.waitForTimeout(400)
  await mpage.locator('.mobile-nav button:has-text("Dịch")').click()
  await mpage.waitForTimeout(700)
  console.log('mobile history visible:', await mpage.locator('.translate-history').isVisible())
  await mpage.screenshot({ path: path.join(OUT, 'mobile-light-clean.png'), fullPage: true })
  await mctx.close()

  await browser.close()
}

main().catch((err) => { console.error(err); process.exit(1) })
