/** Fix the doubled pipe escape and verify the whole README is intact. */
const fs = require('fs')

const FILE = 'README.md'
let text = fs.readFileSync(FILE, 'utf8')
const before = text
text = text.replace('Small Talk \\\\| Everyday English', 'Small Talk \\| Everyday English')
if (text === before) throw new Error('pipe escape not found in the expected form')
fs.writeFileSync(FILE, text)
console.log('pipe escape fixed')

// Mojibake canary: a UTF-8 mojibake would show up as these Latin-1 digraphs.
const corrupted = text.match(/Ã|Æ°|á»‡|â€”|â€“|Ã3/g)
console.log('mojibake matches:', corrupted ? corrupted.length : 0)
if (corrupted) throw new Error(`file still looks corrupted: ${corrupted.slice(0, 5).join(' ')}`)

const lines = text.split('\n')
console.log('total lines:', lines.length)
console.log('has new section:', text.includes('### Nhập lại caption cho video đã có'))
console.log('has yt-dlp section:', text.includes('trong môi trường bị sandbox'))
console.log('counters:', /114 segment/.test(text), /83 tests/.test(text), /51 tests/.test(text))
console.log('table row:', lines[219])
console.log('tail:', JSON.stringify(lines[lines.length - 2]).slice(0, 80))
