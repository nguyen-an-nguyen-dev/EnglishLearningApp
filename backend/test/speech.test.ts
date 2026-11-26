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
const originalJwtSecret = env.jwtSecret;
const originalSpeechModel = env.speechModel;
const originalAssemblyKey = env.assemblyAiApiKey;
const originalAssemblyBase = env.assemblyAiBaseUrl;
const originalTimeout = env.speechTimeoutMs;
const originalPoll = env.speechPollIntervalMs;

beforeEach(() => {
  env.assemblyAiApiKey = 'assemblyai-test';
  env.assemblyAiBaseUrl = 'https://api.assemblyai.test';
  env.speechModel = 'assemblyai-stt-3-7';
  env.speechTimeoutMs = 5000;
  env.speechPollIntervalMs = 1;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  env.jwtSecret = originalJwtSecret;
  env.speechModel = originalSpeechModel;
  env.assemblyAiApiKey = originalAssemblyKey;
  env.assemblyAiBaseUrl = originalAssemblyBase;
  env.speechTimeoutMs = originalTimeout;
  env.speechPollIntervalMs = originalPoll;
});

function audio(bytes = 16): Buffer {
  return Buffer.alloc(bytes, 1);
}

interface MockOverrides {
  text?: string;
  language?: string;
  modelUsed?: string;
  words?: Array<{ text: string; start: number; end: number }>;
  transcriptError?: string;
  uploadResponse?: Response;
  createResponse?: Response;
  alwaysProcessing?: boolean;
}

interface SeenCall {
  url: string;
  init?: RequestInit;
  body?: unknown;
}

function mockAssemblyAi(overrides: MockOverrides = {}): SeenCall[] {
  const calls: SeenCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const call: SeenCall = { url, init };
    calls.push(call);
    if (url.endsWith('/v2/upload')) {
      return overrides.uploadResponse ?? Response.json({ upload_url: 'https://cdn.assemblyai.test/upload/clip' });
    }
    if (url.endsWith('/v2/transcript')) {
      if (init?.body) call.body = JSON.parse(String(init.body));
      return overrides.createResponse ?? Response.json({ id: 'tr_test', status: 'queued' });
    }
    if (url.includes('/v2/transcript/tr_test')) {
      if (overrides.alwaysProcessing) return Response.json({ status: 'processing' });
      if (overrides.transcriptError) return Response.json({ status: 'error', error: overrides.transcriptError });
      return Response.json({
        status: 'completed',
        text: overrides.text ?? '  Open the leaderboard.  ',
        language_code: overrides.language ?? 'en',
        speech_model_used: overrides.modelUsed ?? 'assemblyai-stt-3-7',
        audio_duration: 1.3,
        words: overrides.words ?? [
          { text: 'Open', start: 0, end: 300 },
          { text: 'the', start: 350, end: 600 },
          { text: 'leaderboard', start: 650, end: 1300 },
        ],
      });
    }
    throw new Error('unexpected URL: ' + url);
  }) as typeof fetch;
  return calls;
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

test('AssemblyAI uploads the clip, submits the model and polls for the transcript', async () => {
  const calls = mockAssemblyAi();

  const result = await transcribeSpeech(audio(), 'audio/webm', 'en');
  assert.deepEqual(result, {
    text: 'Open the leaderboard.',
    language: 'en',
    provider: 'assemblyai',
    model: 'assemblyai-stt-3-7',
  });

  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, 'https://api.assemblyai.test/v2/upload');
  assert.equal(calls[1].url, 'https://api.assemblyai.test/v2/transcript');
  assert.equal(calls[2].url, 'https://api.assemblyai.test/v2/transcript/tr_test');

  const uploadHeaders = calls[0].init?.headers as Record<string, string>;
  assert.equal(uploadHeaders.authorization, 'assemblyai-test');
  assert.equal(uploadHeaders['content-type'], 'application/octet-stream');

  assert.deepEqual(calls[1].body, {
    audio_url: 'https://cdn.assemblyai.test/upload/clip',
    speech_models: ['assemblyai-stt-3-7'],
    punctuate: true,
    format_text: true,
    language_code: 'en',
  });
  const pollHeaders = calls[2].init?.headers as Record<string, string>;
  assert.equal(pollHeaders.authorization, 'assemblyai-test');
});

test('AssemblyAI detects the language when the request does not specify one', async () => {
  const calls = mockAssemblyAi({ language: 'vi' });
  const result = await transcribeSpeech(audio(), 'audio/wav');
  assert.equal(result?.language, 'vi');
  const submit = calls.find((call) => call.url.endsWith('/v2/transcript'));
  assert.deepEqual(submit?.body, {
    audio_url: 'https://cdn.assemblyai.test/upload/clip',
    speech_models: ['assemblyai-stt-3-7'],
    punctuate: true,
    format_text: true,
    language_detection: true,
  });
});

test('the lab can switch to Universal-3.5 Pro', async () => {
  const calls = mockAssemblyAi({ modelUsed: 'universal-3-5-pro' });
  const result = await transcribeSpeech(audio(), 'audio/webm', 'vi', 'universal-3-5-pro');
  assert.equal(result?.model, 'universal-3-5-pro');
  const submit = calls.find((call) => call.url.endsWith('/v2/transcript'));
  assert.deepEqual((submit?.body as { speech_models: string[] }).speech_models, ['universal-3-5-pro']);
});

test('the realtime model is rejected by the HTTP endpoint', async () => {
  let called = false;
  globalThis.fetch = (async () => { called = true; return Response.json({}); }) as typeof fetch;
  await assert.rejects(
    () => transcribeSpeech(audio(), 'audio/webm', 'en', 'assemblyai-stt-3-7-realtime'),
    (error) => error instanceof HttpError && error.statusCode === 422 && /WebSocket/.test(error.message),
  );
  assert.equal(called, false);
});

test('a lab request without an API key fails with a clear message', async () => {
  env.assemblyAiApiKey = '';
  let called = false;
  globalThis.fetch = (async () => { called = true; return Response.json({}); }) as typeof fetch;
  await assert.rejects(
    () => transcribeSpeech(audio(), 'audio/webm', 'en', 'assemblyai-stt-3-7'),
    (error) => error instanceof HttpError && error.statusCode === 503 && /ASSEMBLYAI_API_KEY/.test(error.message),
  );
  assert.equal(called, false);
});

test('an upstream 401 is reported as a provider error, not an app session error', async () => {
  mockAssemblyAi({
    createResponse: Response.json({ error: 'Authentication error, API token missing/invalid' }, { status: 401 }),
  });
  await assert.rejects(
    () => transcribeSpeech(audio(), 'audio/webm', 'en'),
    (error) => error instanceof HttpError && error.statusCode === 503 && /API key/.test(error.message),
  );
});

test('a failed transcript reports the provider reason', async () => {
  mockAssemblyAi({ transcriptError: 'Bad audio: unsupported codec' });
  await assert.rejects(
    () => transcribeSpeech(audio(), 'audio/webm', 'en'),
    (error) => error instanceof HttpError && error.statusCode === 422 && /unsupported codec/.test(error.message),
  );
});

test('polling gives up instead of hanging forever', async () => {
  env.speechTimeoutMs = 30;
  mockAssemblyAi({ alwaysProcessing: true });
  await assert.rejects(
    () => transcribeSpeech(audio(), 'audio/webm', 'en'),
    (error) => error instanceof HttpError && error.statusCode === 504,
  );
});

test('silence from AssemblyAI is a valid "no speech" answer', async () => {
  mockAssemblyAi({ text: '   ' });
  assert.equal(await transcribeSpeech(audio(), 'audio/wav', 'en'), null);
});

test('a missing API key surfaces a configuration error for every app voice turn', async () => {
  env.assemblyAiApiKey = '';
  let called = false;
  globalThis.fetch = (async () => { called = true; return Response.json({}); }) as typeof fetch;
  await assert.rejects(
    () => transcribeSpeech(audio(), 'audio/wav'),
    (error) => error instanceof HttpError && error.statusCode === 503 && /ASSEMBLYAI_API_KEY/.test(error.message),
  );
  assert.equal(called, false);
});

test('speaking practice aligns reference words and uses AssemblyAI timestamps', async () => {
  mockAssemblyAi({
    text: 'We drink tea',
    words: [
      { text: 'We', start: 0, end: 200 },
      { text: 'drink', start: 900, end: 1200 },
      { text: 'tea', start: 1400, end: 1500 },
    ],
  });
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
    mockAssemblyAi({ text: '' });
    const result = await originalFetch(url, {
      method: 'POST', headers: { 'Content-Type': 'audio/wav', Authorization: `Bearer ${token}` }, body,
    });
    assert.equal(result.status, 422);
    assert.equal((await result.json() as { code: string }).code, 'NO_SPEECH');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});