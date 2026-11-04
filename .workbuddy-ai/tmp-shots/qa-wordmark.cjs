const { chromium } = require('playwright')

const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

const PROBE = `(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel)
    return el ? getComputedStyle(el).color : null
  }
  const root = getComputedStyle(document.documentElement)
  return {
    eng: pick('.brand-eng') || pick('.lp-brand-eng'),
    o: pick('.brand-o') || pick('.lp-brand-o'),
    race: pick('.brand-race') || pick('.lp-brand-race'),
    paper: root.getPropertyValue('--paper').trim(),
    shell: root.getPropertyValue('--shell-bg').trim(),
    videoMono: document.documentElement.dataset.videoMono || null,
  }
})()`

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
  const cases = [
    { name: 'landing', tab: null, theme: 'light' },
    { name: 'landing', tab: null, theme: 'dark' },
    { name: 'dashboard', tab: 'study', theme: 'light' },
    { name: 'dashboard', tab: 'study', theme: 'dark' },
    { name: 'videos', tab: 'videos', theme: 'light' },
    { name: 'videos', tab: 'videos', theme: 'dark' },
    { name: 'notebook', tab: 'videos', theme: 'light', notebook: true },
    { name: 'practice', tab: 'videos', theme: 'light', practice: true },
    { name: 'arena', tab: 'compete', theme: 'light' },
    { name: 'arena', tab: 'compete', theme: 'dark' },
  ]
  for (const c of cases) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx.addInitScript(({ auth, theme, tab }) => {
      localStorage.setItem('engorace_theme', theme)
      if (tab) {
        localStorage.setItem('englearn_token', auth.token)
        localStorage.setItem('englearn_user', JSON.stringify(auth.user))
        sessionStorage.setItem('engorace_active_tab', tab)
      }
    }, { auth, theme: c.theme, tab: c.tab })
    const page = await ctx.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(700)
    if (c.notebook) {
      await page.locator('.video-notebook-link').first().click({ timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(400)
    }
    if (c.practice) {
      await page.locator('.video-thumb').first().click({ timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(1400)
    }
    const probe = await page.evaluate(PROBE)
    console.log(`${c.name.padEnd(10)} ${c.theme.padEnd(5)}`, JSON.stringify(probe))
    await ctx.close()
  }
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
