import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), 'public', 'cosmetics', 'garage')
const allowed = new Set(['#14203a', '#ffffff', '#c9d6ea', '#ffd23f', '#19b6f0'])
const counts = new Map()
const widths = new Map()
const paintIssues = []
let over = 0

for (const name of readdirSync(dir).filter((file) => file.endsWith('.svg'))) {
  const text = readFileSync(join(dir, name), 'utf8')
  if (statSync(join(dir, name)).size >= 6 * 1024) over += 1
  if (/linearGradient|radialGradient|<filter/i.test(text)) paintIssues.push(`${name}: gradient/filter`)
  for (const match of text.matchAll(/stroke="(#[0-9a-f]{6})"(?: stroke-width="([0-9.]+)")?/g)) {
    const color = match[1].toLowerCase()
    counts.set(color, (counts.get(color) ?? 0) + 1)
    const width = match[2] ?? '1'
    widths.set(width, (widths.get(width) ?? 0) + 1)
    if (!allowed.has(color)) paintIssues.push(`${name}: stroke ${color}`)
  }
}

console.log('Stroke colours:', Object.fromEntries([...counts.entries()].sort()))
console.log('Stroke widths:', Object.fromEntries([...widths.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))))
console.log('Files over 6 KB:', over)
console.log('Gradient/filter/unexpected stroke:', paintIssues.length === 0 ? 'none' : paintIssues)
if (over > 0 || paintIssues.length > 0) process.exitCode = 1
