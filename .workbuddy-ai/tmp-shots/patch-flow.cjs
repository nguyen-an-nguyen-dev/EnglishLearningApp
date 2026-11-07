const fs = require('fs')
const file = '.workbuddy-ai/tmp-shots/admin-flow.cjs'
let text = fs.readFileSync(file, 'utf8')
text = text.replace(
  "  steps.push({ step: 'create stage', found: await page.getByText(stageTitle, { exact: true }).count() })",
  "  steps.push({ step: 'create stage', found: await page.locator('.admin-row.is-stage', { hasText: stageTitle }).count() })",
)
text = text.replace(
  "  steps.push({ step: 'create lesson', found: await page.getByText(lessonTitle, { exact: true }).count() })",
  "  steps.push({ step: 'create lesson', found: await page.locator('.admin-row.is-lesson', { hasText: lessonTitle }).count() })",
)
text = text.replace(
  "  const persisted = {\n    stage: await page.getByText(stageTitle, { exact: true }).count(),\n    lesson: await page.getByText(lessonTitle, { exact: true }).count(),\n    question: await page.getByText(questionText, { exact: true }).count(),\n  }",
  "  const persisted = {\n    stage: await page.locator('.admin-row.is-stage', { hasText: stageTitle }).count(),\n    lesson: await page.locator('.admin-row.is-lesson', { hasText: lessonTitle }).count(),\n    question: await page.locator('.admin-row.is-question', { hasText: questionText }).count(),\n  }",
)
fs.writeFileSync(file, text)
console.log('flow script patched')
