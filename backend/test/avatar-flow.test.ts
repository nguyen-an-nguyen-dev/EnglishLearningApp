import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}

let server: Server;
let baseUrl: string;
let testPool: typeof import('../src/db/pool').pool;
const email = `avatar-flow-${randomUUID()}@example.test`;
let uploadedPath: string | null = null;

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

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
  await testPool.execute('DELETE FROM users WHERE email = ?', [email]);
  if (uploadedPath) await rm(uploadedPath, { force: true });
  if (server?.listening) {
    await new Promise<void>((done, fail) => {
      server.close((error) => error ? fail(error) : done());
    });
  }
  await testPool.end();
});

test('a learner can change their avatar without Cloudinary and /media serves the new image', async () => {
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Avatar Learner', email, password: 'correct-horse-7' }),
  });
  assert.equal(register.status, 201);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct-horse-7' }),
  });
  assert.equal(login.status, 200);
  const loggedIn = await login.json() as { data: { token: string } };
  const token = loggedIn.data.token;

  const form = new FormData();
  form.append('avatar', new Blob([png], { type: 'image/png' }), 'avatar.png');
  const upload = await fetch(`${baseUrl}/api/auth/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(upload.status, 200);
  const body = await upload.json() as { data: { user: { avatar_url: string } } };
  const url = body.data.user.avatar_url;
  assert.match(url, /^\/media\/avatars\/user-\d+-[\da-f-]+\.png$/);
  uploadedPath = resolve(process.cwd(), 'public', 'avatars', url.split('/').pop() as string);

  const image = await fetch(`${baseUrl}${url}`);
  assert.equal(image.status, 200);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);

  // The saved URL is what every avatar surface reads, so this is also what
  // makes the sidebar profile-container refresh after a change.
  const me = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meBody = await me.json() as { data: { user: { avatar_url: string } } };
  assert.equal(meBody.data.user.avatar_url, url);
});
