import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = readdirSync('test')
  .filter((name) => name.endsWith('.test.ts'))
  .map((name) => `test/${name}`);

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', ...files],
  {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
