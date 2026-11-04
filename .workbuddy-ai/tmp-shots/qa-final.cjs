const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const OUT = path.join(ROOT, '.workbuddy-ai/tmp-shots/qa-final')
const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function login(email, password) {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return (await res.json()).data
}

const wordmarkJs = `(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel)
    return el ? getComputedStyle(el).color : null
  }
  const eng = pick('.brand-eng') || pick('.lp-brand-eng')
  const o = pick('.brand-o') || pick('.lp-brand-o')
  const race = pick('.brand-race') || pick('.lp-brand-race')
  const root = getComputedStyle(document.documentElement)
  return {
    eng, o, race,
    paper: root.getPropertyValue('--paper').trim(),
    shell: root.getPropertyValue('--shell-bg').trim(),
    videoMono: document.documentElement.dataset.videoMono || null,
  }
})()`

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const auth = await login('test@test.com', '123456')
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const report = []

  const cases = [
    { name: 'landing-light-1440', tab: null, theme: 'light', width: 1440, height: 900 },
    { name: 'landing-dark-1440', tab: null, theme: 'dark', width: 1440, height: 900 },
    { name: 'landing-light-390', tab: null, theme: 'light', width: 390, height: 844 },
    { name: 'dashboard-light-1440', tab: 'study', theme: 'light', width: 1440, height: 900, wordmark: true },
    { name: 'dashboard-dark-1440', tab: 'study', theme: 'dark', width: 1440, height: 900, wordmark: true },
    { name: 'dashboard-light-390', tab: 'study', theme: 'light', width: 390, height: 844 },
    { name: 'dashboard-dark-390', tab: 'study', theme: 'dark', width: 390, height: 844 },
    { name: 'videos-light-1440', tab: 'videos', theme: 'light', width: 1440, height: 900, wordmark: true },
    { name: 'videos-dark-1440', tab: 'videos', theme: 'dark', width: 1440, height: 900, wordmark: true },
    { name: 'notebook-light-1440', tab: 'videos', theme: 'light', width: 1440, height: 900, notebook: true, wordmark: true },
    { name: 'practice-light-1440', tab: 'videos', theme: 'light', width: 1440, height: 900, practice: true, wordmark: true },
    { name: 'practice-dark-1440', tab: 'videos', theme: 'dark', width: 1440, height: 900, practice: true, wordmark: true },
    { name: 'arena-light-1440', tab: 'compete', theme: 'light', width: 1440, height: 900, wordmark: true },
    { name: 'arena-dark-1440', tab: 'compete', theme: 'dark', width: 1440, height: 900, wordmark: true },
  ]

  for (const c of cases) {
    const context = await browser.newContext({
      viewport: { width: c.width, height: c.height },
      deviceScaleFactor: 1,
    })
    await context.addInitScript(({ auth, theme, tab }) => {
      localStorage.setItem('engorace_theme', theme)
      if (tab) {
        localStorage.setItem('englearn_token', auth.token)
        localStorage.setItem('englearn_user', JSON.stringify(auth.user))
        sessionStorage.setItem('engorace_active_tab', tab)
      }
    }, { auth, theme: c.theme, tab: c.tab })
    const page = await context.newPage()
    const consoleErrors = []
    page.on('pageerror', (e) => consoleErrors.push(e.message))
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(1000)

    let extra = {}
    if (c.wordmark) extra = (await page.evaluate(wordmarkJs)) || {}
    if (c.notebook) {
      await page.locator('.video-notebook-link').first().click({ timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(600)
    }
    if (c.practice) {
      await page.locator('.video-thumb').first().click({ timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(1600)
      const cover = page.locator('.practice-cover')
      if (await cover.count()) await cover.first().click({ timeout: 5000 }).catch(() => {})
      else await page.locator('.practice-head-replay').first().click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(900)
      extra.veil = await page.locator('.practice-listening-veil').count()
      extra.veilLabel = (await page.locator('.practice-veil-label').first().textContent().catch(() => null)) || null
      extra.wordmark = await page.evaluate(wordmarkJs)
    }
    if (c.tab === 'compete') {
      extra.practiceCardVisible = await page.getByText('Tự luyện phản xạ với 12 câu').count()
    }

    const file = path.join(OUT, `${c.name}.png`)
    await page.screenshot({ path: file, fullPage: false })
    report.push({ case: c.name, ...extra, pageErrors: consoleErrors })
    console.log('shot', c.name, JSON.stringify(extra))
    await context.close()
  }

  // All 100 arena photos must be served by the dev server / built static dir.
  const sample = ['apple.jpg', 'tenacity.jpg', 'borrow.jpg', 'knowledge.jpg', 'travel.jpg', 'early.jpg']
  const assetCheck = {}
  for (const f of sample) {
    const res = await fetch(`${BASE}arena/${f}`)
    assetCheck[f] = { status: res.status, bytes: (await res.arrayBuffer()).byteLength }
  }
  console.log('assets', JSON.stringify(assetCheck))

  await browser.close()
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ report, assetCheck }, null, 2))
  console.log('wrote report.json')
}

main().catch((e) => { console.error(e); process.exit(1) })
