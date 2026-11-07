const path = require('path')
const { createRequire } = require('module')
const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const backendRequire = createRequire(path.join(ROOT, 'backend/package.json'))
const mysql = backendRequire('mysql2/promise')
const dotenv = backendRequire('dotenv')
dotenv.config({ path: path.join(ROOT, 'backend/.env') })
;(async () => {
  const conn = await mysql.createConnection({ host: 'localhost', port: 3306, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME || 'english_learning' })
  const [rows] = await conn.query(`SELECT video_id, sort_order, start_ms, end_ms, text_en FROM video_segments WHERE video_id = 10 ORDER BY sort_order`)
  const q = (s) => (s.match(/\b(how|what|where|when|why|who|did|do|does|was|were|is|are|can|could|would)\b/gi) || []).length
  for (const r of rows) {
    const words = r.text_en.split(' ').length
    console.log(`#${r.sort_order} ${(r.end_ms - r.start_ms)/1000}s ${words}w q~${q(r.text_en)} :: ${r.text_en}`)
  }
  console.log('--- all videos: segment stats ---')
  const [stats] = await conn.query(`SELECT video_id, COUNT(*) n, ROUND(AVG(CHAR_LENGTH(text_en))) avg_chars, MAX(CHAR_LENGTH(text_en)) max_chars, ROUND(AVG(end_ms-start_ms)/1000,1) avg_sec, ROUND(MAX(end_ms-start_ms)/1000,1) max_sec FROM video_segments GROUP BY video_id ORDER BY video_id`)
  console.table(stats)
  await conn.end()
})()
