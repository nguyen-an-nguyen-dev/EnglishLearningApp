import assert from 'node:assert/strict';
import { test } from 'node:test';
import { env } from '../src/config/env';
import { decideBuddyRoute } from '../src/modules/ai/ai.decisions';

function decisionResponse(choice: string, confidence: number): Response {
  return new Response(JSON.stringify({ answers: { route: { choice, confidence } } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function withDecisionFetch<T>(
  handler: (body: Record<string, unknown>) => Response,
  run: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const originalKey = env.aiApiKey;
  const originalEnabled = env.aiDecisionEnabled;
  env.aiApiKey = 'test-only-decision-key';
  env.aiDecisionEnabled = true;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    return handler(body);
  }) as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
    env.aiApiKey = originalKey;
    env.aiDecisionEnabled = originalEnabled;
  }
}

test('the Google decision gate sees the question and picks a direct navigation', async () => {
  let sent: Record<string, unknown> | null = null;
  const result = await withDecisionFetch((body) => {
    sent = body;
    return decisionResponse('navigate', 0.93);
  }, () => decideBuddyRoute('Mở bảng xếp hạng', 'chat', { tab: 'rankings' }));

  assert.deepEqual(result, { route: 'navigate', confidence: 0.93, confident: true });
  assert.ok(sent, 'the decision model must be called');
  const input = String((sent as Record<string, unknown>).input);
  assert.match(input, /MESSAGE: Mở bảng xếp hạng/);
  assert.match(input, /INTENT: chat/);
  assert.match(input, /SCREEN: rankings/);
  const questions = (sent as Record<string, unknown>).questions as Record<string, { criteria: Record<string, string> }>;
  assert.deepEqual(Object.keys(questions), ['route']);
  assert.ok(questions.route.criteria.navigate.length > 0);
  assert.ok(questions.route.criteria.open_prompt.length > 0);
});

test('a low-confidence or malformed choice never forces a route', async () => {
  const unsure = await withDecisionFetch(
    () => decisionResponse('navigate', 0.42),
    () => decideBuddyRoute('Chào bạn', 'chat', null),
  );
  assert.deepEqual(unsure, { route: 'navigate', confidence: 0.42, confident: false });

  const malformed = await withDecisionFetch(
    () => decisionResponse('teleport', 0.99),
    () => decideBuddyRoute('Chào bạn', 'chat', null),
  );
  assert.equal(malformed, null);
});

test('a disabled or failing gate keeps the deterministic fallback', async () => {
  const originalEnabled = env.aiDecisionEnabled;
  env.aiDecisionEnabled = false;
  try {
    assert.equal(await decideBuddyRoute('Mở Video', 'chat', null), null);
  } finally {
    env.aiDecisionEnabled = originalEnabled;
  }

  await withDecisionFetch(
    () => new Response('down', { status: 503 }),
    async () => {
      assert.equal(await decideBuddyRoute('Mở Video', 'chat', null), null);
    },
  );
});
