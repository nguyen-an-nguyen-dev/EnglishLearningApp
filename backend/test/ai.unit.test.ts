import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { parseAiTopic, parseChatId, parseUserMessage } from '../src/modules/ai/ai.validation';
import { HttpError } from '../src/middleware/error-handler';

let ai: typeof import('../src/modules/ai/ai.service');

before(async () => {
  process.env.AI_API_KEY = 'test-only-provider-key';
  ai = await import('../src/modules/ai/ai.service');
});

function providerResponse(content: string, status = 200): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content } }],
  }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('AI chat input validation rejects invalid topics, IDs, empty messages, and oversized messages', () => {
  assert.equal(parseAiTopic('TRAVEL'), 'TRAVEL');
  assert.throws(() => parseAiTopic('INVALID'), (error) => error instanceof HttpError && error.statusCode === 422);
  assert.equal(parseChatId('19'), 19);
  assert.throws(() => parseChatId('0'), (error) => error instanceof HttpError && error.statusCode === 400);
  assert.equal(parseUserMessage({ message: '  Hello!  ' }), 'Hello!');
  assert.throws(() => parseUserMessage({ message: '  ' }), (error) => error instanceof HttpError && error.statusCode === 422);
  assert.throws(
    () => parseUserMessage({ message: 'x'.repeat(2001) }),
    (error) => error instanceof HttpError && error.statusCode === 422,
  );
});

test('AI reply parsing requires concise, typed, non-empty output', () => {
  assert.deepEqual(ai.parseAiReply({
    reply: 'Nice work! What do you like?',
    feedback: [{
      type: 'TENSE',
      original_text: 'I goed',
      corrected_text: 'I went',
      explanation: 'Đây là động từ bất quy tắc ở thì quá khứ.',
    }],
  }).feedback[0], {
    type: 'TENSE',
    original_text: 'I goed',
    corrected_text: 'I went',
    explanation: 'Đây là động từ bất quy tắc ở thì quá khứ.',
  });
  assert.throws(() => ai.parseAiReply({ reply: '', feedback: [] }), (error) => error instanceof HttpError && error.statusCode === 502);
  assert.throws(
    () => ai.parseAiReply({ reply: 'Hello', feedback: [{ type: 'UNKNOWN' }] }),
    (error) => error instanceof HttpError && error.statusCode === 502,
  );
  assert.throws(() => ai.providerMessageContent({ choices: [] }), (error) => error instanceof HttpError && error.statusCode === 502);
});

test('AI provider maps successful, empty, invalid, rate-limit, unavailable, network, and timeout results', async () => {
  const originalFetch = globalThis.fetch;
  const requestMessages = [{ role: 'user' as const, content: 'I goed to school.' }];
  try {
    globalThis.fetch = (async () => providerResponse(JSON.stringify({ reply: 'Good effort! Where did you go?', feedback: [] }))) as typeof fetch;
    assert.equal((await ai.requestAi(requestMessages)).reply, 'Good effort! Where did you go?');

    globalThis.fetch = (async () => providerResponse(JSON.stringify({ reply: '  ', feedback: [] }))) as typeof fetch;
    await assert.rejects(ai.requestAi(requestMessages), (error) => error instanceof HttpError && error.statusCode === 502);

    globalThis.fetch = (async () => new Response('not json', { status: 200 })) as typeof fetch;
    await assert.rejects(ai.requestAi(requestMessages), (error) => error instanceof HttpError && error.statusCode === 502);

    globalThis.fetch = (async () => providerResponse('', 429)) as typeof fetch;
    await assert.rejects(ai.requestAi(requestMessages), (error) => error instanceof HttpError && error.statusCode === 429);

    globalThis.fetch = (async () => providerResponse('', 401)) as typeof fetch;
    await assert.rejects(
      ai.requestAi(requestMessages),
      (error) => error instanceof HttpError && error.statusCode === 503 && error.message.includes('API key'),
    );

    globalThis.fetch = (async () => providerResponse('', 400)) as typeof fetch;
    await assert.rejects(
      ai.requestAi(requestMessages),
      (error) => error instanceof HttpError && error.statusCode === 503 && error.message.includes('AI_MODEL'),
    );

    globalThis.fetch = (async () => providerResponse('', 503)) as typeof fetch;
    await assert.rejects(ai.requestAi(requestMessages), (error) => error instanceof HttpError && error.statusCode === 503);

    globalThis.fetch = (async () => { throw new TypeError('network error'); }) as typeof fetch;
    await assert.rejects(ai.requestAi(requestMessages), (error) => error instanceof HttpError && error.statusCode === 503);

    globalThis.fetch = (async () => {
      const error = new Error('timeout');
      error.name = 'TimeoutError';
      throw error;
    }) as typeof fetch;
    await assert.rejects(ai.requestAi(requestMessages), (error) => error instanceof HttpError && error.statusCode === 504);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
