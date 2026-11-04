const { chromium } = require('playwright')
const path = require('path')

const OUT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/.workbuddy-ai/tmp-shots/qa-final'
const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function login() {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: '123456' }),
  })
  return (await res.json()).data
}

async function main() {
  const auth = await login()
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx.addInitScript(({ auth, theme }) => {
      localStorage.setItem('engorace_theme', theme)
      localStorage.setItem('englearn_token', auth.token)
      localStorage.setItem('englearn_user', JSON.stringify(auth.user))
      sessionStorage.setItem('engorace_active_tab', 'videos')
    }, { auth, theme })
    const page = await ctx.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(900)
    await page.locator('.video-thumb').first().click({ timeout: 10000 })
    await page.waitForTimeout(1500)
    await page.locator('.practice-cover').first().click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(1000)
    const state = await page.evaluate(`(() => {
      const veil = document.querySelector('.practice-listening-veil')
      const cover = document.querySelector('.practice-cover')
      const cs = veil ? getComputedStyle(veil) : null
      return {
        veilCount: document.querySelectorAll('.practice-listening-veil').length,
        coverCount: document.querySelectorAll('.practice-cover').length,
        veilZ: cs ? cs.zIndex : null,
        veilBackdrop: cs ? (cs.backdropFilter || cs.webkitBackdropFilter) : null,
        veilLabel: veil ? veil.textContent.trim() : null,
        veilVisible: veil ? veil.getBoundingClientRect().width > 0 : false,
      }
    })()`)
    const file = path.join(OUT, `practice-${theme}-1440.png`)
    await page.screenshot({ path: file })
    console.log(theme, JSON.stringify(state))
    await ctx.close()
  }
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
