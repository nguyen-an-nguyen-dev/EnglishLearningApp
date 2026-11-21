import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createConnection } from 'mysql2/promise';

/**
 * Tiny migration runner for this project (no migration framework is bundled).
 * Read one .sql file, split on statement terminators, execute in order.
 *
 *   npx tsx scripts/apply-migration.ts database/migrations/2026-11-19-content-social.sql
 */
function statements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((chunk) =>
      chunk
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter(Boolean);
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npx tsx scripts/apply-migration.ts <path-to.sql>');
    process.exit(1);
  }

  const sql = await readFile(resolve(process.cwd(), file), 'utf8');
  const connection = await createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'english_learning',
    multipleStatements: false,
  });

  const list = statements(sql);
  try {
    for (const [index, statement] of list.entries()) {
      await connection.query(statement);
      console.log(`ok ${index + 1}/${list.length}: ${statement.slice(0, 72).replace(/\s+/g, ' ')}`);
    }
    console.log(`Applied ${list.length} statement(s) from ${file}.`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
