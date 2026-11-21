import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import type { RowDataPacket } from 'mysql2';

// The suite must never depend on (or touch) a real mailbox, even when the
// developer has SMTP configured in .env: the development echo mode gives the
// test the same code the screen would show.
process.env.SMTP_HOST = '';
process.env.OTP_DEBUG = 'true';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}

let server: Server;
let baseUrl: string;
let testPool: typeof import('../src/db/pool').pool;
const emails: string[] = [];

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
    await testPool.execute('DELETE FROM pending_registrations WHERE email = ?', [email]);
  }
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await testPool.end();
});

async function post(path: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json() as Record<string, unknown>,
  };
}

function dataOf(body: Record<string, unknown>): Record<string, unknown> {
  return (body.data ?? {}) as Record<string, unknown>;
}

async function userCount(email: string): Promise<number> {
  const [rows] = await testPool.execute<RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ?',
    [email],
  );
  // RowDataPacket[] is not a plain array under mysql2's typings here.
  return Array.from(rows).length;
}

test('web registration creates the user only after the emailed code', async () => {
  const email = `otp-${randomUUID()}@example.test`;
  emails.push(email);

  const started = await post('/api/auth/register/start', {
    name: 'OTP Learner',
    email,
    password: 'correct-horse-7',
  });
  assert.equal(started.status, 200);
  const start = dataOf(started.body);
  assert.equal(start.email, email);
  assert.match(String(start.dev_code), /^\d{6}$/);
  assert.equal(await userCount(email), 0, 'no user row before verification');

  const wrong = await post('/api/auth/register/verify', {
    email,
    code: String(start.dev_code) === '000000' ? '111111' : '000000',
  });
  assert.equal(wrong.status, 401);
  assert.ok((wrong.body.errors as string[]).includes('OTP_INVALID'));
  assert.equal(await userCount(email), 0, 'a failed attempt creates nothing');

  const verified = await post('/api/auth/register/verify', {
    email,
    code: start.dev_code,
  });
  assert.equal(verified.status, 201);
  const account = dataOf(verified.body);
  assert.equal(typeof account.token, 'string');
  const user = account.user as Record<string, unknown>;
  assert.equal(user.email, email);
  assert.equal(user.name, 'OTP Learner');
  assert.equal(await userCount(email), 1);

  const [pending] = await testPool.execute<RowDataPacket[]>(
    'SELECT id FROM pending_registrations WHERE email = ?',
    [email],
  );
  assert.equal(Array.from(pending).length, 0, 'the pending row is consumed');

  const duplicate = await post('/api/auth/register/start', {
    name: 'OTP Learner',
    email,
    password: 'correct-horse-7',
  });
  assert.equal(duplicate.status, 409);
});

test('an expired code is rejected and resend has a cooldown', async () => {
  const email = `otp-expiry-${randomUUID()}@example.test`;
  emails.push(email);

  const started = await post('/api/auth/register/start', {
    name: 'Expired Learner',
    email,
    password: 'correct-horse-7',
  });
  assert.equal(started.status, 200);
  const code = String(dataOf(started.body).dev_code);

  const immediateResend = await post('/api/auth/register/resend', { email });
  assert.equal(immediateResend.status, 429);
  assert.ok((immediateResend.body.errors as string[]).includes('OTP_RESEND_COOLDOWN'));

  // Force the pending row into the past instead of waiting ten minutes.
  await testPool.execute(
    'UPDATE pending_registrations SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE email = ?',
    [email],
  );
  const expired = await post('/api/auth/register/verify', { email, code });
  assert.equal(expired.status, 400);
  assert.ok((expired.body.errors as string[]).includes('OTP_EXPIRED'));
  assert.equal(await userCount(email), 0);
});
