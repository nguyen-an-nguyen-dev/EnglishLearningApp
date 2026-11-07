/**
 * One-off: give the users INSERT in backend/database/final.sql an explicit `role`
 * column so a fresh `mysql < final.sql` seeds test@test.com as admin.
 */
const fs = require('fs')
const path = require('path')

const FILE = path.join('C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp', 'backend/database/final.sql')
const ADMIN_EMAILS = new Set(['test@test.com'])

const source = fs.readFileSync(FILE, 'utf8')
const startMarker = 'INSERT INTO `users` (`id`, `username`, `email`'
const start = source.indexOf(startMarker)
if (start === -1) throw new Error('users INSERT not found')
const end = source.indexOf(';', start)
if (end === -1) throw new Error('users INSERT terminator not found')

let touched = 0
const lines = source.slice(start, end).split('\n').map((line) => {
  if (line.includes('INSERT INTO `users`')) {
    const rewritten = line.replace(
      '`display_name`, `xp`, `streak`, `created_at`, `updated_at`',
      '`display_name`, `xp`, `streak`, `role`, `created_at`, `updated_at`',
    )
    if (rewritten === line) throw new Error('header rewrite failed')
    return rewritten
  }
  if (!line.trimStart().startsWith('(')) return line

  const email = (line.match(/,'([^']+@[^']+)'/) || [])[1]
  const role = ADMIN_EMAILS.has(email) ? 'admin' : 'learner'
  const dateStart = line.search(/,'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}','\d{4}-\d{2}-\d{2} /)
  if (dateStart === -1) throw new Error(`unexpected users row: ${line.slice(0, 80)}`)
  touched += 1
  return `${line.slice(0, dateStart)},'${role}'${line.slice(dateStart)}`
})

if (touched !== 14) throw new Error(`expected 14 user rows, touched ${touched}`)

fs.writeFileSync(FILE, source.slice(0, start) + lines.join('\n') + source.slice(end))
console.log(`rewrote ${touched} user rows with role`)
