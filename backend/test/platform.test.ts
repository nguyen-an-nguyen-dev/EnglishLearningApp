import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}

let server: Server;
let baseUrl: string;
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
});

after(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await testPool.end();
});

test('health endpoint reports database readiness and security headers', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('permissions-policy') ?? '', /camera=\(\)/);
  assert.match(response.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);
  const body = await response.json() as { success: boolean; data: { status: string } };
  assert.equal(body.success, true);
  assert.equal(body.data.status, 'ok');
});

test('errors carry the same request id as the response header', async () => {
  const response = await fetch(`${baseUrl}/api/does-not-exist`);
  assert.equal(response.status, 404);
  const headerId = response.headers.get('x-request-id');
  assert.ok(headerId);
  const body = await response.json() as { success: boolean; message: string; requestId: string };
  assert.equal(body.success, false);
  assert.equal(body.requestId, headerId);
  assert.match(body.message, /Route not found/);
});

test('a caller-supplied request id is echoed for tracing', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { 'X-Request-ID': 'trace-1234' },
  });
  assert.equal(response.headers.get('x-request-id'), 'trace-1234');
});
