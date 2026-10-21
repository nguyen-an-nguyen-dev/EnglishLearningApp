import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

const sqlPath = path.resolve('database/seed.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');
const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'sapassword',
  database: process.env.DB_NAME || 'english_learning',
  multipleStatements: true,
});

await conn.query(sql);
const [rows] = await conn.query(`
  SELECT l.code, q.sort_order, q.question_type, q.audio_url, a.answer_text
  FROM questions q
  JOIN lessons l ON l.id = q.lesson_id
  LEFT JOIN answers a ON a.question_id = q.id AND a.is_correct = 1
  WHERE q.question_type = 'listening'
  ORDER BY l.code
`);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
