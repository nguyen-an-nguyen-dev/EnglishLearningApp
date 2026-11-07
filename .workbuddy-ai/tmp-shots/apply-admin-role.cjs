/**
 * One-off: add users.role ('learner' | 'admin') to the LIVE dev database and make
 * the documented demo account an admin. Idempotent, backed up first.
 *
 * Usage: node .workbuddy-ai/tmp-shots/apply-admin-role.cjs
 */
const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const backendRequire = createRequire(path.join(ROOT, 'backend/package.json'))
const mysql = backendRequire('mysql2/promise')
const dotenv = backendRequire('dotenv')
dotenv.config({ path: path.join(ROOT, 'backend/.env') })

const DB = process.env.DB_NAME || 'english_learning'
const ADMIN_EMAILS = ['test@test.com']

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

  try {
    const [users] = await conn.query('SELECT id, email, role FROM users ORDER BY id').catch(async (error) => {
      if (!/Unknown column/i.test(String(error.message))) throw error
      const [plain] = await conn.query('SELECT id, email FROM users ORDER BY id')
      return [plain]
    })

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backup = path.join(ROOT, '.workbuddy-ai/tmp-shots', `users-backup-${stamp}.json`)
    fs.writeFileSync(backup, JSON.stringify(users, null, 2))
    console.log(`backup users (${users.length} rows) -> ${backup}`)

    const [columns] = await conn.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
      [DB],
    )
    const hasRole = columns.some((column) => column.COLUMN_NAME === 'role')

    if (!hasRole) {
      await conn.query(
        "ALTER TABLE users ADD COLUMN role ENUM('learner','admin') NOT NULL DEFAULT 'learner' AFTER streak",
      )
      console.log('added users.role')
    } else {
      console.log('users.role already present')
    }

    const placeholders = ADMIN_EMAILS.map(() => '?').join(', ')
    const [result] = await conn.execute(
      `UPDATE users SET role = 'admin' WHERE email IN (${placeholders})`,
      ADMIN_EMAILS,
    )
    console.log(`promoted ${result.affectedRows} admin row(s)`)

    const [rows] = await conn.query('SELECT id, email, role FROM users ORDER BY id')
    console.table(rows)
  } finally {
    await conn.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
