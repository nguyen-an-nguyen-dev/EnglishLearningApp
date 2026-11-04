/**
 * Import the generated final.sql into a scratch database and compare it with
 * the live one. The dump is rewritten to use a scratch DB name so the live DB
 * is never dropped.
 */
const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const backendRequire = createRequire(path.join(ROOT, 'backend/package.json'))
const mysql = backendRequire('mysql2/promise')
const dotenv = backendRequire('dotenv')
dotenv.config({ path: path.join(ROOT, 'backend/.env') })

const LIVE = process.env.DB_NAME || 'english_learning'
const SCRATCH = 'engorace_final_check'

async function counts(conn, db) {
  const [t] = await conn.execute(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = "BASE TABLE"',
    [db],
  )
  const out = {}
  for (const r of t) {
    const [c] = await conn.query(`SELECT COUNT(*) AS n FROM \`${db}\`.\`${r.TABLE_NAME}\``)
    out[r.TABLE_NAME] = c[0].n
  }
  return out
}

async function main() {
  let sql = fs.readFileSync(path.join(ROOT, 'backend/database/final.sql'), 'utf8')
  sql = sql.replaceAll(`\`${LIVE}\``, `\`${SCRATCH}\``)

  const admin = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
    charset: 'utf8mb4',
  })

  await admin.query(`DROP DATABASE IF EXISTS \`${SCRATCH}\``)
  await admin.query(sql)
  const live = await counts(admin, LIVE)
  const scratch = await counts(admin, SCRATCH)

  const problems = []
  for (const table of Object.keys(live)) {
    if (scratch[table] !== live[table]) problems.push(`${table}: live=${live[table]} imported=${scratch[table]}`)
  }
  for (const table of Object.keys(scratch)) {
    if (!(table in live)) problems.push(`${table}: extra table in import`)
  }

  const [img] = await admin.query(`SELECT COUNT(*) AS n FROM \`${SCRATCH}\`.battle_words WHERE image_url IS NOT NULL`)
  const [vid] = await admin.query(`SELECT COUNT(*) AS n FROM \`${SCRATCH}\`.video_lessons`)
  const [seg] = await admin.query(`SELECT COUNT(*) AS n FROM \`${SCRATCH}\`.video_segments`)
  console.log('tables', Object.keys(live).length, 'rows', Object.values(live).reduce((a, b) => a + b, 0))
  console.log('image_url', img[0].n, 'videos', vid[0].n, 'segments', seg[0].n)
  console.log('mismatches', problems.length ? problems.join('; ') : 'NONE')

  await admin.query(`DROP DATABASE IF EXISTS \`${SCRATCH}\``)
  await admin.end()
  if (problems.length || img[0].n !== 100 || vid[0].n !== 4 || seg[0].n !== 53) process.exitCode = 1
  console.log(img[0].n === 100 && vid[0].n === 4 && seg[0].n === 53 && !problems.length ? 'VERIFY: PASS' : 'VERIFY: FAIL')
}

main().catch((e) => { console.error('VERIFY ERROR', e.message); process.exit(1) })
