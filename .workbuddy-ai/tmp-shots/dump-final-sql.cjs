/**
 * Build one self-contained backend/database/final.sql from the LIVE database.
 * Replaces all migration/seed files: full schema in FK-safe order + all rows,
 * batched into compact extended INSERTs (no temp seed tables, no UPDATE
 * passes, no duplicate DDL).
 */
const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const backendRequire = createRequire(path.join(ROOT, 'backend/package.json'))
const mysql = backendRequire('mysql2/promise')
const dotenv = backendRequire('dotenv')
dotenv.config({ path: path.join(ROOT, 'backend/.env') })

const OUT = path.join(ROOT, 'backend/database/final.sql')
const DB = process.env.DB_NAME || 'english_learning'
const MAX_INSERT_BYTES = 400 * 1024

function esc(value, conn) {
  if (value === null || value === undefined) return 'NULL'
  if (Buffer.isBuffer(value)) return conn.escape(value)
  if (value instanceof Date) return conn.escape(value)
  if (typeof value === 'object') return conn.escape(JSON.stringify(value))
  return conn.escape(value)
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: DB,
    charset: 'utf8mb4',
    multipleStatements: true,
  })

  const [tableRows] = await conn.execute(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = "BASE TABLE"',
    [DB],
  )
  const tables = tableRows.map((r) => r.TABLE_NAME)

  // Topological order: a table must be created after everything it references.
  const [fkRows] = await conn.execute(
    `SELECT TABLE_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [DB],
  )
  const deps = new Map(tables.map((t) => [t, new Set()]))
  for (const r of fkRows) {
    if (deps.has(r.TABLE_NAME) && deps.has(r.REFERENCED_TABLE_NAME) && r.TABLE_NAME !== r.REFERENCED_TABLE_NAME) {
      deps.get(r.TABLE_NAME).add(r.REFERENCED_TABLE_NAME)
    }
  }
  const ordered = []
  const remaining = new Set(tables)
  while (remaining.size) {
    const ready = [...remaining].filter((t) => [...deps.get(t)].every((d) => !remaining.has(d)))
    if (!ready.length) {
      // Defensive fallback for a cycle: append the rest alphabetically.
      ordered.push(...[...remaining].sort())
      break
    }
    ready.sort()
    ordered.push(...ready)
    ready.forEach((t) => remaining.delete(t))
  }

  const lines = []
  const push = (s = '') => lines.push(s)
  push('-- ============================================================================')
  push('-- ENGORACE · CSDL duy nhất (single-file bootstrap)')
  push(`-- Sinh từ DB thật \`${DB}\` lúc ${new Date().toISOString()}.`)
  push('-- Gồm TOÀN BỘ schema + dữ liệu hiện tại; thay thế mọi file migration/seed cũ.')
  push('-- Chạy lại an toàn: file DROP rồi CREATE lại database từ đầu.')
  push('-- Cách nạp: mysql -u root -p < backend/database/final.sql')
  push('-- ============================================================================')
  push('')
  push('SET NAMES utf8mb4;')
  push('SET FOREIGN_KEY_CHECKS = 0;')
  push('SET UNIQUE_CHECKS = 0;')
  push("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';")
  push('')
  push('-- CẢNH BÁO: bootstrap từ đầu — DROP DATABASE sẽ xoá toàn bộ dữ liệu cũ trong DB này.')
  push(`DROP DATABASE IF EXISTS \`${DB}\`;`)
  push(`CREATE DATABASE \`${DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`)
  push(`USE \`${DB}\`;`)
  push('')
  push('-- ---------------------------------------------------------------------------')
  push('-- 1. SCHEMA (thứ tự theo khoá ngoại). DDL tự commit nên không bọc transaction.')
  push('-- ---------------------------------------------------------------------------')
  push('')

  const meta = []
  for (const table of ordered) {
    const [ddl] = await conn.query(`SHOW CREATE TABLE \`${table}\``)
    const create = ddl[0]['Create Table'].replace(/AUTO_INCREMENT=\d+\s*/i, '')
    push(`-- ${table}`)
    push(`${create};`)
    push('')
    const [cols] = await conn.execute(
      `SELECT COLUMN_NAME, EXTRA, DATA_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
      [DB, table],
    )
    const usable = cols.filter((c) => !/GENERATED/i.test(c.EXTRA))
    const hasId = usable.some((c) => c.COLUMN_NAME === 'id')
    const [countRows] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\``)
    meta.push({ table, columns: usable.map((c) => c.COLUMN_NAME), hasId, rows: countRows[0].n })
  }

  push('-- ---------------------------------------------------------------------------')
  push('-- 2. DỮ LIỆU (INSERT gộp nhiều dòng / bảng, một transaction duy nhất)')
  push('-- ---------------------------------------------------------------------------')
  push('')
  push('START TRANSACTION;')
  push('')

  for (const m of meta) {
    push(`-- ${m.table}: ${m.rows} dòng`)
    if (m.rows === 0) { push(''); continue }
    const colList = m.columns.map((c) => `\`${c}\``).join(', ')
    const selectCols = m.columns.map((c) => `\`${c}\``).join(', ')
    const [rows] = await conn.query(
      `SELECT ${selectCols} FROM \`${m.table}\`${m.hasId ? ' ORDER BY `id`' : ''}`,
    )
    let batch = []
    let batchBytes = 0
    const flush = () => {
      if (!batch.length) return
      push(`INSERT INTO \`${m.table}\` (${colList}) VALUES`)
      push(`${batch.join(',\n')};`)
      push('')
      batch = []
      batchBytes = 0
    }
    for (const row of rows) {
      const tuple = `(${m.columns.map((c) => esc(row[c], conn)).join(',')})`
      if (batch.length && batchBytes + tuple.length > MAX_INSERT_BYTES) flush()
      batch.push(tuple)
      batchBytes += tuple.length + 2
    }
    flush()
  }

  push('COMMIT;')
  push('SET FOREIGN_KEY_CHECKS = 1;')
  push('SET UNIQUE_CHECKS = 1;')
  push('')
  push('-- ---------------------------------------------------------------------------')
  push(`-- TỔNG: ${meta.length} bảng / ${meta.reduce((s, m) => s + m.rows, 0)} dòng`)
  push(meta.map((m) => `--   ${m.table.padEnd(26)} ${m.rows}`).join('\n'))
  push('-- ---------------------------------------------------------------------------')
  push('')

  fs.writeFileSync(OUT, lines.join('\n'))
  await conn.end()
  console.log(`wrote ${OUT}`)
  console.log(`tables=${meta.length} rows=${meta.reduce((s, m) => s + m.rows, 0)} bytes=${fs.statSync(OUT).size}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
