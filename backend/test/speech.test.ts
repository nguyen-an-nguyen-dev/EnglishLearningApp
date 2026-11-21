import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { env } from '../src/config/env';
import { HttpError } from '../src/middleware/error-handler';
import { transcribeSpeech } from '../src/modules/speech/speech.service';
import {
  cleanTranscript,
  parseSpeechAudio,
  parseSpeechMimeType,
} from '../src/modules/speech/speech.validation';

const originalFetch = globalThis.fetch;
const originalAccounts = env.cfAccounts;
const originalApiKey = env.aiApiKey;

beforeEach(() => {
  env.cfAccounts = [];
  env.aiApiKey = '';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  env.cfAccounts = originalAccounts;
  env.aiApiKey = originalApiKey;
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
