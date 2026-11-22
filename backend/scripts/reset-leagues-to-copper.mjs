import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import mysql from 'mysql2/promise';

const tiers = ['coal','copper','iron','gold','redstone','lapis','diamond'];
const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'english_learning', charset: 'utf8mb4',
});
function sqlValue(value) {
  if (value === null) return 'NULL';
  if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
  if (value instanceof Date) return `CONVERT(X'${Buffer.from(value.toISOString().slice(0,19).replace('T',' ')).toString('hex')}' USING utf8mb4)`;
  if (typeof value === 'number') return String(value);
  return `CONVERT(X'${Buffer.from(String(value)).toString('hex')}' USING utf8mb4)`;
}
function inserts(table, rows) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  return rows.map((row) => `INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(',')}) VALUES (${columns.map((c) => sqlValue(row[c])).join(',')});`).join('\n');
}
try {
  const [[season]] = await connection.query("SELECT id FROM seasons WHERE status='active' ORDER BY starts_at DESC LIMIT 1");
  const [users] = await connection.query("SELECT * FROM users WHERE role <> 'admin' ORDER BY id");
  const [standings] = season
    ? await connection.query("SELECT st.* FROM season_standings st JOIN users u ON u.id=st.user_id WHERE st.season_id=? AND u.role <> 'admin' ORDER BY st.user_id", [season.id])
    : [[]];
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = resolve('database', 'backups', `league-reset-${stamp}.sql`);
  await mkdir(dirname(backupPath), { recursive: true });
  const backup = [
    '-- Pre-reset backup of users and active season standings. Restore by importing into the same schema.',
    '-- This file contains INSERT statements only and preserves the pre-reset values.',
    inserts('users', users), inserts('season_standings', standings), '',
  ].filter(Boolean).join('\n\n');
  await writeFile(backupPath, backup, { encoding: 'utf8', flag: 'wx' });

  await connection.beginTransaction();
  await connection.execute("UPDATE users SET league_tier='copper' WHERE role <> 'admin'");
  if (season) {
    await connection.execute(
      `UPDATE season_standings st JOIN users u ON u.id=st.user_id
          SET st.tier='copper' WHERE st.season_id=? AND u.role <> 'admin'`,
      [season.id],
    );
  }
  await connection.commit();
  console.log(JSON.stringify({ backup: backupPath, backedUpUsers: users.length, backedUpStandings: standings.length, tiers: tiers.length }));
} catch (error) {
  await connection.rollback();
  console.error('League reset failed. The pre-reset backup, if created, remains available.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
