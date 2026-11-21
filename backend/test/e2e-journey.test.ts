import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';

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
const emails: string[] = [];

async function register(name: string): Promise<{ id: number; token: string; email: string }> {
  const email = `journey-${randomUUID()}@example.test`;
  emails.push(email);
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
  token: string,
  options: { method?: string; body?: unknown } = {},
): Promise<{ status: number; body: Envelope<T> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: response.status, body: await response.json() as Envelope<T> };
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
});

after(async () => {
  for (const email of emails) {
    await testPool.execute('DELETE FROM users WHERE email = ?', [email]);
  }
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await testPool.end();
});

test('learner journey reaches wallet, shop and ranking; admin can adjust progression', async () => {
  const learner = await register('Journey Learner');
  const admin = await register('Journey Admin');
  await testPool.execute("UPDATE users SET role = 'admin' WHERE id = ?", [admin.id]);

  const wallet = await call<{ wallet: { xp: number; coins: number; streak: number; race_points: number } }>(
    '/api/wallet',
    learner.token,
  );
  assert.equal(wallet.status, 200);
  assert.equal(wallet.body.data!.wallet.xp, 0);

  const shop = await call<{ items: unknown[] }>('/api/shop', learner.token);
  assert.equal(shop.status, 200);
  assert.ok(shop.body.data!.items.length > 0);

  const ranking = await call<{
    leaderboard: unknown[];
    league: Array<{ tier?: string | null }>;
    league_tier: string;
    league_rules: { promotion_slots: number; demotion_slots: number };
  }>('/api/ranking', learner.token);
  assert.equal(ranking.status, 200);
  assert.ok(Array.isArray(ranking.body.data!.leaderboard));
  assert.equal(ranking.body.data!.league_tier, 'bronze');
  for (const entry of ranking.body.data!.league) {
    assert.equal(entry.tier, 'bronze', 'the weekly board only contains the learner’s tier');
  }
  assert.deepEqual(ranking.body.data!.league_rules, { promotion_slots: 6, demotion_slots: 6 });

  const listed = await call<{ users: Array<{ id: number; email: string }> }>(
    `/api/admin/users?search=${encodeURIComponent(learner.email)}`,
    admin.token,
  );
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data!.users[0]?.id, learner.id);

  const updated = await call<{ user: { xp: number; coins: number; streak: number; race_points: number } }>(
    `/api/admin/users/${learner.id}`,
    admin.token,
    { method: 'PATCH', body: { xp: 333, coins: 50, streak: 4, race_points: 10 } },
  );
  assert.equal(updated.status, 200, JSON.stringify(updated.body));

  const refreshed = await call<{
    wallet: { xp: number; coins: number; streak: number; race_points: number; tier: string };
  }>(
    '/api/wallet',
    learner.token,
  );
  assert.equal(refreshed.body.data!.wallet.xp, 333);
  assert.equal(refreshed.body.data!.wallet.coins, 50);
  assert.equal(refreshed.body.data!.wallet.streak, 4);
  assert.equal(refreshed.body.data!.wallet.race_points, 10);
  assert.equal(refreshed.body.data!.wallet.tier, 'bronze');

  // The tier is carried, never recomputed from the week's RP: 10 RP with a
  // persistent diamond tier must still report diamond.
  await testPool.execute("UPDATE users SET league_tier = 'diamond' WHERE id = ?", [learner.id]);
  const carried = await call<{ wallet: { tier: string; race_points: number } }>(
    '/api/wallet',
    learner.token,
  );
  assert.equal(carried.status, 200);
  assert.equal(carried.body.data!.wallet.tier, 'diamond');
  assert.equal(carried.body.data!.wallet.race_points, 10);
});
