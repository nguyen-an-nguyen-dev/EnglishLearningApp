/**
 * Real mojibake scan: read as UTF-8 (Select-String in this shell misreads UTF-8
 * as ANSI and reports every Vietnamese file as corrupt).
 */
const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const SKIP = /node_modules|[\\/]dist[\\/]|[\\/]\.git[\\/]|[\\/]logs[\\/]/
const EXT = /\.(md|ts|tsx|css|json|sql|cjs|mjs)$/
// Sequences that only appear when UTF-8 bytes were decoded as Latin-1/CP1252.
const PATTERNS = [/Ã[¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾]/, /á»/, /áº/, /â€[”–œ]/, /Æ°/, /â€‹/]

const hits = []
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (SKIP.test(full)) continue
    if (entry.isDirectory()) { walk(full); continue }
    if (!EXT.test(entry.name)) continue
    const text = fs.readFileSync(full, 'utf8')
    const count = PATTERNS.reduce((sum, re) => sum + (text.match(new RegExp(re.source, 'g'))?.length ?? 0), 0)
    if (count > 0) hits.push([path.relative(ROOT, full), count])
  }
}
walk(ROOT)

if (hits.length === 0) {
  console.log('clean: no mojibake in any scanned file')
} else {
  console.log('files with real mojibake:')
  for (const [file, count] of hits.sort((a, b) => b[1] - a[1])) console.log(`  ${count}\t${file}`)
}
