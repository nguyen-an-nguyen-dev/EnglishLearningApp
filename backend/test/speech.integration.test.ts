import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}

const baseUrl = 'http://127.0.0.1:3000';
let token = '';
const originalFetch = globalThis.fetch;

async function api(path: string, init: RequestInit = {}, authenticated = true): Promise<Response> {
  return originalFetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

async function waitForServer(): Promise<boolean> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await originalFetch(`${baseUrl}/api/health`);
      if (response.ok) return true;
    } catch {
      /* server still booting */
    }
    await delay(250);
  }
  return false;
}

before(async () => {
  const up = await waitForServer();
  if (!up) return;
  const login = await originalFetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'khanhlinh@engorace.demo', password: 'Engorace@2026' }),
  });
  if (login.ok) {
    const body = await login.json() as { data?: { token?: string } };
    token = body.data?.token ?? '';
  }
});

after(() => {
  globalThis.fetch = originalFetch;
});

const skip = () => (token ? false : 'backend not running or demo account missing');

test('speech status advertises the providers without leaking keys', async (t) => {
  if (skip()) return t.skip('no demo session');
  const response = await api('/api/speech/status', {}, false);
  assert.equal(response.status, 200);
  const body = await response.json() as { data: { backend: boolean; maxBytes: number } };
  assert.equal(typeof body.data.backend, 'boolean');
  assert.equal(typeof body.data.maxBytes, 'number');
  assert.equal(JSON.stringify(body).includes('apiKey'), false);
});

test('transcribe rejects a missing session and a non-audio content type', async (t) => {
  if (skip()) return t.skip('no demo session');
  const anonymous = await originalFetch(`${baseUrl}/api/speech/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'audio/webm' },
    body: new Uint8Array([1, 2, 3]),
  });
  assert.equal(anonymous.status, 401);

  const text = await api('/api/speech/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'not audio',
  });
  assert.equal(text.status, 415);
});

test('a real recorded clip is transcribed by the configured provider', async (t) => {
  if (skip()) return t.skip('no demo session');
  const statusBody = await (await api('/api/speech/status', {}, false)).json() as {
    data: { backend: boolean };
  };
  if (!statusBody.data.backend) return t.skip('no transcription provider configured');

  const audio = await originalFetch('https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A1.mp3');
  assert.equal(audio.status, 200, 'fixture audio must be reachable');
  const bytes = new Uint8Array(await audio.arrayBuffer());

  const response = await api('/api/speech/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'audio/mpeg' },
    body: bytes,
  });
  assert.equal(response.status, 200);
  const body = await response.json() as {
    data: { text: string; language: string | null; provider: 'assemblyai'; model: string | null };
  };
  assert.match(body.data.text.toLowerCase(), /good morning/);
  assert.equal(body.data.provider, 'assemblyai');
});
