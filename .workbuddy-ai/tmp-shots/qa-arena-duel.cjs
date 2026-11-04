const { chromium } = require('playwright')
const path = require('path')

const OUT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/.workbuddy-ai/tmp-shots/qa-final'
const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function login(email, password) {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return (await res.json()).data
}

async function main() {
  const [a, b] = await Promise.all([
    login('test@test.com', '123456'),
    login('temp@engorace.dev', 'temp123456'),
  ])
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const contexts = []
  const pages = []
  for (const [i, auth] of [a, b].entries()) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx.addInitScript(({ auth, theme }) => {
      localStorage.setItem('engorace_theme', theme)
      localStorage.setItem('englearn_token', auth.token)
      localStorage.setItem('englearn_user', JSON.stringify(auth.user))
      sessionStorage.setItem('engorace_active_tab', 'compete')
    }, { auth, theme: i === 0 ? 'light' : 'dark' })
    contexts.push(ctx)
    const page = await ctx.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(900)
    pages.push(page)
  }

  await Promise.all(pages.map((p) => p.locator('.arena-cta').first().click({ timeout: 10000 }).catch((e) => console.log('click err', e.message))))
  await pages[0].locator('.arena-frame.has-photo img').first().waitFor({ timeout: 20000 }).catch((e) => console.log('no photo frame', e.message))
  await pages[0].waitForTimeout(700)

  const state = await pages[0].evaluate(`(() => {
    const frame = document.querySelector('.arena-frame.has-photo')
    const img = frame?.querySelector('img')
    return {
      frameCount: document.querySelectorAll('.arena-frame.has-photo').length,
      src: img?.getAttribute('src') || null,
      naturalWidth: img?.naturalWidth || 0,
      complete: img?.complete || false,
    }
  })()`)
  const file = path.join(OUT, 'arena-duel-with-image.png')
  await pages[0].screenshot({ path: file })
  console.log('duel', JSON.stringify(state))

  for (const ctx of contexts) await ctx.close()
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
