/**
 * One-off: add `study_reminders` so the buddy can schedule "nhắc mình học lúc
 * 20:00" and the app can deliver the reminder in-app and as a browser
 * notification. Idempotent.
 *
 * Usage: node .workbuddy-ai/tmp-shots/apply-reminders-table.cjs
 */
const path = require('path')
const { createRequire } = require('module')

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const backendRequire = createRequire(path.join(ROOT, 'backend/package.json'))
const mysql = backendRequire('mysql2/promise')
const dotenv = backendRequire('dotenv')
dotenv.config({ path: path.join(ROOT, 'backend/.env') })

const DDL = `
CREATE TABLE IF NOT EXISTS study_reminders (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  user_id bigint(20) unsigned NOT NULL,
  title varchar(160) NOT NULL,
  body varchar(500) DEFAULT NULL,
  due_at datetime NOT NULL,
  target_json varchar(500) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  delivered_at datetime DEFAULT NULL,
  dismissed_at datetime DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_reminders_user_due (user_id, due_at),
  CONSTRAINT fk_reminders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'english_learning',
    charset: 'utf8mb4',
  })

  try {
    const [existing] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'study_reminders'`,
      [process.env.DB_NAME || 'english_learning'],
    )
    if (existing.length > 0) {
      console.log('study_reminders already present')
    } else {
      await conn.query(DDL)
      console.log('created study_reminders')
    }

    const [columns] = await conn.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'study_reminders' ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || 'english_learning'],
    )
    console.table(columns)
  } finally {
    await conn.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
