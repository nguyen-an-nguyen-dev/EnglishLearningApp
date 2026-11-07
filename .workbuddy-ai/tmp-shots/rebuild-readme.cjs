/**
 * Restore README.md from the pre-replacement backup, re-apply the sentence
 * splitting section, then fix the two counters — all in Node, because
 * PowerShell's Get-Content/Set-Content round-trip corrupted the UTF-8 text.
 */
const fs = require('fs')

const BACKUP = '.workbuddy-ai/tmp-shots/README.before-segments.bak'
const FILE = 'README.md'

fs.copyFileSync(BACKUP, FILE)
console.log('restored from backup')

// 1. section replacement (same boundaries the bash-era script asserted)
const lines = fs.readFileSync(FILE, 'utf8').split('\n')
if (!lines[213].startsWith('Thư viện video mặc định') || !lines[253].includes('mà dump cố tình không mang)')) {
  throw new Error('section boundaries moved; refusing to rewrite')
}

const section = fs.readFileSync('.workbuddy-ai/tmp-shots/readme-section.md', 'utf8').replace(/\n$/, '')
const out = [...lines.slice(0, 213), ...section.split('\n'), ...lines.slice(254)]
fs.writeFileSync(FILE, out.join('\n'))
console.log('section replaced')

// 2. counters
let text = fs.readFileSync(FILE, 'utf8')
const before = text
text = text.replace('4 video, 123 segment).', '4 video, 114 segment).')
text = text.replace('npm test                       # 82 tests', 'npm test                       # 83 tests')
if (text === before) throw new Error('counter replacement matched nothing')
fs.writeFileSync(FILE, text)
console.log('counters updated')
