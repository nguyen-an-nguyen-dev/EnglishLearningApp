/**
 * One-off: mark the primary field of each admin dialog so the dialog focuses it
 * on open instead of the first control in DOM order.
 */
const fs = require('fs')

const edits = [
  [
    'web/src/components/admin/AdminLessonsPanel.tsx',
    '                <input\n                  type="text"\n                  value={lessonDraft.title}',
    '                <input\n                  type="text"\n                  data-autofocus\n                  value={lessonDraft.title}',
  ],
  [
    'web/src/components/admin/AdminLessonsPanel.tsx',
    '                <textarea\n                  value={questionDraft.draft.questionText}',
    '                <textarea\n                  data-autofocus\n                  value={questionDraft.draft.questionText}',
  ],
  [
    'web/src/components/admin/AdminVideoPanel.tsx',
    '                <input\n                  type="text"\n                  value={editDraft.title}',
    '                <input\n                  type="text"\n                  data-autofocus\n                  value={editDraft.title}',
  ],
  [
    'web/src/components/admin/AdminVideoPanel.tsx',
    '              <input\n                type="url"\n                value={importUrl}',
    '              <input\n                type="url"\n                data-autofocus\n                value={importUrl}',
  ],
]

for (const [file, from, to] of edits) {
  const text = fs.readFileSync(file, 'utf8')
  if (!text.includes(from)) {
    console.log('MISS', file)
    continue
  }
  fs.writeFileSync(file, text.replace(from, to))
  console.log('patched', file)
}
