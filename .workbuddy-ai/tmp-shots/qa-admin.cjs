/**
 * Admin console QA: who can see it, how it lays out at 1440/390 in both themes,
 * and whether the lesson tree + question dialog overflow their cards.
 *
 * Run: node .workbuddy-ai/tmp-shots/qa-admin.cjs
 */
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const OUT = path.join(ROOT, '.workbuddy-ai/tmp-shots/qa-admin')
const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function login(email, password) {
  const response = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await response.json()
  if (!body.success) throw new Error(`login failed for ${email}: ${body.message}`)
  return body.data
}

const overflowProbe = `(() => {
  const rows = Array.from(document.querySelectorAll('.admin-row'))
  const bad = []
  for (const row of rows) {
    const box = row.getBoundingClientRect()
    for (const button of row.querySelectorAll('button')) {
      const b = button.getBoundingClientRect()
      if (b.width > 0 && (b.right > box.right + 1 || b.left < box.left - 1)) {
        bad.push({ text: (button.textContent || '').trim().slice(0, 24), right: Math.round(b.right), rowRight: Math.round(box.right) })
      }
    }
  }
  return {
    rows: rows.length,
    bad,
    pageScrollWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }
})()`

const cases = [
  { name: 'lessons-light-1440', who: 'admin', tab: 'admin', theme: 'light', width: 1440, height: 900 },
  { name: 'lessons-dark-1440', who: 'admin', tab: 'admin', theme: 'dark', width: 1440, height: 900 },
  { name: 'lessons-light-390', who: 'admin', tab: 'admin', theme: 'light', width: 390, height: 844 },
  { name: 'lessons-dark-390', who: 'admin', tab: 'admin', theme: 'dark', width: 390, height: 844 },
  { name: 'videos-light-1440', who: 'admin', tab: 'admin', theme: 'light', width: 1440, height: 900, videos: true },
  { name: 'videos-dark-1440', who: 'admin', tab: 'admin', theme: 'dark', width: 1440, height: 900, videos: true },
  { name: 'videos-light-390', who: 'admin', tab: 'admin', theme: 'light', width: 390, height: 844, videos: true },
  { name: 'videos-dark-390', who: 'admin', tab: 'admin', theme: 'dark', width: 390, height: 844, videos: true },
  { name: 'learner-admin-tab-1440', who: 'learner', tab: 'admin', theme: 'light', width: 1440, height: 900 },
]

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const auth = {
    admin: await login('test@test.com', '123456'),
    learner: await login('temp@engorace.dev', 'temp123456'),
  }

  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const report = []

  for (const c of cases) {
    const account = auth[c.who]
    const context = await browser.newContext({ viewport: { width: c.width, height: c.height } })
    await context.addInitScript(({ account, theme, tab }) => {
      localStorage.setItem('engorace_theme', theme)
      localStorage.setItem('englearn_token', account.token)
      localStorage.setItem('englearn_user', JSON.stringify(account.user))
      sessionStorage.setItem('engorace_active_tab', tab)
    }, { account, theme: c.theme, tab: c.tab })

    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(1200)

    const extras = {}

    if (c.videos) {
      await page.getByRole('tab', { name: /Video chung|Shared videos/ }).click({ timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(900)
      if (c.width === 1440) {
        await page.locator('.admin-row').first().locator('.admin-icon-btn').nth(2).click({ timeout: 8000 }).catch(() => {})
        await page.waitForTimeout(500)
        extras.videoEditDialog = await page.evaluate(() => {
          const dialog = document.querySelector('dialog.admin-dialog[open]')
          if (!dialog) return null
          const box = dialog.getBoundingClientRect()
          return {
            centeredX: Math.abs(box.left + box.width / 2 - window.innerWidth / 2) < 2,
            left: Math.round(box.left),
            top: Math.round(box.top),
            width: Math.round(box.width),
            sections: dialog.querySelectorAll('.admin-section').length,
          }
        })
        await page.screenshot({ path: path.join(OUT, `${c.name}-video-dialog.png`) })
        await page.keyboard.press('Escape')
        await page.waitForTimeout(400)
        await page.getByRole('button', { name: /Thêm video chung|Add shared video/ }).click({ timeout: 8000 }).catch(() => {})
        await page.waitForTimeout(500)
        extras.importDialog = await page.evaluate(() => {
          const dialog = document.querySelector('dialog.admin-dialog[open]')
          if (!dialog) return null
          const box = dialog.getBoundingClientRect()
          return {
            centeredX: Math.abs(box.left + box.width / 2 - window.innerWidth / 2) < 2,
            focused: document.activeElement?.getAttribute('type') ?? document.activeElement?.tagName ?? null,
          }
        })
        await page.screenshot({ path: path.join(OUT, `${c.name}-import-dialog.png`) })
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
      }
    } else if (c.who === 'admin') {
      // Open a lesson so the question column has content to measure.
      const lesson = page.locator('.admin-row.is-lesson .admin-row-select').first()
      if (await lesson.count()) {
        await lesson.click({ timeout: 8000 }).catch(() => {})
        await page.waitForTimeout(900)
      }
      if (c.width === 1440 && c.theme === 'light') {
        await page.locator('.admin-column').nth(0).locator('.admin-column-head .admin-icon-btn').click({ timeout: 8000 }).catch(() => {})
        await page.waitForTimeout(500)
        extras.stageDialog = await page.evaluate(() => {
          const dialog = document.querySelector('dialog.admin-dialog[open]')
          if (!dialog) return null
          const box = dialog.getBoundingClientRect()
          return {
            centeredX: Math.abs(box.left + box.width / 2 - window.innerWidth / 2) < 2,
            centeredY: Math.abs(box.top + box.height / 2 - window.innerHeight / 2) < 2,
            width: Math.round(box.width),
            themeOptions: dialog.querySelectorAll('.admin-theme-option').length,
            activeTheme: dialog.querySelector('.admin-theme-option.is-active')?.textContent?.trim() ?? null,
          }
        })
        await page.locator('.admin-theme-option').nth(2).click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(300)
        await page.screenshot({ path: path.join(OUT, `${c.name}-stage-dialog.png`) })
        await page.keyboard.press('Escape')
        await page.waitForTimeout(400)
      }
    }

    const probe = await page.evaluate(overflowProbe)
    Object.assign(extras, {
      navAdmin: await page.locator('.nav-item', { hasText: /Quản trị|Admin/ }).count(),
      adminPage: await page.locator('.admin-page').count(),
      studyMap: await page.locator('.study-map').count(),
      columns: await page.locator('.admin-column').count(),
      questions: await page.locator('.admin-row.is-question').count(),
      switchTabs: await page.locator('.admin-switch-option').count(),
      ...probe,
    })

    if (c.who === 'admin' && !c.videos) {
      const addQuestion = page.getByRole('button', { name: /Thêm câu hỏi|Add question/ }).first()
      if (await addQuestion.isEnabled().catch(() => false)) {
        await addQuestion.click({ timeout: 8000 }).catch(() => {})
        await page.waitForTimeout(600)
        extras.dialogOpen = await page.locator('dialog.admin-dialog[open]').count()
        extras.dialogFields = await page.locator('dialog.admin-dialog[open] .admin-field').count()
        extras.dialogScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
        await page.screenshot({ path: path.join(OUT, `${c.name}-dialog.png`) })
        await page.keyboard.press('Escape')
        await page.waitForTimeout(400)
      }
    }

    await page.screenshot({ path: path.join(OUT, `${c.name}.png`) })
    report.push({ case: c.name, theme: c.theme, width: c.width, ...extras, pageErrors })
    console.log('shot', c.name, JSON.stringify(extras))
    await context.close()
  }

  await browser.close()
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log('wrote', path.join(OUT, 'report.json'))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
