const { chromium } = require('playwright')
const path = require('path')
const mysql = require('mysql2/promise')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/backend'
require('dotenv').config({ path: path.join(ROOT, '.env') })

const OUT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/.workbuddy-ai/tmp-shots/dashboard-audit'
const BASE = 'http://localhost:5173/'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

async function main() {
  const email = `ui-restore-${Date.now()}@example.test`
  const password = 'correct-horse-7'

  const register = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Restore Test', email, password }),
  })
  const registered = await register.json()
  if (!register.ok) throw new Error('register failed: ' + JSON.stringify(registered))
  const userId = registered.data.user.id

  const login = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const { data: auth } = await login.json()
  if (!login.ok) throw new Error('login failed')

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'english_learning',
  })

  try {
    const rows = [
      ['The cat is sleeping on the sofa.', 'Con mèo đang ngủ trên ghế sofa.', 'en', 'vi'],
      ['Con mèo đang ngủ trên ghế sofa.', 'The cat is sleeping on the sofa.', 'vi', 'en'],
    ]
    for (const [originalText, translatedText, sourceLanguage, targetLanguage] of rows) {
      await pool.execute(
        `INSERT INTO translations (user_id, file_name, original_text, source_language, translated_text, target_language, provider)
         VALUES (?, NULL, ?, ?, ?, ?, 'seed-test')`,
        [userId, originalText, sourceLanguage, translatedText, targetLanguage],
      )
    }

    const browser = await chromium.launch({ headless: true, executablePath: CHROME })
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx.addInitScript(({ token, user }) => {
      localStorage.setItem('englearn_token', token)
      localStorage.setItem('englearn_user', JSON.stringify(user))
      localStorage.setItem('engorace_theme', 'light')
    }, { token: auth.token, user: { id: userId, name: 'Restore Test', email } })
    const page = await ctx.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    await page.locator('.nav-item:has-text("Dịch Tài Liệu")').click()
    await page.waitForTimeout(1200)

    const directionBefore = await page.evaluate(() => ({
      source: document.querySelectorAll('.translate-pair-lang')[0]?.textContent,
      target: document.querySelectorAll('.translate-pair-lang')[1]?.textContent,
    }))
    console.log('direction before:', JSON.stringify(directionBefore))

    // Click the vi->en entry (goes into history newest-first; index 0 is the vi->en one)
    const viEntry = page.locator('.translate-history-item').first()
    console.log('first item text:', (await viEntry.innerText()).trim().replace(/\n/g, ' | '))
    await viEntry.click()
    await page.waitForTimeout(400)

    const directionAfter = await page.evaluate(() => ({
      source: document.querySelectorAll('.translate-pair-lang')[0]?.textContent,
      target: document.querySelectorAll('.translate-pair-lang')[1]?.textContent,
      input: document.querySelector('.translate-textarea')?.value,
    }))
    console.log('after vi->en restore:', JSON.stringify(directionAfter))

    // Click the en->vi entry (second item)
    await page.locator('.translate-history-item').nth(1).click()
    await page.waitForTimeout(400)
    const directionAfter2 = await page.evaluate(() => ({
      source: document.querySelectorAll('.translate-pair-lang')[0]?.textContent,
      target: document.querySelectorAll('.translate-pair-lang')[1]?.textContent,
      input: document.querySelector('.translate-textarea')?.value,
    }))
    console.log('after en->vi restore:', JSON.stringify(directionAfter2))

    await page.screenshot({ path: path.join(OUT, 'restore-direction-check.png') })
    await ctx.close()
    await browser.close()
  } finally {
    await pool.execute('DELETE FROM translations WHERE user_id = ?', [userId])
    await pool.execute('DELETE FROM users WHERE id = ?', [userId])
    await pool.end()
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
