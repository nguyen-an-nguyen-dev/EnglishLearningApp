const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'final.sql'), 'utf8');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
    charset: 'utf8mb4',
  });
  await conn.query(sql);

  const [listening] = await conn.query(
    `SELECT COUNT(*) AS total, SUM(word_bank IS NOT NULL AND JSON_LENGTH(word_bank) > 0) AS with_bank,
            SUM(audio_url IS NOT NULL) AS with_audio
       FROM questions WHERE question_type = 'listening'`,
  );
  console.log('listening', listening[0]);
  const [sample] = await conn.query(
    `SELECT q.id, l.code, q.sort_order, q.question_text, JSON_LENGTH(q.word_bank) AS bank_size,
            q.word_bank, a.answer_text
       FROM questions q JOIN lessons l ON l.id = q.lesson_id
       LEFT JOIN answers a ON a.question_id = q.id
      WHERE q.question_type = 'listening' ORDER BY q.id LIMIT 3`,
  );
  console.log(JSON.stringify(sample, null, 2));
  const [counts] = await conn.query(
    `SELECT question_type, COUNT(*) AS n FROM questions GROUP BY question_type ORDER BY question_type`,
  );
  console.table(counts);
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
