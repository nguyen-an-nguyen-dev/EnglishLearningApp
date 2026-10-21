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
let profileEmails: string[] = [];
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
  for (const profileEmail of profileEmails) {
    await testPool.execute('DELETE FROM users WHERE email = ?', [profileEmail]);
  }
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

test('profile and password updates persist and re-authenticate', async () => {
  const accountEmail = `profile-${randomUUID()}@example.test`;
  profileEmails.push(accountEmail);
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Before Change', email: accountEmail, password: 'correct-horse-7' }),
  });
  assert.equal(register.status, 201);
  const { data: registered } = await register.json() as { data: { user: { id: number } } };

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: accountEmail, password: 'correct-horse-7' }),
  });
  assert.equal(login.status, 200);
  const { data: { token } } = await login.json() as { data: { token: string } };
  const auth = { Authorization: `Bearer ${token}` };

  // Reject malformed email and empty name.
  const badProfile = await fetch(`${baseUrl}/api/auth/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ name: '  ', email: 'not-an-email' }),
  });
  assert.equal(badProfile.status, 422);

  // Reject email already owned by another account.
  const takenEmail = await fetch(`${baseUrl}/api/auth/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ name: 'Impostor', email }),
  });
  assert.equal(takenEmail.status, 409);

  // Successful name + email change.
  const newEmail = `profile-${randomUUID()}@example.test`;
  profileEmails.push(newEmail);
  const updated = await fetch(`${baseUrl}/api/auth/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ name: 'After Change', email: newEmail }),
  });
  assert.equal(updated.status, 200);
  const { data: profileData } = await updated.json() as { data: { user: { id: number; name: string; email: string } } };
  assert.equal(profileData.user.id, registered.user.id);
  assert.equal(profileData.user.name, 'After Change');
  assert.equal(profileData.user.email, newEmail);

  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: auth });
  const { data: meData } = await me.json() as { data: { user: { name: string; email: string } } };
  assert.equal(meData.user.name, 'After Change');
  assert.equal(meData.user.email, newEmail);

  // Wrong current password is rejected.
  const wrongCurrent = await fetch(`${baseUrl}/api/auth/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ currentPassword: 'wrong-password', newPassword: 'brand-new-7' }),
  });
  assert.equal(wrongCurrent.status, 401);

  // Too-short new password is rejected.
  const shortNew = await fetch(`${baseUrl}/api/auth/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ currentPassword: 'correct-horse-7', newPassword: '123' }),
  });
  assert.equal(shortNew.status, 422);

  // Successful password change; old password stops working, new one works.
  const changed = await fetch(`${baseUrl}/api/auth/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ currentPassword: 'correct-horse-7', newPassword: 'brand-new-7' }),
  });
  assert.equal(changed.status, 200);

  const oldLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: newEmail, password: 'correct-horse-7' }),
  });
  assert.equal(oldLogin.status, 401);

  const newLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: newEmail, password: 'brand-new-7' }),
  });
  assert.equal(newLogin.status, 200);
});