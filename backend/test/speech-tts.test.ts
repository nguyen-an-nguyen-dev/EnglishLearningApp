import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpError } from '../src/middleware/error-handler';
import {
  CACHE_MAX_BYTES,
  cachedClipBytes,
  escapeSsmlText,
  rememberClip,
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
