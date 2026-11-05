const { chromium } = require('C:/Users/ADMIN/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright')
const path = require('path')

const BASE = 'http://localhost:5173/'
const OUT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/.workbuddy-ai/tmp-shots/dashboard-audit'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function main() {
  const login = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: '123456' }),
  })
  const { data: auth } = await login.json()
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })

  for (const c of [
    { name: 'light-1440', theme: 'light', width: 1440, height: 900 },
    { name: 'dark-390', theme: 'dark', width: 390, height: 844 },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: c.width, height: c.height } })
    await ctx.addInitScript(({ token, user, theme }) => {
      localStorage.setItem('englearn_token', token)
      localStorage.setItem('englearn_user', JSON.stringify(user))
      localStorage.setItem('engorace_theme', theme)
      sessionStorage.setItem('engorace_active_tab', 'study')
    }, { token: auth.token, user: auth.user, theme: c.theme })
    const page = await ctx.newPage()
    const errors = []
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
    page.on('pageerror', (err) => errors.push('pageerror: ' + err.message))
    await page.goto(BASE, { waitUntil: 'networkidle' })

    // 1. A fresh question through a quick chip really reaches the AI.
    await page.locator('.buddy-launcher').click()
    await page.locator('.buddy-panel').waitFor()
    const before = await page.locator('.buddy-bubble.is-ai').count()
    await page.locator('.buddy-chip').first().click()
    await page.locator('.buddy-bubble.is-typing').waitFor({ state: 'visible', timeout: 10000 })
    await page.locator('.buddy-bubble.is-typing').waitFor({ state: 'hidden', timeout: 30000 })
    const after = await page.locator('.buddy-bubble.is-ai').count()
    const lastReply = (await page.locator('.buddy-bubble.is-ai').last().innerText()).slice(0, 180)
    if (after <= before) throw new Error('No AI bubble was added')
    await page.screenshot({ path: path.join(OUT, `buddy-flow-reply-${c.name}.png`) })

    // 2. A plan step deep-links straight into the lesson.
    await page.locator('.buddy-tabs button', { hasText: 'Kế hoạch' }).click()
    await page.locator('.buddy-step').first().waitFor()
    await page.locator('.buddy-step-action').first().click()
    await page.locator('.lesson-player').waitFor({ timeout: 15000 })
    const lessonTitle = (await page.locator('.lesson-player h1, .lesson-player h2').first().innerText().catch(() => '')).slice(0, 80)
    const panelClosed = await page.locator('.buddy-panel').count() === 0
    await page.screenshot({ path: path.join(OUT, `buddy-flow-lesson-${c.name}.png`) })

    console.log(c.name, JSON.stringify({ lastReply, lessonTitle, panelClosed, errors: errors.length ? errors : 'NONE' }))
    await ctx.close()
  }
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
