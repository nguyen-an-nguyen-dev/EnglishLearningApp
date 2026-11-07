const fs = require('fs')
const file = 'backend/src/modules/admin/admin.repository.ts'
const source = fs.readFileSync(file, 'utf8')
let fixed = 0
const out = source.split('\n').map((line) => {
  if (!/^\/\/ [^\x00-\x7F]/.test(line)) return line
  fixed += 1
  const cleaned = line.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim()
  return `// --- ${cleaned.replace(/^\/\/\s*/, '')} ---`
})
fs.writeFileSync(file, out.join('\n'))
console.log('fixed lines:', fixed)
