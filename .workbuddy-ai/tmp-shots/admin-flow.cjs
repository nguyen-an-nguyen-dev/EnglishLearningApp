/**
 * End-to-end admin flow through the real UI: create a stage, a lesson and a
 * question, reload to prove the data persisted, then clean up through the API.
 *
 * Run: node .workbuddy-ai/tmp-shots/admin-flow.cjs
 */
const { chromium } = require('playwright')
const path = require('path')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const OUT = path.join(ROOT, '.workbuddy-ai/tmp-shots/qa-admin')
const BASE = 'http://localhost:5173/'
const API = 'http://localhost:3000'
const CHROME = 'C:/Users/ADMIN/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

const stamp = Date.now()
const stageTitle = `Chặng QA ${stamp}`
const lessonTitle = `Bài QA ${stamp}`
const questionText = 'Từ "river" nghĩa là gì?'

async function api(token, method, route, body) {
  const response = await fetch(`${API}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.success) {
    throw new Error(`${method} ${route} -> ${response.status} ${JSON.stringify(payload.errors ?? payload.message)}`)
  }
  return payload.data
}

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: '123456' }),
  })
  const auth = (await login.json()).data
  const token = auth.token

  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(({ auth }) => {
    localStorage.setItem('engorace_theme', 'light')
    localStorage.setItem('englearn_token', auth.token)
    localStorage.setItem('englearn_user', JSON.stringify(auth.user))
    sessionStorage.setItem('engorace_active_tab', 'admin')
  }, { auth })

  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)

  const steps = []

  // 1. New stage
  await page.locator('.admin-column').nth(0).locator('.admin-column-head .admin-icon-btn').click()
  await page.locator('#admin-stage-form input[type="text"]').fill(stageTitle)
  await page.locator('#admin-stage-form textarea').fill('Chặng do QA tạo tự động.')
  await page.locator('button[form="admin-stage-form"]').click()
  await page.waitForTimeout(1200)
  steps.push({ step: 'create stage', found: await page.locator('.admin-row.is-stage', { hasText: stageTitle }).count() })

  // 2. New lesson inside it
  await page.locator('.admin-row.is-stage', { hasText: stageTitle }).locator('.admin-row-select').click()
  await page.waitForTimeout(500)
  await page.locator('.admin-column').nth(1).locator('.admin-column-head .admin-icon-btn').click()
  if (await page.locator('#admin-lesson-form').count() === 0) {
    // Stage list may need a moment after the reload; click the stage again.
    await page.locator('.admin-row.is-stage', { hasText: stageTitle }).locator('.admin-row-select').click()
    await page.waitForTimeout(400)
    await page.locator('.admin-column').nth(1).locator('.admin-column-head .admin-icon-btn').click()
  }
  await page.locator('#admin-lesson-form input[type="text"]').nth(0).fill(lessonTitle)
  await page.locator('#admin-lesson-form input[type="text"]').nth(1).fill('Vocabulary')
  await page.locator('button[form="admin-lesson-form"]').click()
  await page.waitForTimeout(1200)
  steps.push({ step: 'create lesson', found: await page.locator('.admin-row.is-lesson', { hasText: lessonTitle }).count() })

  // 3. New question inside the lesson
  await page.locator('.admin-row.is-lesson', { hasText: lessonTitle }).locator('.admin-row-select').click()
  await page.waitForTimeout(700)
  await page.locator('.admin-column').nth(2).locator('.admin-column-head .admin-icon-btn').click()
  await page.locator('#admin-question-form textarea').first().fill(questionText)
  await page.locator('#admin-question-form input[type="text"]').first().fill('river = dòng sông')
  const answers = page.locator('#admin-question-form .admin-answer-input')
  await answers.nth(0).fill('dòng sông')
  await answers.nth(1).fill('ngọn núi')
  await answers.nth(2).fill('bầu trời')
  await page.locator('button[form="admin-question-form"]').click()
  await page.waitForTimeout(1400)
  steps.push({ step: 'create question', rows: await page.locator('.admin-row.is-question').count() })

  await page.screenshot({ path: path.join(OUT, 'flow-created.png') })

  // 4. Reload and confirm persistence
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.locator('.admin-row.is-stage', { hasText: stageTitle }).locator('.admin-row-select').click()
  await page.waitForTimeout(700)
  await page.locator('.admin-row.is-lesson', { hasText: lessonTitle }).locator('.admin-row-select').click()
  await page.waitForTimeout(900)
  const persisted = {
    stage: await page.locator('.admin-row.is-stage', { hasText: stageTitle }).count(),
    lesson: await page.locator('.admin-row.is-lesson', { hasText: lessonTitle }).count(),
    question: await page.locator('.admin-row.is-question', { hasText: questionText }).count(),
  }
  await page.screenshot({ path: path.join(OUT, 'flow-persisted.png') })

  // 5. Clean up through the API so the QA stage never reaches the learner view.
  const content = await api(token, 'GET', '/api/admin/content')
  const stage = content.stages.find((entry) => entry.title === stageTitle)
  const lesson = stage?.lessons.find((entry) => entry.title === lessonTitle)
  const questions = lesson ? await api(token, 'GET', `/api/admin/lessons/${lesson.id}/questions`) : { questions: [] }
  if (lesson) await api(token, 'DELETE', `/api/admin/lessons/${lesson.id}`)
  if (stage) await api(token, 'DELETE', `/api/admin/stages/${stage.id}`)

  const result = { steps, persisted, pageErrors, cleanup: { stage: stage?.id ?? null, lesson: lesson?.id ?? null, questions: questions.questions?.length ?? 0 } }
  console.log(JSON.stringify(result, null, 2))
  await browser.close()

  if (persisted.stage !== 1 || persisted.lesson !== 1 || persisted.question !== 1) {
    throw new Error(`persistence check failed: ${JSON.stringify(persisted)}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
