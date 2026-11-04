import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}

let server: Server;
let baseUrl: string;
let email: string;
let token: string;
let testPool: typeof import('../src/db/pool').pool;

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
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
  email = `battle-rest-${randomUUID()}@example.test`;

  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Arena Test', email, password: 'correct-horse-7' }),
  });
  assert.equal(register.status, 201);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct-horse-7' }),
  });
  const body = await login.json() as ApiEnvelope<{ token: string }>;
  token = body.data.token;
});

after(async () => {
  if (email) await testPool.execute('DELETE FROM users WHERE email = ?', [email]);
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await testPool.end();
});

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

test('arena summary starts empty for a new learner', async () => {
  const response = await fetch(`${baseUrl}/api/battle/summary`, { headers: authHeaders() });
  assert.equal(response.status, 200);
  const body = await response.json() as ApiEnvelope<{
    played: number;
    wins: number;
    losses: number;
    win_rate: number;
    win_streak: number;
  }>;
  assert.equal(body.data.played, 0);
  assert.equal(body.data.wins, 0);
  assert.equal(body.data.win_rate, 0);
});

