/**
 * Replace only the `video_segments` INSERT block in backend/database/final.sql
 * with the current table contents, keeping the rest of the dump untouched.
 * Used after re-segmenting the seeded videos: a full regenerate would also pull
 * in unrelated QA rows the dump deliberately does not carry.
 *
 * Usage: node .workbuddy-ai/tmp-shots/patch-final-sql-segments.cjs
 */
const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const backendRequire = createRequire(path.join(ROOT, 'backend/package.json'))
const mysql = backendRequire('mysql2/promise')
const dotenv = backendRequire('dotenv')
dotenv.config({ path: path.join(ROOT, 'backend/.env') })

const FILE = path.join(ROOT, 'backend/database/final.sql')
const ROWS_PER_STATEMENT = 60

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'english_learning',
    charset: 'utf8mb4',
  })

  const [rows] = await conn.query(
    'SELECT id, video_id, start_ms, end_ms, text_en, text_vi, sort_order FROM video_segments ORDER BY id',
  )
  await conn.end()

  const values = rows.map((row) => {
    const text = row.text_en === null ? 'NULL' : conn.escape(row.text_en)
    const vi = row.text_vi === null ? 'NULL' : conn.escape(row.text_vi)
    return `(${row.id},${row.video_id},${row.start_ms},${row.end_ms},${text},${vi},${row.sort_order})`
  })

  const statements = []
  for (let index = 0; index < values.length; index += ROWS_PER_STATEMENT) {
    const chunk = values.slice(index, index + ROWS_PER_STATEMENT)
    statements.push(
      'INSERT INTO `video_segments` (`id`, `video_id`, `start_ms`, `end_ms`, `text_en`, `text_vi`, `sort_order`) VALUES\n'
      + chunk.join(',\n') + ';',
    )
  }

  const source = fs.readFileSync(FILE, 'utf8')
  const marker = '-- video_segments:'
  const commentIndex = source.indexOf(marker)
  if (commentIndex === -1) throw new Error('video_segments comment not found')
  const insertIndex = source.indexOf('INSERT INTO `video_segments`', commentIndex)
  if (insertIndex === -1) throw new Error('video_segments INSERT not found')
  const endIndex = source.indexOf('\n\n', insertIndex)
  if (endIndex === -1) throw new Error('video_segments block end not found')

  const before = source.slice(0, commentIndex)
  const after = source.slice(endIndex)
  const replacement = `-- video_segments: ${rows.length} dòng (đã tách lại: 1 câu / đoạn)\n${statements.join('\n\n')}`

  fs.writeFileSync(FILE, before + replacement + after)
  console.log(`patched final.sql: ${rows.length} video_segments rows in ${statements.length} statement(s)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
