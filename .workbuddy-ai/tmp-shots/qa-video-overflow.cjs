/**
 * QA for the latest 3 fixes:
 *  A) listening practice keeps the picture fully visible (no veil / blur / overscan),
 *     while the embed still asks YouTube for cc_load_policy=0 and the IFrame API
 *     strips captions at runtime.
 *  B) the "Trả lời" button never crosses the right edge of .arena-reply,
 *     measured across a wide range of viewport widths in light + dark.
 */
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const OUT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/.workbuddy-ai/tmp-shots/qa-final'
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

const VIDEO_PROBE = `(() => {
  const stage = document.querySelector('.practice-stage')
  const frame = document.querySelector('.practice-stage iframe')
  const veils = document.querySelectorAll('.practice-listening-veil, .practice-veil-icon, .practice-veil-label')
  const covers = document.querySelectorAll('.practice-cover')
  if (!stage) return { error: 'NO STAGE' }
  const s = stage.getBoundingClientRect()
  const cs = getComputedStyle(stage)
  const f = frame ? frame.getBoundingClientRect() : null
  const fc = frame ? getComputedStyle(frame) : null
  // Any element painted above the frame that covers the picture?
  const mid = document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2)
  return {
    hasFrame: Boolean(frame),
    frameSrcHasCcOff: frame ? /cc_load_policy=0/.test(frame.src || '') : false,
    frameCoverage: f ? +(((Math.min(f.right, s.right) - Math.max(f.left, s.left)) *
      (Math.min(f.bottom, s.bottom) - Math.max(f.top, s.top))) / (s.width * s.height)).toFixed(3) : 0,
    framePointerEvents: fc ? fc.pointerEvents : null,
    frameDisplay: fc ? fc.display : null,
    stageFilter: cs.filter,
    stageOpacity: cs.opacity,
    stageBackdrop: cs.backdropFilter || cs.webkitBackdropFilter,
    stageVisibility: cs.visibility,
    stageWidth: +s.width.toFixed(1),
    stageHeight: +s.height.toFixed(1),
    veilCount: veils.length,
    coverCount: covers.length,
    fallbackNoteCount: document.querySelectorAll('.practice-stage .video-fallback-note').length,
    frameHost: frame ? (() => { try { return new URL(frame.src).host } catch { return frame.src.slice(0, 60) } })() : null,
    blurElements: [...stage.querySelectorAll('*')].filter((el) => {
      const b = getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter
      return b && b !== 'none'
    }).length,
    centerTag: mid ? mid.tagName + '.' + (mid.className || '') : null,
  }
})()`

const OVERFLOW_PROBE = `(() => {
  const rep = document.querySelector('.arena-reply')
  const row = document.querySelector('.arena-answer')
  const btn = document.querySelector('.arena-answer .arena-cta')
  const inp = document.querySelector('.arena-answer input')
  const q = document.querySelector('.arena-question')
  if (!rep || !row || !btn || !inp) return null
  const r = (e) => { const b = e.getBoundingClientRect(); return { l: +b.left.toFixed(1), r: +b.right.toFixed(1), w: +b.width.toFixed(1) } }
  return {
    reply: r(rep), row: r(row), btn: r(btn), input: r(inp), question: q ? r(q) : null,
    buttonOverflowPx: +(btn.getBoundingClientRect().right - rep.getBoundingClientRect().right).toFixed(1),
    rowOverflowPx: +(row.getBoundingClientRect().right - rep.getBoundingClientRect().right).toFixed(1),
    cardOverflowPx: q ? +(rep.getBoundingClientRect().right - q.getBoundingClientRect().right).toFixed(1) : null,
    flexDirection: getComputedStyle(row).flexDirection,
    paddingRight: getComputedStyle(rep).paddingRight,
    viewport: innerWidth,
  }
})()`

async function newPage(browser, auth, theme, tab, width, height = 900) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  await ctx.addInitScript(({ auth, theme, tab }) => {
    localStorage.setItem('engorace_theme', theme)
    localStorage.setItem('englearn_token', auth.token)
    localStorage.setItem('englearn_user', JSON.stringify(auth.user))
    sessionStorage.setItem('engorace_active_tab', tab)
  }, { auth, theme, tab })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
  await page.waitForTimeout(700)
  return { ctx, page }
}

async function checkVideo(browser, auth) {
  const results = []
  for (const theme of ['light', 'dark']) {
    for (const width of [1440, 390]) {
      const { ctx, page } = await newPage(browser, auth, theme, 'videos', width, 900)
      await page.locator('.video-thumb').first().click({ timeout: 12000 })
      await page.waitForTimeout(1400)
      const before = await page.evaluate(VIDEO_PROBE)
      await page.locator('.practice-cover').first().click({ timeout: 6000 }).catch(() => {})
      await page.waitForTimeout(1200)
      const after = await page.evaluate(VIDEO_PROBE)
      const shot = path.join(OUT, `practice-visible-${theme}-${width}.png`)
      await page.screenshot({ path: shot })
      results.push({ theme, width, before, after, shot: path.basename(shot) })
      await ctx.close()
    }
  }
  return results
}

async function checkOverflow(browser, a, b) {
  const results = []
  for (const width of WIDTHS) {
    let probe = null
    let attempts = 0
    // Matchmaking is stateful: a previous duel can leave a socket in the queue,
    // so a width may need a second connection to get a fresh `game:question`.
    for (let attempt = 1; attempt <= 3 && !probe; attempt++) {
      attempts = attempt
      const p1 = await newPage(browser, a, 'light', 'compete', width)
      const p2 = await newPage(browser, b, 'dark', 'compete', width)
      await Promise.all([p1, p2].map((p) =>
        p.page.locator('.arena-cta').first().click({ timeout: 10000 }).catch(() => {})))
      await p1.page.locator('.arena-answer .arena-cta').first().waitFor({ timeout: 15000 }).catch(() => {})
      await p1.page.waitForTimeout(300)
      probe = await p1.page.evaluate(OVERFLOW_PROBE)
      if (probe && (width === 730 || width === 390)) {
        await p1.page.screenshot({ path: path.join(OUT, `arena-reply-light-${width}.png`) })
        await p2.page.screenshot({ path: path.join(OUT, `arena-reply-dark-${width}.png`) })
      }
      await p1.ctx.close()
      await p2.ctx.close()
      if (!probe) await new Promise((r) => setTimeout(r, 1200))
    }
    results.push({ width, probe, attempts })
  }
  return results
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const [a, b] = await Promise.all([
    login('test@test.com', '123456'),
    login('temp@engorace.dev', 'temp123456'),
  ])
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })

  const video = await checkVideo(browser, a)
  console.log('=== VIDEO ===')
  for (const r of video) console.log(`${r.theme}-${r.width}`, 'after', JSON.stringify(r.after))

  const overflow = await checkOverflow(browser, a, b)
  console.log('=== OVERFLOW ===')
  for (const r of overflow) {
    const p = r.probe
    console.log(String(r.width).padStart(5), p
      ? `btn=${p.buttonOverflowPx} row=${p.rowOverflowPx} card=${p.cardOverflowPx} dir=${p.flexDirection} reply=${p.reply.w} btnW=${p.btn.w} tries=${r.attempts}`
      : `NO MATCH (${r.attempts} tries)`)
  }

  const videoOk = video.every((r) =>
    r.after.hasFrame && r.after.frameCoverage > 0.95 && r.after.veilCount === 0 &&
    r.after.coverCount === 0 && r.after.blurElements === 0 &&
    r.after.stageFilter === 'none' && r.after.stageOpacity === '1' &&
    r.after.frameSrcHasCcOff)
  const overflowOk = overflow.every((r) => r.probe && r.probe.buttonOverflowPx <= 0 && r.probe.rowOverflowPx <= 0)
  console.log('=== RESULT ===')
  console.log('video visible + no veil:', videoOk ? 'PASS' : 'FAIL')
  console.log('button inside card:', overflowOk ? 'PASS' : 'FAIL')
  await browser.close()
  if (!videoOk || !overflowOk) process.exitCode = 1
}

main().catch((e) => { console.error(e); process.exit(1) })
