import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { readAiReplyStream } from '../../mobile/services/aiReplyStream';
import { aiDestination, planDestination, replyActions, routeId } from '../../mobile/services/aiDestinations';
import { parseAiTopic, parseChatId, parseChatTurn, parseUserMessage } from '../src/modules/ai/ai.validation';
import { HttpError } from '../src/middleware/error-handler';
import { env } from '../src/config/env';
import { parseAiReply, providerMessageContent } from '../src/modules/ai/ai.parsing';
import { generateReply } from '../src/modules/ai/ai.provider';
import { matchShopItem } from '../src/modules/ai/ai.copilot';
import { parseBuddyCommand } from '../src/modules/ai/ai.commands';
import { exactCatalogueMatches, rankCatalog, videoCatalogueQuery, withinVideoDuration } from '../src/modules/ai/ai.search';
import { explicitLearningIntent, isBriefTutorTurn, isPlainTutorChat } from '../src/modules/ai/ai.intent';
import { isTutorExampleRecall, learningHistoryLimit } from '../src/modules/ai/ai.memory';
import {
  buildOfflineCoachReply,
  buildStudyPlan,
  resolveNavigationRequest,
  resolveChatAction,
  lessonPrerequisites,
  toStudySnapshot,
} from '../src/modules/ai/ai.study';
import type { StudyStats } from '../src/modules/ai/ai.repository';
import type { LearnerContext } from '../src/modules/ai/ai.types';

before(() => {
  env.thApiKey = '';
  env.aiApiKey = 'test-only-provider-key';
  env.aiApiUrl = 'https://provider.example.test/chat/completions';
});

function providerResponse(content: string, status = 200): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content } }],
  }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requestAi(messages: Parameters<typeof generateReply>[0]) {
  return generateReply(messages, { timeoutMs: 1_000 });
}

test('mobile destinations retain order, validate IDs and distinguish locked lessons from playable lessons', () => {
  const lesson = { kind: 'open_lesson', label: '', lessonId: 26, lessonTitle: 'Past Simple' } as const;
  assert.deepEqual(aiDestination(lesson)?.href, { pathname: '/lesson/[id]', params: { id: 26 } });
  assert.deepEqual(aiDestination({ ...lesson, mode: 'reveal' })?.href, { pathname: '/(tabs)', params: { buddyLessonId: 26 } });
  assert.equal(aiDestination({ ...lesson, lessonId: 0 }), null);
  assert.equal(aiDestination({ kind: 'open_review', label: '' })?.href, '/review');
  assert.equal(aiDestination({ kind: 'show_shop_item', label: '', tab: 'shop' }), null);
  assert.equal(routeId('26e2'), null);
  assert.deepEqual(replyActions({ action: lesson }), [lesson]);
  const actions = [{ kind: 'open_notebook', label: 'Sổ từ' }, lesson] as const;
  assert.deepEqual(replyActions({ action: lesson, actions: [...actions] }), actions);
  assert.deepEqual(planDestination({ id: 'video', kind: 'video', title: 'Listening', minutes: 5, reason: '', target: { tab: 'videos', videoId: 2 } })?.href,
    { pathname: '/(tabs)/talk', params: { buddyVideoId: 2, buddyVideoView: '' } });
});

test('the mobile decoder handles fragmented UTF-8, clears drafts and rejects a missing final answer', async () => {
  const encoder = new TextEncoder();
  const final = { userMessage: { id: 1, content: 'What is the past simple?' },
    aiMessage: { id: 2, content: 'Dùng thì quá khứ đơn.' }, feedback: [] };
  const bytes = encoder.encode([
    { type: 'draft', text: 'Dùng thì quá khứ đơn' }, { type: 'draft', text: '' }, { type: 'answer', data: final },
  ].map((event) => JSON.stringify(event)).join('\n'));
  const fragments = new ReadableStream<Uint8Array>({
    start(writer) {
      for (let index = 0; index < bytes.length; index += 3) writer.enqueue(bytes.slice(index, index + 3));
      writer.close();
    },
  });
  const drafts: string[] = [];
  assert.deepEqual(await readAiReplyStream(fragments, (text) => drafts.push(text)), final);
  assert.deepEqual(drafts, ['Dùng thì quá khứ đơn', '']);
  const incomplete = new Response('{"type":"draft","text":"Keep going"}\n');
  await assert.rejects(readAiReplyStream(incomplete.body, () => undefined), /Không tải được/u);
});

test('Bilingual catalogue ranking respects phrases, whole-word coverage and explicit levels', () => {
  const catalogue = [
    { title: 'Past Continuous', topic: 'Grammar', level: 'A2' },
    { title: 'Simple Past Practice', topic: 'Grammar', level: 'A2' },
    { title: 'Grocery Shopping', topic: 'Shopping', level: 'A1' },
    { title: 'Grocery Shopping Dialogue', topic: 'Shopping', level: 'A2' },
    { title: 'Cart Etiquette', topic: 'Shopping', level: 'A2' },
    { title: 'Past Simple Practice', topic: 'Grammar', level: 'A2', completed: true },
  ];
  const titles = (query: string) => rankCatalog(query, catalogue).map(({ item }) => item.title);
  assert.deepEqual(titles('quá khứ đơn'), ['Simple Past Practice', 'Past Simple Practice']);
  assert.deepEqual(titles('đi siêu thị A2'), ['Grocery Shopping Dialogue']);
  assert.deepEqual(titles('art'), []);
  assert.deepEqual(titles('past perfect'), []);
  assert.deepEqual(titles('grocery shopping B2'), []);
});

test('exact video lookup preserves level, ambiguity, and extra requirements', () => {
  const videos = [
    { title: 'Asking prices', topic: 'Grocery shopping', level: 'A2' },
    { title: 'Getting groceries', topic: 'Grocery shopping', level: 'A1' },
  ];
  assert.deepEqual(exactCatalogueMatches('A2 đi siêu thị', videos), [videos[0]]);
  assert.deepEqual(exactCatalogueMatches('đi siêu thị A1', videos), [videos[1]]);
  assert.deepEqual(exactCatalogueMatches('đi siêu thị', videos), videos);
  assert.deepEqual(exactCatalogueMatches('grocery shopping B1', videos), []);
  assert.deepEqual(exactCatalogueMatches('grocery shopping A2 under 5 minutes', videos), []);
});

test('video duration limits preserve strict and inclusive bounds without interpreting extra qualifiers', () => {
  const strict = videoCatalogueQuery('grocery shopping A2 under two minutes');
  const inclusive = videoCatalogueQuery('đi siêu thị A2 không quá 2 phút');
  assert.deepEqual(strict, { topic: 'grocery shopping a2', maxSeconds: 119 });
  assert.deepEqual(inclusive, { topic: 'di sieu thi a2', maxSeconds: 120 });
  assert.equal(withinVideoDuration({ durationSeconds: 120 }, strict?.maxSeconds), false);
  assert.equal(withinVideoDuration({ durationSeconds: 120 }, inclusive?.maxSeconds), true);
  assert.equal(withinVideoDuration({}, inclusive?.maxSeconds), false);
  assert.deepEqual(videoCatalogueQuery('Under the sea'), { topic: 'under the sea' });
  assert.equal(videoCatalogueQuery('grocery shopping under 2 minutes with subtitles'), null);
  assert.equal(videoCatalogueQuery('grocery shopping no less than 2 minutes'), null);
  assert.equal(videoCatalogueQuery('grocery shopping at least 2 minutes'), null);
});

test('Explicit study tasks route locally while uncertain tutor requests can still use classification', () => {
  assert.equal(explicitLearningIntent('Hi, could you give me a practice exercise on the past tense?'), 'practice');
  assert.equal(explicitLearningIntent('Give me one fill-in-the-blank exercise about the past simple.'), 'practice');
  assert.equal(explicitLearningIntent('So sánh hai cách dùng này giúp mình'), 'explain');
  assert.equal(explicitLearningIntent('How do I save words in the vocabulary notebook?'), 'how');
  assert.equal(explicitLearningIntent('Hôm nay mình nên học gì trước?'), 'plan');
  assert.equal(isPlainTutorChat('I went to school yesterday.'), true);
  assert.equal(isPlainTutorChat('Yesterday I goed to school.'), true);
  assert.equal(isPlainTutorChat('Yesterday I went to school. Give me a quiz.'), false);
  assert.equal(isPlainTutorChat('I need help choosing what to study.'), false);
  assert.equal(explicitLearningIntent('Could you take a look at this?'), null);
});

test('tutor recall widens a single example request and keeps compound requests available for routing', () => {
  assert.equal(isTutorExampleRecall('Which sentence did we practice about trains earlier?'), true);
  assert.equal(learningHistoryLimit('Could you repeat the exact sentence we used before?'), 48);
  assert.equal(isTutorExampleRecall('Nhắc lại câu ví dụ về tàu hỏa lúc nãy.'), true);
  assert.equal(isTutorExampleRecall('What example did we use earlier? Open translation.'), false);
  assert.equal(isTutorExampleRecall('Nhắc lại câu ví dụ lúc nãy rồi mở ôn tập lúc nãy.'), false);
  assert.equal(learningHistoryLimit('What did we do after class?'), 10);
});

test('brief tutor mode keeps short practice separate from compound grammar and recall', () => {
  assert.equal(isBriefTutorTurn('Hello!'), true);
  assert.equal(isBriefTutorTurn('Yesterday I goed to school.'), true);
  assert.equal(isBriefTutorTurn('I have lived here for three years.'), true);
  assert.equal(isBriefTutorTurn('I enjoyed it.'), false);
  assert.equal(isBriefTutorTurn('I liked that.'), false);
  assert.equal(isBriefTutorTurn('I tried that lesson.'), false);
  assert.equal(isBriefTutorTurn('I very like this song.'), true);
  assert.equal(isBriefTutorTurn('I walked there after school, but the library closed early.'), false);
  assert.equal(isBriefTutorTurn('I would have gone if I had heard the news.'), false);
  assert.equal(isBriefTutorTurn('What example did we use about trains earlier?'), false);
  assert.equal(isBriefTutorTurn('I remember what we used earlier.'), false);
  assert.equal(isBriefTutorTurn('I went to school yesterday. Explain the past simple.'), false);
  assert.equal(isBriefTutorTurn('I like ' + 'language practice '.repeat(7)), false);
});

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
  assert.deepEqual(parseAiReply({
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
  assert.throws(() => parseAiReply({ reply: '', feedback: [] }), (error) => error instanceof HttpError && error.statusCode === 502);
  assert.throws(
    () => parseAiReply({ reply: 'Hello', feedback: [{ type: 'UNKNOWN' }] }),
    (error) => error instanceof HttpError && error.statusCode === 502,
  );
  assert.throws(() => providerMessageContent({ choices: [] }), (error) => error instanceof HttpError && error.statusCode === 502);
});

test('AI reply parsing keeps a declared highlight and drops an unknown one', () => {
  const withHighlight = parseAiReply({
    reply: 'Mở đấu trường nhé.',
    feedback: [],
    action: { kind: 'open_tab', tab: 'compete', label: '', highlight: 'control:arena-start' },
  });
  assert.equal(withHighlight.action?.highlight, 'control:arena-start');

  const badHighlight = parseAiReply({
    reply: 'Mở đấu trường nhé.',
    feedback: [],
    action: { kind: 'open_tab', tab: 'compete', label: '', highlight: 'body' },
  });
  assert.equal(badHighlight.action?.highlight, undefined);
});

test('AI provider maps successful, empty, invalid, rate-limit, unavailable, network, and timeout results', async () => {
  const originalFetch = globalThis.fetch;
  const requestMessages = [{ role: 'user' as const, content: 'I goed to school.' }];
  try {
    globalThis.fetch = (async () => providerResponse(JSON.stringify({ reply: 'Good effort! Where did you go?', feedback: [] }))) as typeof fetch;
    assert.equal((await requestAi(requestMessages)).reply, 'Good effort! Where did you go?');

    globalThis.fetch = (async () => providerResponse(JSON.stringify({ reply: '  ', feedback: [] }))) as typeof fetch;
    await assert.rejects(requestAi(requestMessages), (error) => error instanceof HttpError && error.statusCode === 502);

    globalThis.fetch = (async () => new Response('not json', { status: 200 })) as typeof fetch;
    await assert.rejects(requestAi(requestMessages), (error) => error instanceof HttpError && error.statusCode === 502);

    globalThis.fetch = (async () => providerResponse('', 429)) as typeof fetch;
    await assert.rejects(requestAi(requestMessages), (error) => error instanceof HttpError && error.statusCode === 429);

    globalThis.fetch = (async () => providerResponse('', 401)) as typeof fetch;
    await assert.rejects(
      requestAi(requestMessages),
      (error) => error instanceof HttpError && error.statusCode === 503 && error.message.includes('API key'),
    );

    globalThis.fetch = (async () => providerResponse('', 400)) as typeof fetch;
    await assert.rejects(
      requestAi(requestMessages),
      (error) => error instanceof HttpError && error.statusCode === 503 && error.message.includes('AI_FALLBACK_MODEL'),
    );

    globalThis.fetch = (async () => providerResponse('', 503)) as typeof fetch;
    await assert.rejects(requestAi(requestMessages), (error) => error instanceof HttpError && error.statusCode === 503);

    globalThis.fetch = (async () => { throw new TypeError('network error'); }) as typeof fetch;
    await assert.rejects(requestAi(requestMessages), (error) => error instanceof HttpError && error.statusCode === 503);

    globalThis.fetch = (async () => {
      const error = new Error('timeout');
      error.name = 'TimeoutError';
      throw error;
    }) as typeof fetch;
    await assert.rejects(requestAi(requestMessages), (error) => error instanceof HttpError && error.statusCode === 504);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Buddy recovers a usable draft with extra prose or a malformed correction', async (t) => {
  const correction = { type: 'TENSE', original_text: 'goed', corrected_text: 'went', explanation: 'Use the past tense of go.' };
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    providerResponse(`Here is the answer: ${JSON.stringify({ reply: 'Use went.', feedback: [{ type: 'UNKNOWN' }, correction] })}`));
  const options = { timeoutMs: 1_000, buddy: true };
  const reply = await generateReply([{ role: 'user', content: 'I goed to school.' }], options);
  assert.equal(reply.reply, 'Use went.');
  assert.deepEqual(reply.feedback, [correction]);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('Buddy accepts complete plain text but never emits incomplete JSON', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => providerResponse('Use went.'));
  const options = { timeoutMs: 1_000, buddy: true };
  assert.equal((await generateReply([], options)).reply, 'Use went.');
  fetchMock.mock.mockImplementation(async () => providerResponse('{"reply":"Use went.'));
  await assert.rejects(generateReply([], options), (error) => error instanceof HttpError && error.statusCode === 502);
});

test('Buddy clears an interrupted preview before returning the fallback reply', async (t) => {
  const previousKey = env.thApiKey;
  const previousUrl = env.thApiUrl;
  env.thApiKey = 'test-only-primary-key';
  env.thApiUrl = 'https://tokenharbor.ai/v1/chat/completions';
  const previews: string[] = [];
  const first = JSON.stringify({ choices: [{ delta: { content: '{"reply":"Use the old draft' } }] });
  const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url !== env.thApiUrl) return providerResponse('{"reply":"Use the fallback.","feedback":[]}');
    assert.equal(JSON.parse(String(options?.body)).stream, true);
    return new Response(`data: ${first}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
  });
  try {
    const reply = await generateReply([], { timeoutMs: 1_500, buddy: true, maxTokens: 480, onDraft: (text) => previews.push(text) });
    assert.equal(reply.reply, 'Use the fallback.');
    assert.deepEqual(previews, ['Use the old draft', '']);
    assert.equal(mock.mock.callCount(), 2);
  } finally {
    env.thApiKey = previousKey;
    env.thApiUrl = previousUrl;
  }
});

test('Short Buddy streams share a deadline with a delayed backup', async (t) => {
  const previousKey = env.thApiKey;
  const previousUrl = env.thApiUrl;
  env.thApiKey = 'test-only-primary-key';
  env.thApiUrl = 'https://tokenharbor.ai/v1/chat/completions';
  t.after(() => {
    env.thApiKey = previousKey;
    env.thApiUrl = previousUrl;
  });
  const options = { timeoutMs: 1_500, buddy: true, maxTokens: 480 };
  const primaryText = 'Use the primary reply.';
  const backupText = 'Use the backup reply.';
  const encoder = new TextEncoder();
  const content = (delta: object) =>
    encoder.encode(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`);
  const done = encoder.encode('data: [DONE]\n\n');
  const response = (first: object, rest: (writer: ReadableStreamDefaultController<Uint8Array>) => Promise<void>) =>
    new Response(new ReadableStream<Uint8Array>({
      async start(writer) {
        writer.enqueue(content(first));
        await rest(writer);
        writer.enqueue(done);
        writer.close();
      },
    }), { headers: { 'Content-Type': 'text/event-stream' } });

  await t.test('real content stops the backup timer while the primary is still writing', async (sub) => {
    const previews: string[] = [];
    const fetchMock = sub.mock.method(globalThis, 'fetch', async () =>
      response({ content: `{"reply":"${primaryText}` }, async (writer) => {
        await delay(800);
        writer.enqueue(content({ content: '","feedback":[]}' }));
      }));
    const reply = await generateReply([], { ...options, onDraft: (text) => previews.push(text) });
    assert.equal(reply.reply, primaryText);
    assert.deepEqual(previews, [primaryText]);
    assert.equal(fetchMock.mock.callCount(), 1);
  });

  await t.test('role, reasoning and blank content leave the backup timer armed', async (sub) => {
    let primarySignal: AbortSignal | undefined;
    const fetchMock = sub.mock.method(globalThis, 'fetch', async (url, init) => {
      if (url !== env.thApiUrl) return providerResponse(backupText);
      primarySignal = init?.signal ?? undefined;
      return response({ role: 'assistant', reasoning_content: 'Working', content: ' ' }, async () => {
        await delay(5_000, undefined, { signal: primarySignal });
      });
    });
    const reply = await generateReply([], { ...options, onDraft: () => undefined });
    assert.equal(reply.reply, backupText);
    assert.equal(fetchMock.mock.callCount(), 2);
    assert.equal(primarySignal?.aborted, true);
  });

  await t.test('a failed backup still lets the primary finish', async (sub) => {
    const fetchMock = sub.mock.method(globalThis, 'fetch', async (url, init) => {
      if (url !== env.thApiUrl) return providerResponse('', 503);
      await delay(850, undefined, { signal: init?.signal ?? undefined });
      return providerResponse(primaryText);
    });
    const reply = await generateReply([], { ...options, onDraft: () => undefined });
    assert.equal(reply.reply, primaryText);
    assert.equal(fetchMock.mock.callCount(), 2);
  });

  await t.test('client aborts cancel a silent primary without launching the backup', async (sub) => {
    const controller = new AbortController();
    const fetchMock = sub.mock.method(globalThis, 'fetch', async (_url, init) => {
      await delay(5_000, undefined, { signal: init?.signal ?? undefined });
      return providerResponse(primaryText);
    });
    const pending = generateReply([], { ...options, signal: controller.signal, onDraft: () => undefined });
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(fetchMock.mock.callCount(), 1);
  });
});

test('Brief tutor streams can recover early without changing the other tutor paths', async (t) => {
  const previous = { thApiKey: env.thApiKey, thApiUrl: env.thApiUrl, thModel: env.thModel };
  Object.assign(env, {
    thApiKey: 'test-tutor-primary', thApiUrl: 'https://tokenharbor.ai/v1/chat/completions', thModel: 'deepseek-v4.1-flash-1017',
  });
  t.after(() => Object.assign(env, previous));
  const correction = { type: 'TENSE', original_text: 'goed', corrected_text: 'went', explanation: 'Dùng went cho quá khứ.' };
  const backupAnswer = () => providerResponse(JSON.stringify({ reply: 'What did you do at school?', feedback: [correction] }));
  const options = { timeoutMs: 1_500, brief: true };

  await t.test('starts the existing tutor fallback while the primary is silent and preserves feedback', async (sub) => {
    let primarySignal: AbortSignal | undefined;
    const mock = sub.mock.method(globalThis, 'fetch', async (url, init) => {
      const body = JSON.parse(String(init?.body));
      if (url !== env.thApiUrl) {
        assert.equal(body.model, env.aiFallbackModel);
        return backupAnswer();
      }
      assert.equal(body.reasoning_effort, 'none');
      primarySignal = init?.signal ?? undefined;
      await delay(5_000, undefined, { signal: primarySignal });
      return providerResponse('Unreachable');
    });
    const answer = await generateReply([], { ...options, onDraft: () => undefined });
    assert.deepEqual(answer.feedback, [correction]);
    assert.equal(mock.mock.callCount(), 2);
    assert.equal(primarySignal?.aborted, true);
  });

  await t.test('standard tutor streams and JSON brief replies wait for the primary', async (sub) => {
    const mock = sub.mock.method(globalThis, 'fetch', async () => {
      await delay(800);
      return backupAnswer();
    });
    await generateReply([], { timeoutMs: options.timeoutMs, onDraft: () => undefined });
    await generateReply([], options);
    assert.equal(mock.mock.callCount(), 2);
  });

  await t.test('clears a losing preview before finalizing the other reply', async (sub) => {
    const backupStarted = Promise.withResolvers<void>();
    const primaryDraft = Promise.withResolvers<void>();
    const oldDraft = 'I have a different question.';
    const drafts: string[] = [];
    const mock = sub.mock.method(globalThis, 'fetch', async (url, init) => {
      const expiry = delay(5_000, undefined, { signal: init?.signal ?? undefined }).then(() => {
        throw new Error('Test provider did not reach the expected stream state');
      });
      if (url !== env.thApiUrl) {
        backupStarted.resolve();
        await Promise.race([primaryDraft.promise, expiry]);
        return backupAnswer();
      }
      await Promise.race([backupStarted.promise, expiry]);
      const delta = { choices: [{ delta: { content: `{"reply":"${oldDraft}` } }] };
      return new Response(new ReadableStream({
        start(writer) {
          writer.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(delta)}\n\n`));
          init?.signal?.addEventListener('abort', () => writer.error(init.signal?.reason), { once: true });
        },
      }), { headers: { 'Content-Type': 'text/event-stream' } });
    });
    const reply = await generateReply([], { ...options, onDraft: (text) => {
      drafts.push(text);
      if (text === oldDraft) primaryDraft.resolve();
    } });
    assert.equal(reply.reply, 'What did you do at school?');
    assert.deepEqual(drafts, [oldDraft, '']);
    assert.equal(mock.mock.callCount(), 2);
  });
});

test('translation validation accepts only en/vi pairs and limits text', async () => {
  const translations = await import('../src/modules/translations/translations.validation');
  assert.deepEqual(translations.parseLanguages('en', 'vi'), { sourceLanguage: 'en', targetLanguage: 'vi' });
  assert.deepEqual(translations.parseLanguages('vi', 'en'), { sourceLanguage: 'vi', targetLanguage: 'en' });
  assert.throws(
    () => translations.parseLanguages('en', 'en'),
    (error) => error instanceof HttpError && error.statusCode === 422,
  );
  assert.equal(translations.parseTranslationText('  Hello  '), 'Hello');
  assert.throws(
    () => translations.parseTranslationText(' '.repeat(1)),
    (error) => error instanceof HttpError && error.statusCode === 422,
  );
  assert.throws(
    () => translations.parseTranslationText('x'.repeat(10_001)),
    (error) => error instanceof HttpError && error.statusCode === 413,
  );
  assert.equal(translations.isSingleWord('beautiful'), true);
  assert.equal(translations.isSingleWord("don't"), true);
  assert.equal(translations.isSingleWord('very good'), false);
});

test('study coach validation accepts intents and sanitizes untrusted page context', () => {
  const turn = parseChatTurn({
    message: '  Hôm nay học gì?  ',
    intent: 'plan',
    context: { tab: 'videos', focus: '  Greetings  ', detail: 'x'.repeat(1500) },
  });
  assert.equal(turn.message, 'Hôm nay học gì?');
  assert.equal(turn.intent, 'plan');
  assert.equal(turn.context?.tab, 'videos');
  assert.equal(turn.context?.focus, 'Greetings');
  assert.equal(turn.context?.detail?.length, 1000);

  const plain = parseChatTurn({ message: 'Hello' });
  assert.equal(plain.intent, 'chat');
  assert.equal(plain.context, null);

  const unknownTab = parseChatTurn({ message: 'Hello', context: { tab: 'somewhere-else' } });
  assert.equal(unknownTab.context?.tab, 'study');
  assert.throws(
    () => parseChatTurn({ message: 'Hello', intent: 'HACK' }),
    (error) => error instanceof HttpError && error.statusCode === 422,
  );
});

test('study plan steps come from real progress, weak topics and unlock order', () => {
  const stats: StudyStats = {
    totalLessons: 4,
    completedLessons: 1,
    completedLessonIds: [1],
    lessons: [
      { id: 1, title: 'Bài 1', topic: 'Intro', stageTitle: 'Chặng 1' },
      { id: 2, title: 'Bài 2', topic: 'Masterclass', stageTitle: 'Chặng 1' },
      { id: 3, title: 'Bài 3', topic: 'Literature', stageTitle: 'Chặng 2' },
      { id: 4, title: 'Bài 4', topic: 'Literature', stageTitle: 'Chặng 2' },
    ],
    videosTotal: 2,
    videosCompleted: 0,
    nextVideo: { id: 9, title: 'Video A' },
    savedWords: 0,
    translations: 3,
    battlesPlayed: 0,
    battleWins: 0,
    badges: 1,
    xp: 20,
    streak: 2,
    reviewDue: 0,
    reviewTotal: 0,
    reviewWords: 0,
    ownedVideos: 2,
    ownedVideoTitles: ['Video riêng A', 'Video riêng B'],
  };
  const learner: LearnerContext = {
    level: 'intermediate',
    completedTopics: ['Intro'],
    weakTopics: [{ topic: 'Masterclass', mistakes: 3 }],
    recentMistakes: [],
    previousFeedback: [],
  };

  const snapshot = toStudySnapshot(learner, stats);
  assert.equal(snapshot.nextLesson?.id, 2, 'the lesson after the completed one is next');
  assert.equal(snapshot.xp, 20);
  assert.equal(snapshot.weakTopics[0].mistakes, 3);

  const steps = buildStudyPlan(snapshot, stats);
  assert.equal(steps.length, 3);
  assert.equal(steps[0].kind, 'lesson');
  assert.equal(steps[0].target.lessonId, 2, 'step one deep-links into the exact lesson');
  assert.equal(steps[1].kind, 'review');
  assert.match(steps[1].reason, /3 câu/);
  assert.equal(steps[2].target.tab, 'videos');

  const finished = toStudySnapshot(learner, {
    ...stats,
    completedLessons: 4,
    completedLessonIds: [1, 2, 3, 4],
  });
  assert.equal(finished.nextLesson, null);
  assert.equal(buildStudyPlan(finished, { ...stats, completedLessonIds: [1, 2, 3, 4] })[0].kind, 'review');
});

test('due review items are scheduled ahead of speculative practice', () => {
  const stats: StudyStats = {
    totalLessons: 2,
    completedLessons: 1,
    completedLessonIds: [1],
    lessons: [
      { id: 1, title: 'Bài 1', topic: 'Intro', stageTitle: 'Chặng 1' },
      { id: 2, title: 'Bài 2', topic: 'Travel', stageTitle: 'Chặng 1' },
    ],
    videosTotal: 0,
    videosCompleted: 0,
    nextVideo: null,
    savedWords: 0,
    translations: 0,
    battlesPlayed: 0,
    battleWins: 0,
    badges: 0,
    xp: 0,
    streak: 0,
    reviewDue: 6,
    reviewTotal: 11,
    reviewWords: 4,
    ownedVideos: 0,
    ownedVideoTitles: [],
  };
  const learner: LearnerContext = {
    level: 'beginner',
    completedTopics: ['Intro'],
    weakTopics: [],
    recentMistakes: [],
    previousFeedback: [],
  };

  const steps = buildStudyPlan(toStudySnapshot(learner, stats), stats);
  const due = steps.find((step) => step.id === 'review-due');
  assert.ok(due, 'a learner with due items must be sent to the review queue');
  assert.equal(due.target.tab, 'profile', 'the step lands on the profile, where the review button lives');
  assert.equal(steps[0].id, 'next-lesson', 'the roadmap lesson still comes first');
  assert.equal(steps[1].id, 'review-due', 'due recall outranks optional practice');
  assert.ok(due.minutes >= 5 && due.minutes <= 15, 'the estimate stays inside a sane range');

  const nothingDue = buildStudyPlan(toStudySnapshot(learner, { ...stats, reviewDue: 0 }), stats);
  assert.equal(nothingDue.some((step) => step.id === 'review-due'), false);
});

test('offline coach reply still names the real next lesson and weak topic', () => {
  const stats: StudyStats = {
    totalLessons: 3,
    completedLessons: 1,
    completedLessonIds: [1],
    lessons: [
      { id: 1, title: 'Bài 1', topic: 'Intro', stageTitle: 'Chặng 1' },
      { id: 2, title: 'Bài 2', topic: 'Masterclass', stageTitle: 'Chặng 1' },
      { id: 3, title: 'Bài 3', topic: 'Literature', stageTitle: 'Chặng 2' },
    ],
    videosTotal: 0,
    videosCompleted: 0,
    nextVideo: null,
    savedWords: 0,
    translations: 0,
    battlesPlayed: 0,
    battleWins: 0,
    badges: 0,
    xp: 20,
    streak: 0,
    reviewDue: 0,
    reviewTotal: 0,
    reviewWords: 0,
    ownedVideos: 0,
    ownedVideoTitles: [],
  };
  const learner: LearnerContext = {
    level: 'beginner',
    completedTopics: ['Intro'],
    weakTopics: [{ topic: 'Masterclass', mistakes: 4 }],
    recentMistakes: [],
    previousFeedback: [],
  };
  const snapshot = toStudySnapshot(learner, stats);
  const steps = buildStudyPlan(snapshot, stats);
  const reply = buildOfflineCoachReply(snapshot, steps, 'plan', { tab: 'study', focus: 'Bài 2' });
  assert.match(reply.reply, /Bài 2/);
  assert.match(reply.reply, /Masterclass/);
  assert.match(reply.reply, /4 câu/);
  assert.match(reply.reply, /Bài 2/);
  assert.deepEqual(reply.feedback, []);
  assert.equal(reply.action?.kind, 'open_lesson', 'offline answer still deep-links to the first step');
});

test('the offline coach reply names due review items, not just the plan order', () => {
  const stats: StudyStats = {
    totalLessons: 2,
    completedLessons: 1,
    completedLessonIds: [1],
    lessons: [
      { id: 1, title: 'Bài 1', topic: 'Intro', stageTitle: 'Chặng 1' },
      { id: 2, title: 'Bài 2', topic: 'Travel', stageTitle: 'Chặng 1' },
    ],
    videosTotal: 0,
    videosCompleted: 0,
    nextVideo: null,
    savedWords: 0,
    translations: 0,
    battlesPlayed: 0,
    battleWins: 0,
    badges: 0,
    xp: 0,
    streak: 0,
    reviewDue: 9,
    reviewTotal: 14,
    reviewWords: 3,
    ownedVideos: 0,
    ownedVideoTitles: [],
  };
  const learner: LearnerContext = {
    level: 'beginner',
    completedTopics: ['Intro'],
    weakTopics: [],
    recentMistakes: [],
    previousFeedback: [],
  };
  const snapshot = toStudySnapshot(learner, stats);
  const reply = buildOfflineCoachReply(snapshot, buildStudyPlan(snapshot, stats), 'plan', null);

  // The lesson still leads, but a learner who stops after one sentence must
  // still learn that nine items are about to expire.
  assert.match(reply.reply, /Bài 2/);
  // Nine due items still produce a seven-item session, and the reply says so.
  assert.match(reply.reply, /7 mục/, 'the shortlist size appears in the prose');
  assert.match(reply.reply, /3 từ vựng/, 'the word count is quoted too');
  assert.match(reply.reply, /Ôn Tập/, 'the reply names where to go');

  const nothingDue = toStudySnapshot(learner, { ...stats, reviewDue: 0 });
  const quiet = buildOfflineCoachReply(nothingDue, buildStudyPlan(nothingDue, stats), 'plan', null);
  assert.doesNotMatch(quiet.reply, /mục này/, 'no due reminder when nothing is due');
});

test('offline chat and explain answers report that Buddy could not answer', () => {
  const stats: StudyStats = {
    totalLessons: 3,
    completedLessons: 1,
    completedLessonIds: [1],
    lessons: [
      { id: 1, title: 'Bài 1', topic: 'Intro', stageTitle: 'Chặng 1' },
      { id: 2, title: 'Bài 2', topic: 'Masterclass', stageTitle: 'Chặng 1' },
      { id: 3, title: 'Bài 3', topic: 'Literature', stageTitle: 'Chặng 2' },
    ],
    videosTotal: 0,
    videosCompleted: 0,
    nextVideo: null,
    savedWords: 0,
    translations: 0,
    battlesPlayed: 0,
    battleWins: 0,
    badges: 0,
    xp: 20,
    streak: 0,
    reviewDue: 0,
    reviewTotal: 0,
    reviewWords: 0,
    ownedVideos: 0,
    ownedVideoTitles: [],
  };
  const learner: LearnerContext = {
    level: 'beginner',
    completedTopics: ['Intro'],
    weakTopics: [],
    recentMistakes: [],
    previousFeedback: [],
  };
  const snapshot = toStudySnapshot(learner, stats);
  const steps = buildStudyPlan(snapshot, stats);
  const context = { tab: 'rankings' as const, focus: 'League tuần · Hạng #3' };

  const chat = buildOfflineCoachReply(snapshot, steps, 'chat', context);
  assert.match(chat.reply, /chưa trả lời được/);
  assert.doesNotMatch(chat.reply, /Phần giải thích chi tiết|Việc tiếp theo/);
  assert.equal(chat.action, null);
  assert.deepEqual(chat.followups, []);

  const explain = buildOfflineCoachReply(snapshot, steps, 'explain', context);
  assert.match(explain.reply, /chưa trả lời được/);
  assert.doesNotMatch(explain.reply, /giải thích chi tiết/i);

  const english = buildOfflineCoachReply(snapshot, steps, 'chat', context, 'en');
  assert.match(english.reply, /couldn’t answer/);
  assert.doesNotMatch(english.reply, /detailed answer/i);
});

test('chat actions resolve only to real catalogue ids and tabs', () => {
  const stats: StudyStats = {
    totalLessons: 2,
    completedLessons: 0,
    completedLessonIds: [],
    lessons: [
      { id: 7, title: 'Bài 7', topic: 'Intro', stageTitle: 'Chặng 1' },
      { id: 8, title: 'Bài 8', topic: 'Travel', stageTitle: 'Chặng 1' },
    ],
    videoCatalog: [
      { id: 3, title: 'Viva La Vida', topic: 'Music', level: 'B1', completed: false },
    ],
    videosTotal: 1,
    videosCompleted: 0,
    nextVideo: null,
    savedWords: 0,
    translations: 0,
    battlesPlayed: 0,
    battleWins: 0,
    badges: 0,
    xp: 0,
    streak: 0,
    reviewDue: 0,
    reviewTotal: 0,
    reviewWords: 0,
    ownedVideos: 0,
    ownedVideoTitles: [],
  };

  assert.equal(resolveChatAction({ kind: 'open_video', label: '', videoId: 999 }, stats), null, 'unknown video id is dropped');
  assert.equal(resolveChatAction({ kind: 'open_lesson', label: '', lessonId: 99 }, stats), null, 'unknown lesson id is dropped');
  assert.deepEqual(
    resolveChatAction({ kind: 'open_video', label: '', videoId: 3 }, stats),
    { kind: 'open_video', tab: 'videos', videoId: 3, videoTitle: 'Viva La Vida', label: 'Mở video: Viva La Vida' },
  );
  assert.deepEqual(
    resolveChatAction({ kind: 'open_lesson', label: 'Học bài 7', lessonId: 7 }, stats),
    { kind: 'open_lesson', tab: 'study', lessonId: 7, lessonTitle: 'Bài 7', mode: 'open', highlight: 'lesson:7', label: 'Mở bài: Bài 7' },
  );
  assert.equal(resolveChatAction({ kind: 'open_lesson', label: '', lessonId: 8, mode: 'open' }, stats)?.mode, 'reveal');
  assert.deepEqual(lessonPrerequisites(stats, 8), { frontier: stats.lessons[0], remaining: 1 });
  assert.equal(resolveChatAction({
    kind: 'open_lesson', label: '', lessonId: 7,
  }, { ...stats, completedLessonIds: [8] })?.mode, 'open', 'catch-up lessons stay open');
  assert.deepEqual(
    resolveChatAction({ kind: 'open_tab', label: '', tab: 'compete' }, stats),
    { kind: 'open_tab', tab: 'compete', label: 'Vào Thi Đua' },
  );
  assert.deepEqual(
    resolveChatAction({ kind: 'open_notebook', label: '' }, stats),
    { kind: 'open_notebook', tab: 'videos', label: 'Mở Sổ từ vựng', highlight: 'control:notebook' },
  );
  assert.deepEqual(
    resolveChatAction({ kind: 'open_notebook', label: '', highlight: 'word:apple' }, stats),
    { kind: 'open_notebook', tab: 'videos', label: 'Mở Sổ từ vựng', highlight: 'word:apple' },
  );
  assert.deepEqual(
    resolveChatAction({ kind: 'open_tab', label: '', tab: 'compete', highlight: 'control:arena-start' }, stats),
    { kind: 'open_tab', tab: 'compete', label: 'Vào Thi Đua', highlight: 'control:arena-start' },
  );
  assert.equal(
    resolveChatAction({ kind: 'open_tab', label: '', tab: 'admin' }, stats),
    null,
    'the learner is never sent to the admin console',
  );
  assert.equal(
    resolveChatAction({ kind: 'open_video', label: '', videoId: 3, highlight: 'video:999' }, stats)?.highlight,
    undefined,
    'a highlight for another video is dropped',
  );
  assert.equal(resolveChatAction(null, stats), null);
  assert.equal(resolveChatAction({ kind: 'show_shop_item', label: '', itemCode: 'fake' }, stats), null);
  assert.deepEqual(resolveChatAction({
    kind: 'show_shop_item', label: '', itemCode: 'shield', itemName: 'Invented', highlight: 'shop:fake',
  }, stats, [{ code: 'shield', name: 'Shield' }]), {
    kind: 'show_shop_item', tab: 'shop', label: 'Shield', itemCode: 'shield', itemName: 'Shield', highlight: 'shop:shield',
  });
  assert.equal(resolveChatAction({ kind: 'spotlight', label: '', tab: 'shop', highlight: 'rank:me' }, stats), null);
  assert.equal(resolveChatAction({ kind: 'spotlight', label: '', tab: 'rankings', highlight: 'rank:me' }, stats)?.highlight, 'rank:me');

  assert.deepEqual(resolveNavigationRequest('Mở video về music', stats), {
    kind: 'open_video', tab: 'videos', videoId: 3, videoTitle: 'Viva La Vida', label: 'Mở video: Viva La Vida',
  });
  assert.deepEqual(resolveNavigationRequest('Mở giúp mình một video nào đó bất kì', stats), {
    kind: 'open_video', tab: 'videos', videoId: 3, videoTitle: 'Viva La Vida', label: 'Mở video: Viva La Vida',
  });
  assert.equal(resolveNavigationRequest('Mở thư viện video', stats)?.kind, 'open_tab');
  assert.deepEqual(resolveNavigationRequest('Mở bài về travel', stats), {
    kind: 'open_lesson', tab: 'study', lessonId: 8, lessonTitle: 'Bài 8', label: 'Mở bài: Bài 8',
  });
  assert.equal(resolveNavigationRequest('Ôn tập giúp mình', stats)?.kind, 'open_review');
  assert.equal(resolveNavigationRequest('Mở bảng xếp hạng', stats)?.tab, 'rankings');
  assert.equal(resolveNavigationRequest('Giải thích bảng xếp hạng là gì?', stats), null);
});

test('a polite request for any video is a video command, not a shop item', () => {
  for (const message of [
    'Mở giúp mình một video nào đó bất kì',
    'Mở giúp mình xem một video bất kì',
    'Mở cho tôi một video bất kỳ',
    'Mở một video bất kì',
    'Xin chào anh có thể mở cho tôi một video bất kỳ được không?',
    'Bạn có thể mở giúp mình một video ngẫu nhiên được không?',
    'Open any video',
  ]) {
    const command = parseBuddyCommand(message);
    assert.equal(command?.kind, 'video', message);
    if (command?.kind === 'video') assert.deepEqual(command.params, { choice: 'random' }, message);
  }

  const topic = parseBuddyCommand('Mở video về music');
  assert.equal(topic?.kind, 'video');
  if (topic?.kind === 'video') assert.deepEqual(topic.params, { choice: 'topic', topic: 'music' });
  assert.equal(parseBuddyCommand('Bạn có thể giải thích nội dung video này được không?'), null);
});

test('a described red car is looked up in the real shop catalogue', () => {
  const car = (id: number, code: string, name: string, body: string, description = '') => ({
    id, code, name, description, slot: 'car', rarity: 'rare', price: 200,
    unlock_type: 'level', unlock_value: '3', visual_key: code, style: { body },
    booster_kind: null, owned: false, equipped: false, unlocked: true, unlock_label: '',
    charges: 0, active_until: null,
  });
  const items = [
    car(1, 'car_default', 'Xe vàng kinh điển', '#F2B544'),
    car(2, 'car_sport_red', 'Xe thể thao đỏ', '#E5484D', 'Thân xe đỏ gọn.'),
    car(3, 'car_formula', 'Xe đua công thức', '#F25C4A', 'Một chiếc F1 đỏ rực.'),
    car(4, 'car_jeep', 'Jeep đường dài', '#D9534F'),
    car(5, 'car_rickshaw', 'Xe lam tốc độ', '#2E8B57'),
  ] as unknown as import('../src/modules/gamification/gamification.types').ShopItem[];

  assert.equal(matchShopItem('chiếc xe màu đỏ', items)?.code, 'car_sport_red');
  assert.equal(matchShopItem('red car', items)?.code, 'car_sport_red');
  assert.equal(matchShopItem('xe vàng', items)?.code, 'car_default');
  assert.equal(parseBuddyCommand('chiếc xe màu đỏ')?.kind, 'shopItem');
  assert.equal(parseBuddyCommand('có chiếc xe màu đỏ không')?.kind, 'shopItem');
});
