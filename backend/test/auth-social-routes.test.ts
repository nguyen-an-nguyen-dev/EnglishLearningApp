import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}
process.env.GOOGLE_CLIENT_ID = 'route-test-google.apps.googleusercontent.com';

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

let server: Server;
let baseUrl: string;
let testPool: typeof import('../src/db/pool').pool;
let originalFetch: typeof fetch;
const createdEmails: string[] = [];

const profiles: Record<string, { sub: string; email: string; name: string }> = {};

function installProviderMock(): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      const token = decodeURIComponent(url.split('id_token=')[1] ?? '');
      const profile = profiles[token];
      if (!profile) return new Response('{}', { status: 400 });
      return Response.json({
        aud: process.env.GOOGLE_CLIENT_ID,
        iss: 'accounts.google.com',
        sub: profile.sub,
        email: profile.email,
        email_verified: 'true',
        name: profile.name,
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;
}

async function registerUser(name: string, email: string): Promise<{ id: number; token: string }> {
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
  return { id: body.data!.user.id, token: loginBody.data!.token };
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

before(async () => {
  originalFetch = globalThis.fetch;
  installProviderMock();
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
  for (const email of createdEmails) {
    await testPool.execute('DELETE FROM users WHERE email = ?', [email]);
  }
  globalThis.fetch = originalFetch;
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await testPool.end();
});

test('social routes expose links, link, unlink and reject takeover', async () => {
  const email = `route-owner-${randomUUID()}@example.test`;
  const owner = await registerUser('Route Owner', email);

  profiles['route-token'] = {
    sub: `google-${randomUUID()}`,
    email,
    name: 'Route Link',
  };

  const empty = await call<{ providers: unknown[] }>('/api/auth/providers/links', owner.token);
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.data!.providers, []);

  const linked = await call<{ providers: Array<{ provider: string; email: string }> }>(
    '/api/auth/providers/google/link',
    owner.token,
    { method: 'POST', body: { credential: 'route-token' } },
  );
  assert.equal(linked.status, 200, JSON.stringify(linked.body));
  assert.equal(linked.body.data!.providers.length, 1);
  assert.equal(linked.body.data!.providers[0].provider, 'google');

  const list = await call<{ providers: unknown[] }>('/api/auth/providers/links', owner.token);
  assert.equal(list.body.data!.providers.length, 1);

  const unlinked = await call<{ providers: unknown[] }>('/api/auth/providers/google', owner.token, {
    method: 'DELETE',
  });
  assert.equal(unlinked.status, 200);
  assert.deepEqual(unlinked.body.data!.providers, []);

  // Logging in with a different provider identity after unlink must not create
  // or take over anything: its email belongs to no local account, so a new one
  // is created instead of touching the owner.
  profiles['route-login'] = {
    sub: `google-${randomUUID()}`,
    email: `social-${randomUUID()}@example.test`,
    name: 'Route Social',
  };
  createdEmails.push(profiles['route-login'].email);
  const social = await call<{ token: string; user: { id: number; has_password: boolean } }>(
    '/api/auth/google',
    null,
    { method: 'POST', body: { credential: 'route-login' } },
  );
  assert.equal(social.status, 200, JSON.stringify(social.body));
  assert.equal(social.body.data!.user.has_password, false);

  // An existing password account with the same email must be refused.
  profiles['route-takeover'] = {
    sub: `google-${randomUUID()}`,
    email,
    name: 'Attacker',
  };
  const takeover = await call('/api/auth/google', null, {
    method: 'POST',
    body: { credential: 'route-takeover' },
  });
  assert.equal(takeover.status, 409);
  assert.deepEqual(takeover.body.errors, ['ACCOUNT_EXISTS_LINK_REQUIRED']);
});

test('provider link endpoints require a valid session', async () => {
  const anonymous = await call('/api/auth/providers/links', null);
  assert.equal(anonymous.status, 401);
  const anonymousLink = await call('/api/auth/providers/google/link', null, {
    method: 'POST',
    body: { credential: 'route-token' },
  });
  assert.equal(anonymousLink.status, 401);
});
