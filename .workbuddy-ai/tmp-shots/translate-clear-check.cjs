const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/backend'
require('dotenv').config({ path: path.join(ROOT, '.env') })

const OUT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/.workbuddy-ai/tmp-shots/dashboard-audit'
const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

const rows = [
  ['Good morning', 'Chào buổi sáng', 'en', 'vi'],
  ['How are you?', 'Bạn khỏe không?', 'en', 'vi'],
  ['I love learning English', 'Tôi thích học tiếng Anh', 'en', 'vi'],
  ['Thời tiết hôm nay đẹp quá', 'The weather is beautiful today', 'vi', 'en'],
  ['Học tiếng Anh mỗi ngày', 'Study English every day', 'vi', 'en'],
]

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const email = `ui-clear-${Date.now()}@example.test`
  const password = 'correct-horse-7'

  const register = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Clear Test', email, password }),
  })
  const registered = await register.json()
  if (!register.ok) throw new Error('register failed: ' + JSON.stringify(registered))
  const userId = registered.data.user.id

  const login = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const auth = (await login.json()).data
  if (!login.ok) throw new Error('login failed')

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'english_learning',
  })

  const seed = async () => {
    for (const [originalText, translatedText, sourceLanguage, targetLanguage] of rows) {
      await pool.execute(
        `INSERT INTO translations (user_id, file_name, original_text, source_language, translated_text, target_language, provider)
         VALUES (?, NULL, ?, ?, ?, ?, 'seed-test')`,
        [userId, originalText, sourceLanguage, translatedText, targetLanguage],
      )
    }
  }

  const browser = await chromium.launch({ headless: true, executablePath: CHROME })
  try {
    for (const theme of ['light', 'dark']) {
      await seed()
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await ctx.addInitScript(({ token, user, theme }) => {
        localStorage.setItem('englearn_token', token)
        localStorage.setItem('englearn_user', JSON.stringify(user))
        localStorage.setItem('engorace_theme', theme)
      }, { token: auth.token, user: { id: userId, name: 'Clear Test', email }, theme })
      const page = await ctx.newPage()
      await page.goto(BASE, { waitUntil: 'networkidle' })
      await page.waitForTimeout(400)
      await page.locator('.nav-item:has-text("Dịch Tài Liệu")').click()
      await page.waitForTimeout(1200)

      console.log(`[${theme}] clear button text:`, (await page.locator('.translate-history-clear').innerText()).trim())
      console.log(`[${theme}] history items:`, await page.locator('.translate-history-item').count())
      await page.locator('.translate-history-clear').click()
      await page.waitForTimeout(500)
      console.log(`[${theme}] dialog open:`, await page.locator('.translate-clear-dialog[open]').count())
      await page.screenshot({ path: path.join(OUT, `${theme}-clear-dialog.png`) })

      await page.locator('.translate-clear-cancel').click()
      await page.waitForTimeout(400)
      console.log(`[${theme}] after cancel, items:`, await page.locator('.translate-history-item').count())

      await page.locator('.translate-history-clear').click()
      await page.waitForTimeout(400)
      await page.locator('.translate-clear-confirm').click()
      await page.waitForTimeout(800)
      console.log(`[${theme}] after confirm, items:`, await page.locator('.translate-history-item').count())
      console.log(`[${theme}] empty state visible:`, await page.locator('.translate-history-empty').isVisible())
      console.log(`[${theme}] clear button still present:`, await page.locator('.translate-history-clear').count())
      await page.screenshot({ path: path.join(OUT, `${theme}-clear-after.png`) })

      await ctx.close()
    }
  } finally {
    await browser.close()
    await pool.execute('DELETE FROM translations WHERE user_id = ?', [userId])
    await pool.execute('DELETE FROM users WHERE id = ?', [userId])
    await pool.end()
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
