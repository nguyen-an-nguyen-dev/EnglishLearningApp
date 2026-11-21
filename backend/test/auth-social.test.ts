import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import type { RowDataPacket } from 'mysql2';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}
// The provider verifier reads these at module load, so set them before the
// dynamic imports inside before().
process.env.GOOGLE_CLIENT_ID = 'test-google-client.apps.googleusercontent.com';
process.env.FACEBOOK_APP_ID = 'test-facebook-app';
// The local .env may configure a real secret. The mocked Graph API below has no
// debug_token endpoint, so keep the optional app-bound token check off in tests.
// Set it to an empty value (not `delete`): env.ts runs dotenv again and would
// restore a deleted key from .env.
process.env.FACEBOOK_APP_SECRET = '';

type AuthService = typeof import('../src/modules/auth/auth.service');
type AuthRepository = typeof import('../src/modules/auth/auth.repository');
type Pool = typeof import('../src/db/pool').pool;

let auth: AuthService;
let authRepo: AuthRepository;
let testPool: Pool;
let originalFetch: typeof fetch;
const createdEmails: string[] = [];

interface GoogleProfileInput {
  sub?: string;
  email?: string;
  name?: string;
  emailVerified?: string;
}

function mockGoogleTokens(tokens: Record<string, GoogleProfileInput>): void {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      const token = decodeURIComponent(url.split('id_token=')[1] ?? '');
      const profile = tokens[token];
      if (!profile) return new Response('{}', { status: 400 });
      return Response.json({
        aud: process.env.GOOGLE_CLIENT_ID,
        iss: 'accounts.google.com',
        sub: profile.sub,
        email: profile.email,
        email_verified: profile.emailVerified ?? 'true',
        name: profile.name ?? 'Google Tester',
      });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as typeof fetch;
}

function mockFacebookTokens(tokens: Record<string, { id?: string; email?: string; name?: string }>): void {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('https://graph.facebook.com/me')) {
      const token = decodeURIComponent(url.split('access_token=')[1] ?? '').split('&')[0];
      const profile = tokens[token];
      if (!profile) return new Response('{}', { status: 400 });
      return Response.json({
        id: profile.id,
        email: profile.email,
        name: profile.name ?? 'Facebook Tester',
        picture: { data: { url: 'https://example.test/avatar.png' } },
      });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as typeof fetch;
}

async function expectHttpError(
  operation: Promise<unknown>,
  status: number,
  code?: string,
): Promise<void> {
  try {
    await operation;
    assert.fail('Expected an HttpError.');
  } catch (error) {
    const value = error as { statusCode?: number; errors?: string[] };
    assert.equal(value.statusCode, status, JSON.stringify(error));
    if (code) assert.ok(value.errors?.includes(code), JSON.stringify(value.errors));
  }
}

async function register(email: string, name = 'Social Tester'): Promise<{ id: number; email: string }> {
  createdEmails.push(email);
  const user = await auth.register({ name, email, password: 'correct-horse-7' });
  return { id: user.id, email: user.email };
}

async function providerCount(email: string): Promise<number> {
  const [rows] = await testPool.execute<Array<RowDataPacket & { total: number }>>(
    'SELECT COUNT(*) AS total FROM user_providers WHERE email = ?',
    [email],
  );
  return Number(rows[0]?.total ?? 0);
}

before(async () => {
  originalFetch = globalThis.fetch;
  const [service, repository, db] = await Promise.all([
    import('../src/modules/auth/auth.service'),
    import('../src/modules/auth/auth.repository'),
    import('../src/db/pool'),
  ]);
  auth = service;
  authRepo = repository;
  testPool = db.pool;
});

after(async () => {
  globalThis.fetch = originalFetch;
  for (const email of createdEmails) {
    await testPool.execute('DELETE FROM users WHERE email = ?', [email]);
  }
  await testPool.end();
});

test('provider login never takes over an existing password account', async () => {
  const email = `victim-${randomUUID()}@example.test`;
  const victim = await register(email, 'Victim Account');
  const passwordLogin = await auth.login({ email, password: 'correct-horse-7' });
  assert.equal(passwordLogin.user.id, victim.id);

  mockGoogleTokens({
    'google-victim': { sub: `google-${randomUUID()}`, email, name: 'Attacker' },
  });

  await expectHttpError(
    auth.loginWithProvider('google', 'google-victim'),
    409,
    'ACCOUNT_EXISTS_LINK_REQUIRED',
  );
  assert.equal(await providerCount(email), 0);

  // The victim can still sign in and no provider identity was attached.
  const stillWorks = await auth.login({ email, password: 'correct-horse-7' });
  assert.equal(stillWorks.user.id, victim.id);
  assert.equal(stillWorks.user.has_password, true);
});

test('a new social identity creates exactly one account and reuses it', async () => {
  const email = `social-new-${randomUUID()}@example.test`;
  const sub = `google-${randomUUID()}`;
  createdEmails.push(email);
  mockGoogleTokens({
    'google-new': { sub, email, name: 'New Social User' },
  });

  const first = await auth.loginWithProvider('google', 'google-new');
  assert.ok(first.token);
  assert.equal(first.user.email, email);
  assert.equal(first.user.has_password, false);
  assert.equal(await providerCount(email), 1);

  const second = await auth.loginWithProvider('google', 'google-new');
  assert.equal(second.user.id, first.user.id);
  assert.equal(await providerCount(email), 1);

  // A different provider identity with the same email must not log in.
  mockGoogleTokens({
    'google-other': { sub: `google-${randomUUID()}`, email, name: 'Impostor' },
  });
  await expectHttpError(
    auth.loginWithProvider('google', 'google-other'),
    409,
    'ACCOUNT_EXISTS_LINK_REQUIRED',
  );
  assert.equal(await providerCount(email), 1);
});

test('linking requires a signed-in owner and rejects identity conflicts', async () => {
  const firstEmail = `link-a-${randomUUID()}@example.test`;
  const secondEmail = `link-b-${randomUUID()}@example.test`;
  const first = await register(firstEmail, 'Link Owner');
  const second = await register(secondEmail, 'Other Owner');
  const sub = `google-${randomUUID()}`;
  mockGoogleTokens({
    'google-link': { sub, email: firstEmail, name: 'Link Me' },
  });

  const linked = await auth.linkProvider(first.id, 'google', 'google-link');
  assert.equal(linked.providers.length, 1);
  assert.equal(linked.providers[0].provider, 'google');

  // The identity now logs into the owner, not the other user.
  const login = await auth.loginWithProvider('google', 'google-link');
  assert.equal(login.user.id, first.id);

  await expectHttpError(
    auth.linkProvider(second.id, 'google', 'google-link'),
    409,
    'PROVIDER_ALREADY_LINKED',
  );

  // A user can hold only one identity per provider.
  mockGoogleTokens({
    'google-other-slot': { sub: `google-${randomUUID()}`, email: `other-${randomUUID()}@example.test` },
  });
  await expectHttpError(
    auth.linkProvider(first.id, 'google', 'google-other-slot'),
    409,
    'PROVIDER_SLOT_TAKEN',
  );

  const unlinked = await auth.unlinkProvider(first.id, 'google');
  assert.equal(unlinked.length, 0);
  await expectHttpError(auth.unlinkProvider(first.id, 'google'), 404);
});

test('explicit linking only accepts the mailbox that owns the account', async () => {
  const email = `link-same-${randomUUID()}@example.test`;
  const user = await register(email, 'Mailbox Owner');
  const foreignEmail = `foreign-${randomUUID()}@example.test`;

  mockGoogleTokens({
    'google-foreign': { sub: `google-${randomUUID()}`, email: foreignEmail },
  });
  await expectHttpError(
    auth.linkProvider(user.id, 'google', 'google-foreign'),
    409,
    'PROVIDER_EMAIL_MISMATCH',
  );

  mockFacebookTokens({
    'fb-foreign': { id: `fb-${randomUUID()}`, email: foreignEmail },
  });
  await expectHttpError(
    auth.linkProvider(user.id, 'facebook', 'fb-foreign'),
    409,
    'PROVIDER_EMAIL_MISMATCH',
  );
  assert.equal(await providerCount(foreignEmail), 0);

  // Email matching is case-insensitive, and a matching identity links fine.
  mockGoogleTokens({
    'google-same-email': { sub: `google-${randomUUID()}`, email: email.toUpperCase() },
  });
  const linked = await auth.linkProvider(user.id, 'google', 'google-same-email');
  assert.equal(linked.providers.length, 1);
  assert.equal(linked.providers[0].provider, 'google');
  assert.equal(linked.providers[0].email, email);
  await auth.unlinkProvider(user.id, 'google');
});

test('a social-only account must set a password before removing its last provider', async () => {
  const email = `social-only-${randomUUID()}@example.test`;
  createdEmails.push(email);
  mockGoogleTokens({
    'google-only': { sub: `google-${randomUUID()}`, email, name: 'Social Only' },
  });
  const session = await auth.loginWithProvider('google', 'google-only');
  assert.equal(session.user.has_password, false);

  await expectHttpError(
    auth.unlinkProvider(session.user.id, 'google'),
    409,
    'LAST_LOGIN_METHOD',
  );

  await auth.changePassword(session.user.id, { currentPassword: '', newPassword: 'brand-new-7' });
  const afterSet = await auth.getCurrentUser(session.user.id);
  assert.equal(afterSet.has_password, true);

  const passwordLogin = await auth.login({ email, password: 'brand-new-7' });
  assert.equal(passwordLogin.user.id, session.user.id);

  const providers = await auth.unlinkProvider(session.user.id, 'google');
  assert.equal(providers.length, 0);
});

test('facebook identities follow the same provider rules', async () => {
  const email = `fb-${randomUUID()}@example.test`;
  createdEmails.push(email);
  mockFacebookTokens({
    'fb-token': { id: `fb-${randomUUID()}`, email, name: 'Facebook User' },
  });

  const session = await auth.loginWithProvider('facebook', 'fb-token');
  assert.equal(session.user.email, email);
  assert.equal(session.user.has_password, false);
  const providers = await authRepo.listProvidersForUser(session.user.id);
  assert.equal(providers[0].provider, 'facebook');

  mockFacebookTokens({ 'fb-no-email': { id: `fb-${randomUUID()}` } });
  await expectHttpError(auth.loginWithProvider('facebook', 'fb-no-email'), 401);
});

test('malformed provider tokens are rejected before touching the database', async () => {
  await expectHttpError(auth.loginWithProvider('google', ''), 422);
  mockGoogleTokens({});
  await expectHttpError(auth.loginWithProvider('google', 'not-a-real-token'), 401);
});
