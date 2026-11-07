/**
 * Replace the "AI bạn học — En Buddy" section of README.md with the companion
 * model. Line-based with boundary assertions so a shifted file cannot be
 * silently mangled; written from Node because PowerShell corrupts UTF-8.
 */
const fs = require('fs')

const FILE = 'README.md'
const lines = fs.readFileSync(FILE, 'utf8').split('\n')
const at = (n) => lines[n - 1]

if (!at(307).startsWith('### AI bạn học')) {
  throw new Error(`start boundary mismatch: ${JSON.stringify(at(307))}`)
}
// The section ends right before "### Học thử trên landing page".
if (!at(380).startsWith('### Học thử trên landing page')) {
  throw new Error(`end boundary mismatch: ${JSON.stringify(at(380))}`)
}

const section = fs.readFileSync('.workbuddy-ai/tmp-shots/readme-buddy-section.md', 'utf8').replace(/\n$/, '')
const out = [...lines.slice(0, 306), ...section.split('\n'), ...lines.slice(379)]
fs.writeFileSync(FILE, out.join('\n'))
console.log(`replaced lines 307-379 with ${section.split('\n').length} lines`)
