const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const OUT = path.join(ROOT, '.workbuddy-ai/tmp-shots/dashboard-audit')
const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

const TABS = [
  { id: 'study', label: 'Học Tập' },
  { id: 'videos', label: 'Học qua Video' },
  { id: 'translate', label: 'Dịch Tài Liệu' },
  { id: 'compete', label: 'Thi Đua' },
  { id: 'rankings', label: 'Bảng Xếp Hạng' },
  { id: 'profile', label: 'Profile' },
]

async function login() {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: '123456' }),
  })
  return (await res.json()).data
}

const buttonInventory = () => `(() => {
  const groups = {}
  const elements = [...document.querySelectorAll('button, .lesson-primary-button, .lesson-secondary-button, .video-primary-btn, .video-ghost-btn, [role="button"]')]
  for (const el of elements) {
    const cs = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    const key = [cs.backgroundColor, cs.color, cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor, cs.borderRadius, cs.fontSize, cs.fontWeight].join(' | ')
    if (!groups[key]) groups[key] = { count: 0, labels: [] }
    const label = (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 42)
    groups[key].count += 1
    if (groups[key].labels.length < 4 && label) groups[key].labels.push(label)
  }
  return Object.entries(groups)
    .map(([key, v]) => ({ key, count: v.count, labels: v.labels }))
    .sort((a, b) => b.count - a.count)
})()`

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const auth = await login()
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })

  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
    await ctx.addInitScript(({ token, user, theme }) => {
      localStorage.setItem('englearn_token', token)
      localStorage.setItem('englearn_user', JSON.stringify(user))
      localStorage.setItem('engorace_theme', theme)
    }, { token: auth.token, user: auth.user, theme })

    const page = await ctx.newPage()
    for (const tab of TABS) {
      await page.goto(BASE, { waitUntil: 'networkidle' })
      await page.waitForTimeout(500)
      await page.locator(`.nav-item:has-text("${tab.label}")`).click()
      await page.waitForTimeout(700)
      await page.screenshot({ path: path.join(OUT, `${theme}-${tab.id}.png`) })
      const inv = await page.evaluate(buttonInventory())
      console.log(`\n===== [${theme}] ${tab.id} =====`)
      for (const row of inv) {
        console.log(`  ×${row.count}  ${row.key}`)
        console.log(`       ex: ${row.labels.join(' · ')}`)
      }
    }
    await ctx.close()
  }
  await browser.close()
}

main().catch((err) => { console.error(err); process.exit(1) })
