import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

const file = process.argv[2] ?? 'database/migration_6_lessons.sql';
const sql = await readFile(path.resolve(process.cwd(), file), 'utf8');

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'english_learning',
  multipleStatements: true,
  charset: 'utf8mb4',
});

try {
  await connection.query(sql);
  console.log(`Applied ${file}`);
} finally {
  await connection.end();
}
