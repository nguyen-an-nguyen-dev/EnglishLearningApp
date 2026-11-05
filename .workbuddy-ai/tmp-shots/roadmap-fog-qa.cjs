const { chromium } = require('C:/Users/ADMIN/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright')
const path = require('path')

const BASE = 'http://localhost:5173/'
const OUT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/.workbuddy-ai/tmp-shots/dashboard-audit'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

const CASES = [
  { name: 'new-learner', email: 'temp@engorace.dev', password: 'temp123456', expectDense: true, theme: 'light', width: 1440, height: 900 },
  { name: 'new-learner-dark', email: 'temp@engorace.dev', password: 'temp123456', expectDense: true, theme: 'dark', width: 1440, height: 900 },
  { name: 'new-learner-390', email: 'temp@engorace.dev', password: 'temp123456', expectDense: true, theme: 'light', width: 390, height: 844 },
  { name: 'advanced-learner', email: 'test@test.com', password: '123456', expectDense: false, theme: 'light', width: 1440, height: 900 },
]

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })
  for (const c of CASES) {
    const login = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: c.email, password: c.password }),
    })
    const { data: auth } = await login.json()
    const ctx = await browser.newContext({ viewport: { width: c.width, height: c.height } })
    await ctx.addInitScript(({ token, user, theme }) => {
      localStorage.setItem('englearn_token', token)
      localStorage.setItem('englearn_user', JSON.stringify(user))
      localStorage.setItem('engorace_theme', theme)
      sessionStorage.setItem('engorace_active_tab', 'study')
    }, { token: auth.token, user: auth.user, theme: c.theme })
    const page = await ctx.newPage()
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.locator('.roadmap-map').waitFor({ timeout: 20000 })
    await page.waitForTimeout(700)

    const probe = await page.evaluate(() => {
      const fog = document.querySelector('.roadmap-fog')
      const label = document.querySelector('.roadmap-fog-label')
      const scroll = document.querySelector('.roadmap-scroll')
      return {
        fogGroups: document.querySelectorAll('.roadmap-fog').length,
        fogRects: document.querySelectorAll('.roadmap-fog rect').length,
        foggyScenes: document.querySelectorAll('.roadmap-stage-scene.is-foggy').length,
        mistyScenes: document.querySelectorAll('.roadmap-stage-scene.is-misty').length,
        wisps: document.querySelectorAll('.roadmap-fog-wisp').length,
        label: label ? label.textContent : null,
        fogPointerEvents: fog ? getComputedStyle(fog).pointerEvents : null,
        scrollHeight: scroll ? scroll.scrollHeight : null,
        clientHeight: scroll ? scroll.clientHeight : null,
        markers: document.querySelectorAll('.roadmap-marker').length,
        docOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      }
    })

    await page.screenshot({ path: path.join(OUT, `fog-top-${c.name}.png`) })
    if (probe.scrollHeight > probe.clientHeight) {
      await page.evaluate(() => {
        const scroll = document.querySelector('.roadmap-scroll')
        if (scroll) scroll.scrollTop = Math.min(scroll.scrollHeight - scroll.clientHeight, 620)
      })
      await page.waitForTimeout(450)
      await page.screenshot({ path: path.join(OUT, `fog-region-${c.name}.png`) })
    }

    const ok = probe.fogGroups === 1 && (probe.foggyScenes > 0) === c.expectDense
      && (c.expectDense ? probe.fogRects === 2 : probe.fogRects === 1)
    console.log(c.name, ok ? 'MATCH' : 'MISMATCH', JSON.stringify(probe), 'errors', errors.length ? errors : 'NONE')
    await ctx.close()
  }
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
