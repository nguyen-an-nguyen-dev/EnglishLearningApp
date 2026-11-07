const path = require('path')
const { createRequire } = require('module')
const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const backendRequire = createRequire(path.join(ROOT, 'backend/package.json'))
const mysql = backendRequire('mysql2/promise')
const dotenv = backendRequire('dotenv')
dotenv.config({ path: path.join(ROOT, 'backend/.env') })
;(async () => {
  const conn = await mysql.createConnection({ host: 'localhost', port: 3306, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME || 'english_learning' })
  const [v] = await conn.query('SELECT id, COUNT(*) n FROM video_segments GROUP BY id')
  void v
  const [per] = await conn.query(`SELECT v.id, v.title, COUNT(s.id) n,
      ROUND(AVG(CHAR_LENGTH(s.text_en))) avg_chars,
      SUM(CHAR_LENGTH(s.text_en) - CHAR_LENGTH(REPLACE(s.text_en,' ','')) + 1 > 9) long_lines
    FROM video_lessons v LEFT JOIN video_segments s ON s.video_id = v.id
    GROUP BY v.id ORDER BY v.id`)
  console.table(per)
  const [total] = await conn.query('SELECT COUNT(*) n FROM video_segments')
  console.log('total segments:', total[0].n)
  await conn.end()
})()
