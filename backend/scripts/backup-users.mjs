import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'english_learning',
  charset: 'utf8mb4',
});

try {
  const [rows] = await connection.query('SELECT * FROM users ORDER BY id');
  if (!rows.length) throw new Error('Refusing to write an empty users backup.');
  const columns = Object.keys(rows[0]);
  const insertRows = rows.map((row) => {
    const values = columns.map((column) => {
      const value = row[column];
      if (value === null) return 'NULL';
      if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
      if (value instanceof Date) {
        const formatted = value.toISOString().slice(0, 19).replace('T', ' ');
        return `CONVERT(X'${Buffer.from(formatted).toString('hex')}' USING utf8mb4)`;
      }
      if (typeof value === 'number') return String(value);
      return `CONVERT(X'${Buffer.from(String(value)).toString('hex')}' USING utf8mb4)`;
    });
    return `INSERT INTO users (${columns.map((column) => `\`${column}\``).join(',')}) VALUES (${values.join(',')});`;
  });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = resolve('database', 'backups', `users-before-avatar-migration-${stamp}.sql`);
  await mkdir(dirname(backupPath), { recursive: true });
  await writeFile(backupPath, [
    '-- Pre-migration backup of users. Restore by importing into the same schema.',
    `-- Rows: ${rows.length}`,
    ...insertRows,
    '',
  ].join('\n'), { encoding: 'utf8', flag: 'wx' });
  console.log(JSON.stringify({ backup: backupPath, rows: rows.length }));
} finally {
  await connection.end();
}
