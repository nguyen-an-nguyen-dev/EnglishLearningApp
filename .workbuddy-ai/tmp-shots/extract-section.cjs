/** Pull the section template out of update-readme-segments.cjs into its own file. */
const fs = require('fs')

const src = fs.readFileSync('.workbuddy-ai/tmp-shots/update-readme-segments.cjs', 'utf8')
const open = 'const replacement = `'
const start = src.indexOf(open)
const end = src.indexOf('`\n\nconst out =')
if (start === -1 || end === -1) throw new Error('template not found')

const raw = src.slice(start + open.length, end)
// The template lives inside a JS template literal, so its backticks are escaped.
const section = raw.replace(/\\`/g, '`')
fs.writeFileSync('.workbuddy-ai/tmp-shots/readme-section.md', section)
console.log('extracted', section.split('\n').length, 'lines')
console.log('first line:', section.split('\n')[0].slice(0, 80))
console.log('has backticks:', section.includes('`final.sql`'))
