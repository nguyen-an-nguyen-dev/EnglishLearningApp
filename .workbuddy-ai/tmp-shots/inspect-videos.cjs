const path = require('path')
const { createRequire } = require('module')
const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const backendRequire = createRequire(path.join(ROOT, 'backend/package.json'))
const mysql = backendRequire('mysql2/promise')
const dotenv = backendRequire('dotenv')
dotenv.config({ path: path.join(ROOT, 'backend/.env') })
;(async () => {
  const conn = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME || 'english_learning' })
  const [videos] = await conn.query(`SELECT v.id, v.title, v.video_url, v.duration_seconds, v.cefr_level, v.topic, v.owner_user_id,
      (SELECT COUNT(*) FROM video_segments s WHERE s.video_id = v.id) AS segments,
      (SELECT COUNT(*) FROM video_vocabulary w WHERE w.video_id = v.id) AS vocab
    FROM video_lessons v ORDER BY v.owner_user_id IS NULL DESC, v.duration_seconds ASC`)
  console.table(videos)
  const [segs] = await conn.query(`SELECT s.video_id, s.sort_order, s.start_ms, s.end_ms, s.text_en FROM video_segments s
    WHERE s.video_id = (SELECT id FROM video_lessons WHERE owner_user_id IS NULL ORDER BY duration_seconds ASC LIMIT 1)
    ORDER BY s.sort_order LIMIT 5`)
  console.log(JSON.stringify(segs, null, 1))
  await conn.end()
})()
