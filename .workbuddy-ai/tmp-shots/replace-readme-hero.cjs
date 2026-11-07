/** Replace the old hero-3D paragraph in README.md with the current behaviour. */
const fs = require('fs')

const FILE = 'README.md'
const lines = fs.readFileSync(FILE, 'utf8').split('\n')
const at = (n) => lines[n - 1]

if (!at(475).includes('Hero landing là một cảnh 3D')) {
  throw new Error(`start boundary mismatch: ${JSON.stringify(at(475))}`)
}
if (!at(490).includes('1440 và 390')) {
  throw new Error(`end boundary mismatch: ${JSON.stringify(at(490))}`)
}

const section = fs.readFileSync('.workbuddy-ai/tmp-shots/readme-hero-3d.md', 'utf8').replace(/\n$/, '')
const out = [...lines.slice(0, 474), ...section.split('\n'), ...lines.slice(490)]
fs.writeFileSync(FILE, out.join('\n'))
console.log('replaced lines 475-490 with', section.split('\n').length, 'lines')
