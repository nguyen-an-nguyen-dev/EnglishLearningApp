import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { parseAiTopic, parseChatId, parseChatTurn, parseUserMessage } from '../src/modules/ai/ai.validation';
import { HttpError } from '../src/middleware/error-handler';
import type { StudyStats } from '../src/modules/ai/ai.repository';
import type { LearnerContext } from '../src/modules/ai/ai.types';

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
  };
  const learner: LearnerContext = {
    level: 'intermediate',
    completedTopics: ['Intro'],
    weakTopics: [{ topic: 'Masterclass', mistakes: 3 }],
    recentMistakes: [],
    previousFeedback: [],
  };

  const snapshot = ai.toStudySnapshot(learner, stats);
  assert.equal(snapshot.nextLesson?.id, 2, 'the lesson after the completed one is next');
  assert.equal(snapshot.xp, 20);
  assert.equal(snapshot.weakTopics[0].mistakes, 3);

  const steps = ai.buildStudyPlan(snapshot, stats);
  assert.equal(steps.length, 3);
  assert.equal(steps[0].kind, 'lesson');
  assert.equal(steps[0].target.lessonId, 2, 'step one deep-links into the exact lesson');
  assert.equal(steps[1].kind, 'review');
  assert.match(steps[1].reason, /3 câu/);
  assert.equal(steps[2].target.tab, 'videos');

  const finished = ai.toStudySnapshot(learner, {
    ...stats,
    completedLessons: 4,
    completedLessonIds: [1, 2, 3, 4],
  });
  assert.equal(finished.nextLesson, null);
  assert.equal(ai.buildStudyPlan(finished, { ...stats, completedLessonIds: [1, 2, 3, 4] })[0].kind, 'review');
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
  };
  const learner: LearnerContext = {
    level: 'beginner',
    completedTopics: ['Intro'],
    weakTopics: [{ topic: 'Masterclass', mistakes: 4 }],
    recentMistakes: [],
    previousFeedback: [],
  };
  const snapshot = ai.toStudySnapshot(learner, stats);
  const steps = ai.buildStudyPlan(snapshot, stats);
  const reply = ai.buildOfflineCoachReply(snapshot, steps, 'plan', { tab: 'study', focus: 'Bài 2' });
  assert.match(reply.reply, /Bài 2/);
  assert.match(reply.reply, /Masterclass/);
  assert.match(reply.reply, /4 câu/);
  assert.match(reply.reply, /Bài 2/);
  assert.deepEqual(reply.feedback, []);
});
