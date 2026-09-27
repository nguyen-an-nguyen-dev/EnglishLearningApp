import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import type { RowDataPacket } from 'mysql2';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}

let server: Server;
let baseUrl: string;
let email: string;
let userId: number;
let testPool: typeof import('../src/db/pool').pool;

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
  email = `auth-test-${randomUUID()}@example.test`;
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

test('authentication API validates credentials and protects /me with JWT', async () => {
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Learner', email, password: 'correct-horse-7' }),
  });
  assert.equal(register.status, 201);
  const registered = await register.json() as { success: boolean; data: { user: { id: number; name: string; email: string; xp: number; streak: number } } };
  assert.equal(registered.success, true);
  assert.deepEqual(registered.data.user, {
    id: registered.data.user.id,
    name: 'Test Learner',
    email,
    xp: 0,
    streak: 0,
  });
  userId = registered.data.user.id;

  const duplicate = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Duplicate', email: email.toUpperCase(), password: 'correct-horse-7' }),
  });
  assert.equal(duplicate.status, 409);

  const invalidEmail = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bad Email', email: 'not-an-email', password: 'password' }),
  });
  assert.equal(invalidEmail.status, 422);

  const shortPassword = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Short Password', email: `short-${randomUUID()}@example.test`, password: '12345' }),
  });
  assert.equal(shortPassword.status, 422);

  const [storedRows] = await testPool.execute<RowDataPacket[]>(
    'SELECT password_hash FROM users WHERE id = ?',
    [userId],
  );
  assert.match(String(storedRows[0].password_hash), /^\$2[aby]\$12\$/);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct-horse-7' }),
  });
  assert.equal(login.status, 200);
  const loggedIn = await login.json() as { success: boolean; data: { token: string; user: { id: number } } };
  assert.equal(loggedIn.success, true);
  assert.equal(loggedIn.data.user.id, userId);
  const claims = jwt.decode(loggedIn.data.token);
  assert.ok(claims && typeof claims === 'object');
  assert.deepEqual(Object.keys(claims).sort(), ['exp', 'iat', 'sub']);

  const wrongPassword = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'incorrect-password' }),
  });
  assert.equal(wrongPassword.status, 401);

  const unknownUser = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `missing-${randomUUID()}@example.test`, password: 'correct-horse-7' }),
  });
  assert.equal(unknownUser.status, 401);

  const missingToken = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(missingToken.status, 401);

  const invalidToken = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: 'Bearer not-a-jwt' },
  });
  assert.equal(invalidToken.status, 401);

  const expiredToken = jwt.sign({}, process.env.JWT_SECRET!, { subject: String(userId), expiresIn: -1 });
  const expired = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  assert.equal(expired.status, 401);

  const currentUser = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${loggedIn.data.token}` },
  });
  assert.equal(currentUser.status, 200);
  const me = await currentUser.json() as { success: boolean; data: { user: { id: number; email: string } } };
  assert.equal(me.success, true);
  assert.deepEqual(me.data.user, { id: userId, name: 'Test Learner', email, xp: 0, streak: 0 });
});