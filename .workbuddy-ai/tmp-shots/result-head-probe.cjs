const { chromium } = require('C:/Users/ADMIN/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright')
const fs = require('fs')
const path = require('path')

const DIR = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/.workbuddy-ai/tmp-shots/dashboard-audit'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'
const BASE = 'http://localhost:5173/'

async function crop(browser, name, box) {
  const png = fs.readFileSync(path.join(DIR, name)).toString('base64')
  const page = await browser.newPage({ viewport: { width: 1300, height: 400 } })
  await page.setContent(`<img id="i" src="data:image/png;base64,${png}">`)
  await page.locator('#i').evaluate((img) => img.decode())
  const data = await page.evaluate(({ box }) => {
    const img = document.getElementById('i')
    const c = document.createElement('canvas')
    c.width = (box[2] - box[0]) * 2
    c.height = (box[3] - box[1]) * 2
    const ctx = c.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, box[0], box[1], box[2] - box[0], box[3] - box[1], 0, 0, c.width, c.height)
    return c.toDataURL('image/png')
  }, { box })
  fs.writeFileSync(path.join(DIR, 'crop-' + name), Buffer.from(data.split(',')[1], 'base64'))
  await page.close()
}

async function probe(browser) {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: '123456' }),
  })
  const { data: auth } = await res.json()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(({ token, user }) => {
    localStorage.setItem('englearn_token', token)
    localStorage.setItem('englearn_user', JSON.stringify(user))
    localStorage.setItem('engorace_theme', 'light')
  }, { token: auth.token, user: auth.user })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.locator('.nav-item:has-text("Dịch Tài Liệu")').click()
  await page.waitForTimeout(800)
  const info = await page.evaluate(() => {
    const out = { heads: [], lines: [] }
    document.querySelectorAll('.translate-block-head').forEach((head) => {
      const r = head.getBoundingClientRect()
      out.heads.push({
        block: head.parentElement.className,
        y: Math.round(r.y), x: Math.round(r.x), width: Math.round(r.width),
        text: head.innerText.replace(/\n/g, ' | '),
        children: [...head.children].map((el) => {
          const b = el.getBoundingClientRect()
          return {
            cls: el.className, text: el.textContent.trim().slice(0, 40),
            x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height),
            bg: getComputedStyle(el).backgroundColor,
            borderTop: getComputedStyle(el).borderTopWidth,
            borderBottom: getComputedStyle(el).borderBottomWidth,
          }
        }),
      })
    })
    const result = document.querySelector('.translate-block.is-result')
    const empty = document.querySelector('.translate-empty')
    const ta = document.querySelector('.translate-textarea')
    const body = document.querySelector('.translate-sheet-body')
    for (const [key, el] of Object.entries({ result, empty, ta, body })) {
      if (!el) continue
      const s = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      out.lines.push({ key, y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width),
        borderTop: s.borderTopWidth + ' ' + s.borderTopColor,
        borderBottom: s.borderBottomWidth + ' ' + s.borderBottomColor,
        bgImage: s.backgroundImage.slice(0, 90),
        before: s.getPropertyValue('content'),
      })
    }
    if (empty) {
      const s = getComputedStyle(empty, '::before')
      out.lines.push({ key: 'empty::before', content: s.content, w: s.width, h: s.height, bg: s.backgroundColor })
    }
    return out
  })
  console.log(JSON.stringify(info, null, 2))
  await ctx.close()
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })
  await crop(browser, 'light-result-head.png', [600, 360, 1440, 580])
  await crop(browser, 'light-translate-result.png', [600, 360, 1440, 580])
  try { await probe(browser) } catch (e) { console.log('PROBE FAILED:', e.message) }
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
