import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { MsEdgeTTS } from 'msedge-tts';
import { HttpError } from '../src/middleware/error-handler';
import {
  CACHE_MAX_BYTES,
  cachedClipBytes,
  closeIdleSpeechClients,
  escapeSsmlText,
  rememberClip,
  synthesizeSpeech,
} from '../src/modules/speech/speech.tts';
import { MAX_TTS_CHARS, parseTtsRequest } from '../src/modules/speech/speech.validation';

test('text is XML-escaped before it reaches the SSML template', () => {
  assert.equal(escapeSsmlText(`Tom & Jerry <3 "it's"`), 'Tom &amp; Jerry &lt;3 &quot;it&apos;s&quot;');
});

test('control characters that XML forbids are dropped before escaping', () => {
  assert.equal(escapeSsmlText('a\u0000b\u0007c\u000Bd\u001Fe\tf\ng'), 'abcde\tf\ng');
});

test('a TTS request is trimmed, collapsed and must name a supported language', () => {
  assert.deepEqual(parseTtsRequest({ text: '  hello \n  world ', lang: 'en' }), { text: 'hello world', lang: 'en' });
  assert.deepEqual(parseTtsRequest({ text: 'Xin chào', lang: 'vi' }), { text: 'Xin chào', lang: 'vi' });
  assert.throws(() => parseTtsRequest({ text: '   ', lang: 'en' }), HttpError);
  assert.throws(() => parseTtsRequest({ text: 'hi', lang: 'fr' }), HttpError);
  assert.throws(() => parseTtsRequest(null), HttpError);
});

test('a passage over the limit is refused with TEXT_TOO_LONG', () => {
  assert.equal(MAX_TTS_CHARS, 500);
  assert.doesNotThrow(() => parseTtsRequest({ text: 'a'.repeat(MAX_TTS_CHARS), lang: 'en' }));
  assert.throws(
    () => parseTtsRequest({ text: 'a'.repeat(MAX_TTS_CHARS + 1), lang: 'en' }),
    (error: unknown) =>
      error instanceof HttpError && error.statusCode === 400 && error.errors.includes('TEXT_TOO_LONG'),
  );
});

test('the clip cache evicts the oldest clips once the byte budget is exceeded', () => {
  const clipSize = Math.floor(CACHE_MAX_BYTES / 3);
  rememberClip('budget-a', Buffer.alloc(clipSize));
  rememberClip('budget-b', Buffer.alloc(clipSize));
  rememberClip('budget-c', Buffer.alloc(clipSize));
  assert.ok(cachedClipBytes() <= CACHE_MAX_BYTES);
  rememberClip('budget-d', Buffer.alloc(clipSize));
  assert.ok(cachedClipBytes() <= CACHE_MAX_BYTES);
  assert.equal(cachedClipBytes(), clipSize * 3);
  rememberClip('budget-oversized', Buffer.alloc(CACHE_MAX_BYTES + 1));
  assert.equal(cachedClipBytes(), clipSize * 3);
});

test('distinct clips reuse an idle client for the same voice and replays bypass synthesis', async (t) => {
  t.after(closeIdleSpeechClients);
  const turns: MsEdgeTTS[] = [];
  const closed: MsEdgeTTS[] = [];
  t.mock.method(MsEdgeTTS.prototype, 'setMetadata', async () => undefined);
  t.mock.method(MsEdgeTTS.prototype, 'toStream', function (this: MsEdgeTTS, text: string) {
    turns.push(this);
    return { audioStream: Readable.from([Buffer.from(text)]), metadataStream: null };
  });
  t.mock.method(MsEdgeTTS.prototype, 'close', function (this: MsEdgeTTS) { closed.push(this); });

  const first = await synthesizeSpeech('Reuse fixture one.', 'en');
  await synthesizeSpeech('Giọng đọc kiểm thử.', 'vi');
  await synthesizeSpeech('Reuse fixture two.', 'en');
  assert.equal(await synthesizeSpeech('Reuse fixture one.', 'en'), first);
  assert.equal(turns.length, 3);
  assert.equal(turns[0], turns[2]);
  assert.notEqual(turns[0], turns[1]);
  assert.equal(closed.length, 0);
  closeIdleSpeechClients();
  assert.deepEqual(new Set(closed), new Set(turns));
});

test('concurrent clips use independent clients and a failed reused client is replaced', async (t) => {
  t.after(closeIdleSpeechClients);
  const releaseFirst = Promise.withResolvers<void>();
  const releaseSecond = Promise.withResolvers<void>();
  const turns: MsEdgeTTS[] = [];
  const closed = new Set<MsEdgeTTS>();
  t.mock.method(MsEdgeTTS.prototype, 'setMetadata', async () => undefined);
  t.mock.method(MsEdgeTTS.prototype, 'toStream', function (this: MsEdgeTTS, text: string) {
    turns.push(this);
    const fail = text === 'Retry a stale voice socket.' && this === turns[0];
    const clip = async function* () {
      if (text === 'Parallel voice fixture one.') await releaseFirst.promise;
      if (text === 'Parallel voice fixture two.') await releaseSecond.promise;
      if (fail) throw new Error('Reused voice socket closed');
      yield Buffer.from(text);
    };
    return { audioStream: Readable.from(clip()), metadataStream: null };
  });
  t.mock.method(MsEdgeTTS.prototype, 'close', function (this: MsEdgeTTS) { closed.add(this); });

  const first = synthesizeSpeech('Parallel voice fixture one.', 'en');
  const duplicate = synthesizeSpeech('Parallel voice fixture one.', 'en');
  const second = synthesizeSpeech('Parallel voice fixture two.', 'en');
  try {
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(turns.length, 2);
    assert.notEqual(turns[0], turns[1]);
    assert.equal(closed.size, 0);
    releaseFirst.resolve();
    assert.equal(await first, await duplicate);
    releaseSecond.resolve();
    await second;
  } finally {
    releaseFirst.resolve();
    releaseSecond.resolve();
    await Promise.allSettled([first, duplicate, second]);
  }
  assert.ok(closed.has(turns[1]));

  assert.equal((await synthesizeSpeech('Retry a stale voice socket.', 'en')).toString(), 'Retry a stale voice socket.');
  assert.equal(turns.length, 4);
  assert.equal(turns[2], turns[0]);
  assert.notEqual(turns[3], turns[0]);
  assert.ok(closed.has(turns[0]));
});
