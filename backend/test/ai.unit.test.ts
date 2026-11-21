import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { parseAiTopic, parseChatId, parseChatTurn, parseUserMessage } from '../src/modules/ai/ai.validation';
import { HttpError } from '../src/middleware/error-handler';
import { env } from '../src/config/env';
import { parseAiReply, providerMessageContent } from '../src/modules/ai/ai.parsing';
import { generateReply } from '../src/modules/ai/ai.provider';
import {
  buildOfflineCoachReply,
  buildStudyPlan,
  resolveChatAction,
  toStudySnapshot,
} from '../src/modules/ai/ai.study';
import type { StudyStats } from '../src/modules/ai/ai.repository';
import type { LearnerContext } from '../src/modules/ai/ai.types';

before(() => {
  env.aiApiKey = 'test-only-provider-key';
  env.aiApiUrl = 'https://provider.example.test/chat/completions';
  env.cfAccounts = [];
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

test('offline chat and explain answers follow the page, not a study plan', () => {
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
  assert.match(chat.reply, /League tuần/);
  assert.doesNotMatch(chat.reply, /Việc tiếp theo/, 'a page question is not a plan request');
  assert.equal(chat.action, null);

  const explain = buildOfflineCoachReply(snapshot, steps, 'explain', context);
  assert.match(explain.reply, /giải thích/i);
  assert.doesNotMatch(explain.reply, /Việc tiếp theo/);
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
      { id: 3, title: 'Viva La Vida', topic: 'Music', level: 'B1' },
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
    { kind: 'open_video', tab: 'videos', videoId: 3, label: 'Mở video: Viva La Vida' },
  );
  assert.deepEqual(
    resolveChatAction({ kind: 'open_lesson', label: 'Học bài 7', lessonId: 7 }, stats),
    { kind: 'open_lesson', tab: 'study', lessonId: 7, lessonTitle: 'Bài 7', label: 'Học bài 7' },
  );
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
});
