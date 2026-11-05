const { chromium } = require('C:/Users/ADMIN/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright')
const path = require('path')

const BASE = 'http://localhost:5173/'
const OUT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/.workbuddy-ai/tmp-shots/dashboard-audit'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function main() {
  const login = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: '123456' }),
  })
  const { data: auth } = await login.json()
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(({ token, user }) => {
    localStorage.setItem('englearn_token', token)
    localStorage.setItem('englearn_user', JSON.stringify(user))
    localStorage.setItem('engorace_theme', 'light')
    sessionStorage.setItem('engorace_active_tab', 'study')
  }, { token: auth.token, user: auth.user })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  await page.goto(BASE, { waitUntil: 'networkidle' })

  // Shared motion system: one easing family, one idle rhythm everywhere.
  const motion = await page.evaluate(() => {
    const read = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const s = getComputedStyle(el)
      return { sel, animation: s.animationName, duration: s.animationDuration, easing: s.animationTimingFunction, transition: s.transitionDuration }
    }
    return ['.buddy-breathe', '.buddy-launcher-shadow', '.buddy-launcher-bubble', '.buddy-launcher-car'].map(read)
  })
  console.log('motion tokens', JSON.stringify(motion))

  await page.locator('.buddy-launcher').click()
  await page.locator('.buddy-panel').waitFor()
  const openAnimation = await page.locator('.buddy-panel').evaluate((el) => getComputedStyle(el).animationName)
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT, 'buddy-motion-open-light-1440.png') })

  // Close button: out animation runs, then the panel is really gone.
  await page.locator('.buddy-close').click()
  const closingClass = await page.locator('.buddy-panel').evaluate((el) => getComputedStyle(el).animationName)
  await page.locator('.buddy-panel').waitFor({ state: 'detached', timeout: 3000 })
  console.log('close', JSON.stringify({ openAnimation, closingClass, detached: true }))

  // Reopening must not keep the closing state.
  await page.locator('.buddy-launcher').click()
  await page.locator('.buddy-panel').waitFor()
  const reopened = await page.locator('.buddy-panel').evaluate((el) => ({
    cls: el.className,
    animation: getComputedStyle(el).animationName,
    opacity: getComputedStyle(el).opacity,
  }))
  console.log('reopen', JSON.stringify(reopened))

  // Escape closes through the same path.
  await page.keyboard.press('Escape')
  await page.locator('.buddy-panel').waitFor({ state: 'detached', timeout: 3000 })
  console.log('escape close OK')

  // Reduced motion removes every loop and entrance.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reduced = await page.evaluate(() => {
    const bubble = document.querySelector('.buddy-launcher-bubble')
    const bob = document.querySelector('.buddy-breathe')
    return {
      bubbleTransition: bubble ? getComputedStyle(bubble).transitionDuration : null,
      bobAnimation: bob ? getComputedStyle(bob).animationName : null,
    }
  })
  console.log('reduced motion', JSON.stringify(reduced))

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.locator('.buddy-launcher').click()
  await page.locator('.buddy-tabs button', { hasText: 'Kế hoạch' }).click()
  await page.locator('.buddy-step').first().waitFor()
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(OUT, 'buddy-motion-plan-light-1440.png') })
  console.log('errors', errors.length ? errors : 'NONE')
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
