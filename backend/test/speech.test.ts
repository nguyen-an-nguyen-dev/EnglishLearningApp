import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { env } from '../src/config/env';
import { HttpError } from '../src/middleware/error-handler';
import { measurePacing } from '../src/modules/speech/speech.practice';
import { practiceSpeech, transcribeSpeech } from '../src/modules/speech/speech.service';
import {
  cleanTranscript,
  parseSpeechAudio,
  parseSpeechMimeType,
} from '../src/modules/speech/speech.validation';

const originalFetch = globalThis.fetch;
const originalAccounts = env.cfAccounts;
const originalApiKey = env.aiApiKey;
const originalJwtSecret = env.jwtSecret;

beforeEach(() => {
  env.cfAccounts = [];
  env.aiApiKey = '';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  env.cfAccounts = originalAccounts;
  env.aiApiKey = originalApiKey;
  env.jwtSecret = originalJwtSecret;
});

function audio(bytes = 16): Buffer {
  return Buffer.alloc(bytes, 1);
}

function whisperResponse(text: string, language = 'en'): Response {
  return Response.json({
    result: {
      text,
      transcription_info: { language, duration: 2 },
    },
  });
}

function geminiResponse(text: string): Response {
  return Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
}

test('audio content types are normalised and unsupported types rejected', () => {
  assert.equal(parseSpeechMimeType('audio/webm;codecs=opus'), 'audio/webm');
  assert.equal(parseSpeechMimeType('Audio/WAV'), 'audio/wav');
  assert.equal(parseSpeechMimeType('audio/mp4'), 'audio/mp4');
  assert.throws(() => parseSpeechMimeType(undefined), (e) => e instanceof HttpError && e.statusCode === 415);
  assert.throws(() => parseSpeechMimeType('text/plain'), (e) => e instanceof HttpError && e.statusCode === 415);
  assert.throws(() => parseSpeechMimeType('video/webm'), (e) => e instanceof HttpError && e.statusCode === 415);
});

test('an empty or oversized clip is rejected before any provider call', () => {
  assert.throws(
    () => parseSpeechAudio(Buffer.alloc(0), 100),
    (e) => e instanceof HttpError && e.statusCode === 400,
  );
  assert.throws(
    () => parseSpeechAudio(Buffer.alloc(101, 1), 100),
    (e) => e instanceof HttpError && e.statusCode === 413,
  );
  assert.equal(parseSpeechAudio(audio(4), 100).length, 4);
});

test('transcripts are collapsed, stripped of punctuation-only noise and capped', () => {
  assert.equal(cleanTranscript('  mở   bảng xếp hạng  '), 'mở bảng xếp hạng');
  assert.equal(cleanTranscript(' . '), '');
  assert.equal(cleanTranscript('!!!'), '');
  assert.equal(cleanTranscript(undefined), '');
  assert.equal(cleanTranscript('a'.repeat(600)).length, 500);
});

test('whisper transcribes raw audio and reports its language', async () => {
  env.cfAccounts = [{ apiKey: 'cf-test', apiUrl: 'https://api.cloudflare.test/client/v4/accounts/acc/ai/v1/chat/completions' }];
  let seenUrl = '';
  let seenType = '';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seenUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    seenType = String((init?.headers as Record<string, string>)?.['Content-Type'] ?? '');
    return whisperResponse('  Mở bảng xếp hạng.  ', 'vi');
  }) as typeof fetch;

  const result = await transcribeSpeech(audio(), 'audio/webm');
  assert.deepEqual(result, { text: 'Mở bảng xếp hạng.', language: 'vi', provider: 'whisper' });
  assert.equal(seenUrl, 'https://api.cloudflare.test/client/v4/accounts/acc/ai/run/@cf/openai/whisper-large-v3-turbo');
  assert.equal(seenType, 'audio/webm');
});

test('silence from whisper is a valid "no speech" answer, not an error', async () => {
  env.cfAccounts = [{ apiKey: 'cf-test', apiUrl: 'https://api.cloudflare.test/accounts/acc/ai/v1/chat/completions' }];
  globalThis.fetch = (async () => whisperResponse('   ')) as typeof fetch;
  assert.equal(await transcribeSpeech(audio(), 'audio/wav'), null);
});

test('an exhausted worker account fails over to Gemini audio', async () => {
  env.cfAccounts = [{ apiKey: 'cf-test', apiUrl: 'https://api.cloudflare.test/accounts/acc/ai/v1/chat/completions' }];
  env.aiApiKey = 'gemini-test';
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    if (url.includes('api.cloudflare.test')) {
      return new Response(JSON.stringify({ errors: [{ code: 4006, message: 'daily free allocation exhausted' }] }), { status: 429 });
    }
    return geminiResponse('mở bảng xếp hạng');
  }) as typeof fetch;

  const result = await transcribeSpeech(audio(), 'audio/mp4');
  assert.deepEqual(result, { text: 'mở bảng xếp hạng', language: null, provider: 'gemini' });
  assert.equal(calls.length, 2);
});

test('gemini alone is enough when Workers AI has no account', async () => {
  env.aiApiKey = 'gemini-test';
  globalThis.fetch = (async () => geminiResponse('ôn tập')) as typeof fetch;
  const result = await transcribeSpeech(audio(), 'audio/ogg');
  assert.deepEqual(result, { text: 'ôn tập', language: null, provider: 'gemini' });
});

test('every provider failing surfaces one actionable error', async () => {
  env.cfAccounts = [{ apiKey: 'cf-test', apiUrl: 'https://api.cloudflare.test/accounts/acc/ai/v1/chat/completions' }];
  env.aiApiKey = 'gemini-test';
  globalThis.fetch = (async () => new Response('down', { status: 503 })) as typeof fetch;
  await assert.rejects(
    transcribeSpeech(audio(), 'audio/wav'),
    (error) => error instanceof HttpError && error.statusCode === 503,
  );
});

test('no provider configured returns silence instead of a fake transcript', async () => {
  globalThis.fetch = (async () => { throw new Error('should not be called'); }) as typeof fetch;
  assert.equal(await transcribeSpeech(audio(), 'audio/wav'), null);
});

test('speaking practice aligns reference words and uses real Whisper timestamps', async () => {
  env.cfAccounts = [{ apiKey: 'cf-speaking', apiUrl: 'https://api.cloudflare.test/accounts/acc/ai/v1/chat/completions' }];
  globalThis.fetch = (async () => Response.json({ result: {
    text: 'We drink tea',
    segments: [{ words: [
      { word: 'We', start: 0, end: 0.2 },
      { word: 'drink', start: 0.9, end: 1.2 },
      { word: 'tea', start: 1.4, end: 1.5 },
    ] }],
  } })) as typeof fetch;
  const result = await practiceSpeech(audio(), 'audio/wav', 'We drink hot tea.');
  assert.equal(result?.transcript, 'We drink tea');
  assert.equal(result?.completeness, 0.75);
  assert.deepEqual(result?.words.map(({ status }) => status), ['matched', 'matched', 'missing', 'matched']);
  assert.deepEqual(result?.pacing, {
    wordsPerMinute: 120,
    pauses: [{ afterWord: 'We', beforeWord: 'drink', seconds: 0.7 }],
  });
  assert.equal(measurePacing([{ word: 'one', start: 0, end: 0.2 }]), null);
});

test('fallback transcripts have feedback but no invented timing, and silence gives no result', async () => {
  env.aiApiKey = 'gemini-test';
  globalThis.fetch = (async () => geminiResponse('I have tea')) as typeof fetch;
  const result = await practiceSpeech(audio(), 'audio/wav', 'I have coffee');
  assert.equal(result?.pacing, null);
  assert.deepEqual(result?.words.at(-1), { word: 'coffee', heard: 'tea', status: 'different' });
  globalThis.fetch = (async () => geminiResponse('')) as typeof fetch;
  assert.equal(await practiceSpeech(audio(), 'audio/wav', 'I have coffee'), null);
});

test('practice returns NO_SPEECH with HTTP 422 and requires authentication', async () => {
  const [{ default: express }, { default: jwt }, { speechRouter }, { getVerifiedJwtSecret }, { errorHandler }] =
    await Promise.all([
      import('express'), import('jsonwebtoken'), import('../src/modules/speech/speech.routes'),
      import('../src/modules/auth/auth.service'), import('../src/middleware/error-handler'),
    ]);
  const { once } = await import('node:events');
  const app = express();
  app.use('/api/speech', speechRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/api/speech/practice?text=Have+a+seat`;
    const body = new Uint8Array(audio());
    const denied = await originalFetch(url, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body });
    assert.equal(denied.status, 401);
    env.jwtSecret = 'local-test-only-speech-signing-secret';
    const token = jwt.sign({ sub: '1' }, getVerifiedJwtSecret());
    env.aiApiKey = 'test-silence';
    globalThis.fetch = (async () => geminiResponse('')) as typeof fetch;
    const result = await originalFetch(url, {
      method: 'POST', headers: { 'Content-Type': 'audio/wav', Authorization: `Bearer ${token}` }, body,
    });
    assert.equal(result.status, 422);
    assert.equal((await result.json() as { code: string }).code, 'NO_SPEECH');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
