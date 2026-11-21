import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import type { RowDataPacket } from 'mysql2';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

let server: Server;
let baseUrl: string;
let testPool: typeof import('../src/db/pool').pool;
let adminToken: string;
let learnerToken: string;
let adminId: number;
let learnerId: number;
const createdEmails: string[] = [];

async function registerUser(name: string): Promise<{ id: number; token: string; email: string }> {
  const email = `users-${randomUUID()}@example.test`;
  createdEmails.push(email);
  const registered = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: 'correct-horse-7' }),
  });
  assert.equal(registered.status, 201);
  const body = await registered.json() as Envelope<{ user: { id: number } }>;
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct-horse-7' }),
  });
  assert.equal(login.status, 200);
  const loginBody = await login.json() as Envelope<{ token: string }>;
  return { id: body.data!.user.id, token: loginBody.data!.token, email };
}

async function call<T>(
  path: string,
  token: string | null,
  options: { method?: string; body?: unknown } = {},
): Promise<{ status: number; body: Envelope<T> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: response.status, body: await response.json() as Envelope<T> };
}

function collectKeys(value: unknown, keys: Set<string>): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, keys);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    keys.add(key);
    collectKeys(entry, keys);
  }
}

before(async () => {
  const [{ app }, db] = await Promise.all([
    import('../src/app'),
    import('../src/db/pool'),
  ]);
  testPool = db.pool;
  server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server failed to bind.');
  baseUrl = `http://127.0.0.1:${address.port}`;

  const admin = await registerUser('User Admin');
  const learner = await registerUser('Managed Learner');
  adminId = admin.id;
  learnerId = learner.id;
  adminToken = admin.token;
  learnerToken = learner.token;
  await testPool.execute("UPDATE users SET role = 'admin' WHERE id = ?", [adminId]);
});

after(async () => {
  for (const email of createdEmails) {
    await testPool.execute('DELETE FROM users WHERE email = ?', [email]);
  }
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await testPool.end();
});

test('user management requires admin and never returns password fields', async () => {
  const anonymous = await call('/api/admin/users', null);
  assert.equal(anonymous.status, 401);

  const learner = await call('/api/admin/users', learnerToken);
  assert.equal(learner.status, 403);

  const listed = await call<{ users: Array<Record<string, unknown>>; total: number }>(
    '/api/admin/users',
    adminToken,
  );
  assert.equal(listed.status, 200);
  assert.ok(listed.body.data!.total >= 2);
  assert.ok(listed.body.data!.users.some((user) => user.id === learnerId));

  const keys = new Set<string>();
  collectKeys(listed.body.data!.users, keys);
  for (const forbidden of ['password', 'password_hash', 'passwordHash']) {
    assert.ok(!keys.has(forbidden), `response leaked ${forbidden}`);
  }
});

test('admin can adjust XP, RC, streak, race points and role', async () => {
  await testPool.execute(
    "UPDATE users SET xp = 10, coins = 5, streak = 2, last_activity_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE id = ?",
    [learnerId],
  );

  const updated = await call<{ user: Record<string, unknown> }>(
    `/api/admin/users/${learnerId}`,
    adminToken,
    {
      method: 'PATCH',
      body: { xp: 750, coins: 1234, streak: 9, race_points: 88 },
    },
  );
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  const user = updated.body.data!.user as {
    xp: number; coins: number; streak: number; race_points: number; level: number; role: string;
  };
  assert.equal(user.xp, 750);
  assert.equal(user.coins, 1234);
  assert.equal(user.streak, 9);
  assert.equal(user.race_points, 88);
  assert.equal(user.role, 'learner');
  assert.ok(user.level >= 2);

  const [rows] = await testPool.execute<Array<RowDataPacket & {
    xp: number; coins: number; streak: number; race_points: number;
  }>>(
    `SELECT u.xp, u.coins, u.streak, COALESCE(ss.race_points, 0) AS race_points
       FROM users u
       LEFT JOIN season_standings ss ON ss.user_id = u.id
        AND ss.season_id = (SELECT id FROM seasons WHERE status = 'active' ORDER BY starts_at DESC LIMIT 1)
      WHERE u.id = ?`,
    [learnerId],
  );
  assert.equal(Number(rows[0].xp), 750);
  assert.equal(Number(rows[0].coins), 1234);
  assert.equal(Number(rows[0].streak), 9);
  assert.equal(Number(rows[0].race_points), 88);

  const [ledger] = await testPool.execute<Array<RowDataPacket & { currency: string; amount: number }>>(
    "SELECT currency, amount FROM economy_ledger WHERE user_id = ? AND source_type = 'admin_adjustment' ORDER BY id",
    [learnerId],
  );
  assert.deepEqual(
    ledger.map((row) => [row.currency, Number(row.amount)]),
    [['xp', 740], ['rc', 1229], ['rp', 88]],
  );

  const promoted = await call<{ user: { role: string } }>(
    `/api/admin/users/${learnerId}`,
    adminToken,
    { method: 'PATCH', body: { role: 'admin' } },
  );
  assert.equal(promoted.status, 200);
  assert.equal(promoted.body.data!.user.role, 'admin');

  const demoted = await call<{ user: { role: string } }>(
    `/api/admin/users/${learnerId}`,
    adminToken,
    { method: 'PATCH', body: { role: 'learner' } },
  );
  assert.equal(demoted.status, 200);
  assert.equal(demoted.body.data!.user.role, 'learner');
});

test('user management rejects password edits and self-demotion', async () => {
  const passwordEdit = await call(`/api/admin/users/${learnerId}`, adminToken, {
    method: 'PATCH',
    body: { password: 'hacked-123', xp: 50 },
  });
  assert.equal(passwordEdit.status, 422);
  assert.deepEqual(passwordEdit.body.errors, ['PROTECTED_FIELD']);

  const selfDemotion = await call(`/api/admin/users/${adminId}`, adminToken, {
    method: 'PATCH',
    body: { role: 'learner' },
  });
  assert.equal(selfDemotion.status, 422);
  assert.deepEqual(selfDemotion.body.errors, ['CANNOT_DEMOTE_SELF']);

  const search = await call<{ users: Array<{ id: number }> }>(
    `/api/admin/users?search=${encodeURIComponent('Managed Learner')}`,
    adminToken,
  );
  assert.equal(search.status, 200);
  assert.deepEqual(search.body.data!.users.map((entry) => entry.id), [learnerId]);
});
