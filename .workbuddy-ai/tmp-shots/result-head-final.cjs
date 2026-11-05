const { chromium } = require('C:/Users/ADMIN/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright')
const path = require('path')

const BASE = 'http://localhost:5173/'
const OUT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/.workbuddy-ai/tmp-shots/dashboard-audit'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function main() {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: '123456' }),
  })
  const { data: auth } = await res.json()
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })

  const cases = [
    { name: 'light-1440', theme: 'light', width: 1440, height: 900 },
    { name: 'dark-1440', theme: 'dark', width: 1440, height: 900 },
    { name: 'light-390', theme: 'light', width: 390, height: 844 },
    { name: 'dark-390', theme: 'dark', width: 390, height: 844 },
  ]

  for (const c of cases) {
    const ctx = await browser.newContext({ viewport: { width: c.width, height: c.height } })
    await ctx.addInitScript(({ token, user, theme }) => {
      localStorage.setItem('englearn_token', token)
      localStorage.setItem('englearn_user', JSON.stringify(user))
      localStorage.setItem('engorace_theme', theme)
      sessionStorage.setItem('engorace_active_tab', 'translate')
    }, { token: auth.token, user: auth.user, theme: c.theme })
    const page = await ctx.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle' })
    const nav = page.locator('.nav-item:has-text("Dịch Tài Liệu")')
    if (await nav.isVisible()) await nav.click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(OUT, `final-${c.name}.png`) })

    const probe = await page.evaluate(() => {
      const heads = [...document.querySelectorAll('.translate-block-head')].map((h) => ({
        text: h.innerText.replace(/\n/g, ' | '),
        children: [...h.children].map((el) => {
          const r = el.getBoundingClientRect()
          const s = getComputedStyle(el)
          return { cls: el.className, x: Math.round(r.x), w: Math.round(r.width),
            h: Math.round(r.height), bg: s.backgroundColor }
        }),
      }))
      const empty = document.querySelector('.translate-empty')
      const result = document.querySelector('.translate-block.is-result')
      return {
        heads,
        emptyBefore: empty ? getComputedStyle(empty, '::before').content : null,
        resultBorderTop: getComputedStyle(result).borderTopWidth,
        directionText: document.body.innerText.includes('Tiếng Anh → Tiếng Việt'),
        headRight: Math.round(document.querySelector('.translate-block.is-result .translate-block-head').getBoundingClientRect().right),
        copyRight: Math.round(document.querySelector('.translate-copy-btn').getBoundingClientRect().right),
        sheetRight: Math.round(document.querySelector('.translate-sheet').getBoundingClientRect().right),
      }
    })
    console.log(c.name, JSON.stringify(probe))
    await ctx.close()
  }
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
