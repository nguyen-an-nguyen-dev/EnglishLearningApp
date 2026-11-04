const { chromium } = require('playwright')

const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'
const WIDTHS = [1440, 1100, 960, 900, 820, 760, 730, 721, 720, 560, 390]

async function login(email, password) {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return (await res.json()).data
}

const PROBE = `(() => {
  const rep = document.querySelector('.arena-reply')
  const row = document.querySelector('.arena-answer')
  const btn = document.querySelector('.arena-answer .arena-cta')
  const inp = document.querySelector('.arena-answer input')
  if (!rep || !row || !btn) return null
  const r = (e) => { const b = e.getBoundingClientRect(); return { l: +b.left.toFixed(1), r: +b.right.toFixed(1), w: +b.width.toFixed(1) } }
  const cs = getComputedStyle(rep)
  return {
    reply: r(rep), row: r(row), btn: r(btn), input: r(inp),
    overflowPx: +(btn.getBoundingClientRect().right - rep.getBoundingClientRect().right).toFixed(1),
    paddingRight: cs.paddingRight,
    flexDirection: getComputedStyle(row).flexDirection,
    viewport: innerWidth,
  }
})()`

async function main() {
  const [a, b] = await Promise.all([
    login('test@test.com', '123456'),
    login('temp@engorace.dev', 'temp123456'),
  ])
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  for (const width of WIDTHS) {
    const ctxs = []
    const pages = []
    for (const [i, auth] of [a, b].entries()) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } })
      await ctx.addInitScript(({ auth, theme }) => {
        localStorage.setItem('engorace_theme', theme)
        localStorage.setItem('englearn_token', auth.token)
        localStorage.setItem('englearn_user', JSON.stringify(auth.user))
        sessionStorage.setItem('engorace_active_tab', 'compete')
      }, { auth, theme: i === 0 ? 'light' : 'dark' })
      ctxs.push(ctx)
      const p = await ctx.newPage()
      await p.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
      await p.waitForTimeout(700)
      pages.push(p)
    }
    await Promise.all(pages.map((p) => p.locator('.arena-cta').first().click({ timeout: 10000 }).catch(() => {})))
    await pages[0].locator('.arena-answer .arena-cta').first().waitFor({ timeout: 15000 }).catch(() => {})
    await pages[0].waitForTimeout(300)
    const probe = await pages[0].evaluate(PROBE)
    console.log(String(width).padStart(5), probe ? `overflow=${probe.overflowPx} dir=${probe.flexDirection} reply=${probe.reply.w} row=${probe.row.w} btn=${probe.btn.w} padR=${probe.paddingRight}` : 'NO MATCH')
    for (const c of ctxs) await c.close()
  }
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
