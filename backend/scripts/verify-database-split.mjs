import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const sourceDatabase = process.env.DB_SOURCE_NAME || process.env.DB_NAME || 'english_learning';
const scratchDatabase = process.argv[2] || process.env.DB_VERIFY_NAME || 'english_learning_verify';
const keepScratch = process.argv.includes('--keep') || process.env.DB_VERIFY_KEEP === '1';
const connectionOptions = {
  host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', charset: 'utf8mb4',
};
function splitSql(source) {
  const statements = [];
  let start = 0; let quote = ''; let lineComment = false; let blockComment = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]; const next = source[i + 1];
    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i += 1; } continue; }
    if (quote) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === quote) { if (next === quote) { i += 1; continue; } quote = ''; }
      continue;
    }
    if (ch === '-' && next === '-' && (source[i + 2] === ' ' || source[i + 2] === '\t' || source[i + 2] === '\r' || source[i + 2] === '\n')) { lineComment = true; i += 1; continue; }
    if (ch === '#') { lineComment = true; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === ';') { const text = source.slice(start, i).trim(); if (text) statements.push(text); start = i + 1; }
  }
  const tail = source.slice(start).trim(); if (tail) statements.push(tail);
  return statements;
}
async function rowCounts(connection, database) {
  const [tables] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema=? AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME`,
    [database],
  );
  const counts = new Map();
  for (const { TABLE_NAME: table } of tables) {
    const [[row]] = await connection.query(`SELECT COUNT(*) AS n FROM \`${database.replace(/`/g, '``')}\`.\`${table.replace(/`/g, '``')}\``);
    counts.set(table, Number(row.n));
  }
  return counts;
}
let connection;
try {
  const [initSql, seedSql] = await Promise.all([
    readFile('database/init.sql', 'utf8'), readFile('database/seeds.sql', 'utf8'),
  ]);
  const seedStatements = splitSql(seedSql).map((statement) => statement
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .trim())
    .filter(Boolean);
  if (seedStatements.some((statement) => !/^INSERT\s+INTO\s/i.test(statement))) {
    throw new Error('seeds.sql must contain INSERT statements only.');
  }
  connection = await mysql.createConnection({ ...connectionOptions, multipleStatements: false });
  await connection.query(`DROP DATABASE IF EXISTS \`${scratchDatabase}\``);
  await connection.query(`CREATE DATABASE \`${scratchDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const scratch = await mysql.createConnection({ ...connectionOptions, database: scratchDatabase, multipleStatements: false });
  try {
    const schemaStatements = splitSql(initSql)
      .filter((statement) => !/^CREATE\s+DATABASE\b/i.test(statement) && !/^USE\b/i.test(statement));
    for (const statement of schemaStatements) await scratch.query(statement);
    for (const statement of seedStatements) await scratch.query(statement);
    const expected = await rowCounts(connection, sourceDatabase);
    const actual = await rowCounts(scratch, scratchDatabase);
    const [[tierRows]] = await connection.query(
      `SELECT COUNT(*) AS learners,
              SUM(league_tier='coal') AS coal, SUM(league_tier='copper') AS copper,
              SUM(league_tier='iron') AS iron, SUM(league_tier='gold') AS gold,
              SUM(league_tier IN ('redstone', 'lapis')) AS redstone,
              SUM(league_tier='diamond') AS diamond
         FROM \`${sourceDatabase.replace(/`/g, '``')}\`.users WHERE role='learner'`,
    );
    const names = [...new Set([...expected.keys(), ...actual.keys()])].sort();
    const mismatches = names.filter((name) => expected.get(name) !== actual.get(name));
    console.log(JSON.stringify({
      sourceDatabase, scratchDatabase, tablesCompared: names.length,
      sourceRows: [...expected.values()].reduce((sum, count) => sum + count, 0),
      scratchRows: [...actual.values()].reduce((sum, count) => sum + count, 0),
      learnersByTier: tierRows,
      mismatches: mismatches.map((table) => ({ table, source: expected.get(table) ?? null, scratch: actual.get(table) ?? null })),
    }, null, 2));
    if (mismatches.length) process.exitCode = 1;
  } finally {
    await scratch.end();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (connection) {
    try { if (!keepScratch) await connection.query(`DROP DATABASE IF EXISTS \`${scratchDatabase}\``); }
    finally { await connection.end(); }
  }
}

