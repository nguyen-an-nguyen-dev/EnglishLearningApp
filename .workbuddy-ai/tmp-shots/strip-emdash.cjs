/**
 * Replace the em-dashes in learner-facing copy with plain separators (the design
 * rule is zero em-dashes in visible text). Prompt-internal strings are left
 * alone: the learner never sees them.
 */
const fs = require('fs')

const swaps = [
  ['backend/src/modules/buddy/buddy.service.ts', [
    ['Một bài ngắn là đủ giữ chuỗi — chưa có hoạt động nào từ hôm qua.', 'Một bài ngắn là đủ giữ chuỗi. Chưa có hoạt động nào từ hôm qua.'],
    ['bài — làm lại một bài đã học cũng tính là quay lại.', 'bài. Làm lại một bài đã học cũng tính là quay lại.'],
    ['ở chủ đề này — nhiều hơn các chủ đề còn lại.', 'ở chủ đề này, nhiều hơn các chủ đề còn lại.'],
    ['Sổ từ chỉ có ích khi mở lại — đọc qua vài từ là đủ một lượt ôn.', 'Sổ từ chỉ có ích khi mở lại. Đọc qua vài từ là đủ một lượt ôn.'],
    ['bài — một vòng đấu 1v1 kiểm tra phản xạ từ nhanh hơn đọc lại.', 'bài. Một vòng đấu 1v1 kiểm tra phản xạ từ nhanh hơn đọc lại.'],
  ]],
  ['backend/src/modules/ai/ai.service.ts', [
    ['ở chủ đề này — đây là điểm yếu rõ nhất trong dữ liệu.', 'ở chủ đề này, đây là điểm yếu rõ nhất trong dữ liệu.'],
    ['Một video chưa hoàn thành — luyện nghe 1 đoạn sau khi học bài mới.', 'Một video chưa hoàn thành. Luyện nghe 1 đoạn sau khi học bài mới.'],
    ['trận, thắng ${snapshot.battleWins} — vào đấu trường', 'trận, thắng ${snapshot.battleWins}. Vào đấu trường'],
    ['câu sai gần đây.', 'câu sai gần đây.'],
    ['${weak.topic} — ${weak.mistakes} câu sai', '${weak.topic}: ${weak.mistakes} câu sai'],
  ]],
]

for (const [file, pairs] of swaps) {
  let text = fs.readFileSync(file, 'utf8')
  let changed = 0
  for (const [from, to] of pairs) {
    if (!text.includes(from)) { console.log(`  MISS ${file}: ${from.slice(0, 50)}`); continue }
    text = text.replace(from, to)
    changed += 1
  }
  fs.writeFileSync(file, text)
  console.log(`${file}: ${changed} swap(s)`)
}

// Verify no learner-facing em-dash is left in the nudge builder.
const buddy = fs.readFileSync('backend/src/modules/buddy/buddy.service.ts', 'utf8')
const remaining = buddy.match(/^.*—.*$/gm) || []
console.log('buddy.service em-dash lines left:', remaining.length)
