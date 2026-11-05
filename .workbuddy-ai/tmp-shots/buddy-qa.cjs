const { chromium } = require('C:/Users/ADMIN/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright')
const fs = require('fs')
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
  const report = []

  for (const c of [
    { name: 'light-1440', theme: 'light', width: 1440, height: 900 },
    { name: 'dark-1440', theme: 'dark', width: 1440, height: 900 },
    { name: 'light-390', theme: 'light', width: 390, height: 844 },
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
    const consoleErrors = []
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
    page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message))
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(OUT, `buddy-closed-${c.name}.png`) })

    await page.locator('.buddy-launcher').click()
    await page.locator('.buddy-panel').waitFor()
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(OUT, `buddy-chat-${c.name}.png`) })

    await page.locator('.buddy-tabs button', { hasText: 'Kế hoạch' }).click()
    await page.locator('.buddy-step').first().waitFor({ timeout: 20000 })
    await page.screenshot({ path: path.join(OUT, `buddy-plan-${c.name}.png`) })
    const steps = await page.locator('.buddy-step').count()
    const note = (await page.locator('.buddy-plan-note').innerText().catch(() => '')).slice(0, 150)

    const beforeReply = await page.locator('.buddy-bubble.is-ai').count()
    await page.locator('.buddy-plan-foot button').nth(1).click()
    await page.locator('.buddy-bubble.is-typing').waitFor({ state: 'visible', timeout: 15000 })
    await page.locator('.buddy-bubble.is-typing').waitFor({ state: 'hidden', timeout: 30000 })
    await page.waitForFunction((n) => document.querySelectorAll('.buddy-bubble.is-ai').length > n, beforeReply)
    await page.waitForTimeout(450)
    await page.screenshot({ path: path.join(OUT, `buddy-reply-${c.name}.png`) })
    const reply = (await page.locator('.buddy-bubble.is-ai').last().innerText()).slice(0, 160)

    const bounds = await page.evaluate(() => {
      const p = document.querySelector('.buddy-panel')
      const r = p.getBoundingClientRect()
      const nav = document.querySelector('.mobile-nav')
      const navRect = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect() : null
      return {
        left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom),
        viewport: [window.innerWidth, window.innerHeight],
        navTop: navRect ? Math.round(navRect.top) : null,
        overlapNav: navRect ? r.bottom > navRect.top : false,
      }
    })
    report.push({ case: c.name, steps, note, reply, bounds, consoleErrors })
    await ctx.close()
  }
  fs.writeFileSync(path.join(OUT, 'buddy-qa-report.json'), JSON.stringify(report, null, 2))
  for (const r of report) {
    console.log(r.case, 'steps=' + r.steps, 'reply=' + JSON.stringify(r.reply.slice(0, 70)))
    console.log('  bounds', JSON.stringify(r.bounds), 'errors', r.consoleErrors.length ? r.consoleErrors : 'NONE')
  }
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
