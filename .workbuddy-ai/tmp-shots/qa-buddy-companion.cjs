/**
 * Companion QA: the buddy must behave like a companion, not a chatbot.
 *  - the car speaks one specific line, not a greeting
 *  - the panel lists nudges built from real rows
 *  - a nudge CTA moves the app AND circles the declared element
 *  - "ask" returns one answer card (no thread), with the reminder offer
 *  - browser notifications are requested from a visible control
 *
 * Run: node .workbuddy-ai/tmp-shots/qa-buddy-companion.cjs
 */
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const OUT = path.join(ROOT, '.workbuddy-ai/tmp-shots/qa-buddy')
const BASE = 'http://localhost:5173/'
const API = 'http://localhost:3000'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: '123456' }),
  })
  return (await res.json()).data
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const auth = await login()
  const report = {}

  const browser = await chromium.launch({ executablePath: CHROME, headless: true })

  for (const viewport of [{ name: '1440', width: 1440, height: 900 }, { name: '390', width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
    await context.addInitScript(({ auth }) => {
      localStorage.setItem('engorace_theme', 'light')
      localStorage.setItem('englearn_token', auth.token)
      localStorage.setItem('englearn_user', JSON.stringify(auth.user))
      sessionStorage.setItem('engorace_active_tab', 'study')
    }, { auth })

    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1800)

    const entry = { pageErrors }
    entry.dock = await page.locator('.buddy-dock').count()
    entry.bubble = (await page.locator('.buddy-nudge-bubble').first().textContent().catch(() => ''))?.trim() ?? ''
    entry.noChatThread = await page.locator('.buddy-thread, .buddy-tabs, .buddy-compose').count()

    await page.screenshot({ path: path.join(OUT, `bubble-${viewport.name}.png`) })

    // Open the panel.
    await page.locator('.buddy-dock').click()
    await page.waitForTimeout(700)
    entry.panel = await page.locator('.buddy-panel').count()
    entry.nudgeCards = await page.locator('.buddy-nudge').count()
    entry.nudgeTitles = await page.locator('.buddy-nudge h4').allTextContents()
    entry.panelOverflow = await page.evaluate(() => {
      const panel = document.querySelector('.buddy-panel')
      if (!panel) return null
      const box = panel.getBoundingClientRect()
      return {
        scrollWidth: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        insideViewport: box.left >= -1 && box.right <= window.innerWidth + 1,
      }
    })
    await page.screenshot({ path: path.join(OUT, `panel-${viewport.name}.png`) })

    // Follow the nudge that declares a highlight token, and check it draws.
    const lessonNudge = page.locator('.buddy-nudge', { hasText: 'Bài đang mở' }).first()
    const cta = (await lessonNudge.count())
      ? lessonNudge.locator('.buddy-solid-btn').first()
      : page.locator('.buddy-nudge .buddy-solid-btn').first()
    if (await cta.count()) {
      entry.firstCta = (await cta.textContent())?.trim() ?? ''
      await cta.click()
      await page.waitForTimeout(1600)
      entry.panelClosedAfterNav = (await page.locator('.buddy-panel').count()) === 0
      entry.spotlights = await page.locator('.buddy-spotlight').count()
      entry.activeTabAfterNav = await page.evaluate(() => {
        const active = document.querySelector('.nav-item-active')
        return active?.textContent?.trim() ?? null
      })
      await page.screenshot({ path: path.join(OUT, `spotlight-${viewport.name}.png`) })
      await page.waitForTimeout(4200)
      entry.spotlightAutoCleared = (await page.locator('.buddy-spotlight').count()) === 0
    }

    // Ask one question: one answer card, no thread.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    await page.locator('.buddy-dock').click({ timeout: 10000 })
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /Hỏi nhanh|Quick ask/ }).first().click()
    await page.waitForTimeout(400)
    entry.suggestionChips = await page.locator('.buddy-suggestion').count()
    await page.locator('.buddy-ask-form input').fill('20 phút nữa nhắc mình ôn sổ từ')
    await page.locator('.buddy-send-btn').click()
    await page.waitForTimeout(9000)
    entry.answerCard = await page.locator('.buddy-answer').count()
    entry.answerText = (await page.locator('.buddy-answer-body').textContent().catch(() => ''))?.trim() ?? ''
    entry.answerThreadBubbles = await page.locator('.buddy-bubble').count()
    entry.reminderOffer = await page.locator('.buddy-reminder-offer').count()
    await page.screenshot({ path: path.join(OUT, `answer-${viewport.name}.png`) })

    if (entry.reminderOffer) {
      await page.locator('.buddy-reminder-offer .buddy-solid-btn').click()
      await page.waitForTimeout(1200)
      entry.reminderSaved = (await page.locator('.buddy-ok').textContent().catch(() => ''))?.trim() ?? ''
      await page.screenshot({ path: path.join(OUT, `reminder-saved-${viewport.name}.png`) })
    }

    // Reminders list: back to home first, then the reminders control.
    await page.locator('.buddy-panel-head .buddy-icon-btn').first().click({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(500)
    await page.locator('.buddy-cta-row .buddy-ghost-btn').nth(1).click({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(800)
    entry.reminderRows = await page.locator('.buddy-reminder-row').count()
    await page.screenshot({ path: path.join(OUT, `reminders-${viewport.name}.png`) })

    report[viewport.name] = entry
    console.log(viewport.name, JSON.stringify(entry))
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
