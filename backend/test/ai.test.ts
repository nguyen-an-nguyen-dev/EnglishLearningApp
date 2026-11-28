import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { StudyPlan as MobileStudyPlan } from '../../mobile/services/ai';
import { planDestination } from '../../mobile/services/aiDestinations';
import { env } from '../src/config/env';
import { readAiReplyStream, readStudyPlanStream } from '../../mobile/services/aiReplyStream';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}
process.env.AI_API_KEY = 'test-only-provider-key';
env.thApiKey = '';

let server: Server;
let baseUrl: string;
let ownerEmail: string;
let otherEmail: string;
let ownerToken: string;
let otherToken: string;
let ownerId: number;
let pool: typeof import('../src/db/pool').pool;
let originalFetch: typeof fetch;
let providerResponse: Response | Error | null = null;
let waitForProviderCancellation: ((signal: AbortSignal) => Promise<Response>) | null = null;
type ProviderRequestBody = { messages?: Array<{ role: string; content: string }>; reasoning_effort?: string };
let providerRequestBody: ProviderRequestBody | null = null;
let providerCallCount = 0;
let forceProviderFailure = false;
let decisionCalls = 0;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function providerOk(reply: string, feedback: unknown[] = []): Response {
  return jsonResponse({
    choices: [{
      message: {
        content: JSON.stringify({ reply, feedback }),
      },
    }],
  });
}

before(async () => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === env.aiDecisionUrl) {
      decisionCalls++;
      return jsonResponse({ answers: {} });
    }
    const providerUrls = [
      process.env.AI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      process.env.NVIDIA_API_URL || 'https://integrate.api.nvidia.com/v1/chat/completions',
    ];
    if (providerUrls.includes(url)) {
      providerCallCount++;
      if (waitForProviderCancellation && init?.signal) return waitForProviderCancellation(init.signal);
      if (forceProviderFailure) return jsonResponse({ error: { message: 'provider down' } }, 503);
      const current = providerResponse;
      providerResponse = null;
      providerRequestBody = typeof init?.body === 'string'
        ? JSON.parse(init.body) as ProviderRequestBody
        : null;
      if (current instanceof Error) throw current;
      return current ?? providerOk('That sounds interesting! What do you enjoy most?');
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  const [{ app }, db] = await Promise.all([
    import('../src/app'),
    import('../src/db/pool'),
  ]);
  pool = db.pool;
  server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('AI test server failed to bind.');
  baseUrl = `http://127.0.0.1:${address.port}`;

  ownerEmail = `ai-owner-${randomUUID()}@example.test`;
  otherEmail = `ai-other-${randomUUID()}@example.test`;
  const register = async (email: string, name: string) => fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: 'correct-horse-7' }),
  });
  assert.equal((await register(ownerEmail, 'AI Owner')).status, 201);
  assert.equal((await register(otherEmail, 'AI Other')).status, 201);

  const login = async (email: string) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'correct-horse-7' }),
    });
    assert.equal(response.status, 200);
    return (await response.json() as { data: { token: string; user: { id: number } } }).data;
  };
  const owner = await login(ownerEmail);
  const other = await login(otherEmail);
  ownerToken = owner.token;
  ownerId = owner.user.id;
  otherToken = other.token;
});

after(async () => {
  if (globalThis.fetch !== originalFetch) globalThis.fetch = originalFetch;
  if (ownerEmail) await pool.execute('DELETE FROM users WHERE email = ?', [ownerEmail]);
  if (otherEmail) await pool.execute('DELETE FROM users WHERE email = ?', [otherEmail]);
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await pool.end();
});

test('AI chat persists history and feedback, enforces ownership, and reports provider failures', async () => {
  const auth = (token = ownerToken) => ({ Authorization: `Bearer ${token}` });
  interface LessonSeedRow extends RowDataPacket { id: number; topic: string; question_id: number; }
  const [lessonRows] = await pool.execute<LessonSeedRow[]>(
    `SELECT l.id, l.topic, q.id AS question_id FROM lessons l
     JOIN questions q ON q.lesson_id = l.id
     WHERE l.topic = 'Greetings' LIMIT 1`,
  );
  assert.ok(lessonRows[0], 'AI personalization test requires at least one seeded lesson question.');
  await pool.execute(
    `INSERT INTO progress (user_id, lesson_id, status, score, completed_at)
     VALUES (?, ?, 'completed', 100, CURRENT_TIMESTAMP)`,
    [ownerId, lessonRows[0].id],
  );
  await pool.execute(
    `INSERT INTO learning_answer_attempts (user_id, question_id, submitted_answer, is_correct)
     VALUES (?, ?, 'I goed', FALSE)`,
    [ownerId, lessonRows[0].question_id],
  );

  const create = await fetch(`${baseUrl}/api/ai/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ topic: 'DAILY_CONVERSATION' }),
  });
  assert.equal(create.status, 201);
  const { data: { chat } } = await create.json() as { data: { chat: { id: number; topic: string } } };
  assert.equal(chat.topic, 'DAILY_CONVERSATION');

  const unauthenticated = await fetch(`${baseUrl}/api/ai/chats`);
  assert.equal(unauthenticated.status, 401);
  const invalidTopic = await fetch(`${baseUrl}/api/ai/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ topic: 'UNSUPPORTED' }),
  });
  assert.equal(invalidTopic.status, 422);

  const hiddenChat = await fetch(`${baseUrl}/api/ai/chats/${chat.id}`, { headers: auth(otherToken) });
  assert.equal(hiddenChat.status, 404);

  providerResponse = providerOk('I like music too! What kind of music do you listen to?', [{
    type: 'GRAMMAR',
    original_text: 'I likes music.',
    corrected_text: 'I like music.',
    explanation: 'Với chủ ngữ “I”, động từ dùng dạng nguyên mẫu “like”, không thêm “s”.',
  }]);
  const sent = await fetch(`${baseUrl}/api/ai/chats/${chat.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ message: 'I likes music.' }),
  });
  assert.equal(sent.status, 201);
  const sentBody = await sent.json() as {
    data: { userMessage: { id: number; role: string; content: string }; aiMessage: { role: string; content: string }; feedback: Array<{ message_id: number; type: string; original_text: string; corrected_text: string }> };
  };
  assert.equal(sentBody.data.userMessage.role, 'USER');
  assert.equal(sentBody.data.aiMessage.role, 'AI');
  assert.match(sentBody.data.aiMessage.content, /music/);
  assert.equal(sentBody.data.feedback[0].type, 'GRAMMAR');
  assert.equal(sentBody.data.feedback[0].message_id, sentBody.data.userMessage.id);
  assert.equal(sentBody.data.feedback[0].original_text, 'I likes music.');
  assert.equal(sentBody.data.feedback[0].corrected_text, 'I like music.');
  const prompt = providerRequestBody?.messages?.[0]?.content ?? '';
  assert.match(prompt, new RegExp(lessonRows[0].topic));
  assert.match(prompt, /recent_incorrect_answers/);
  assert.match(prompt, /I goed/);

  interface SavedMessageRow extends RowDataPacket { role: string; content: string; }
  const [savedMessages] = await pool.execute<SavedMessageRow[]>(
    'SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id',
    [chat.id],
  );
  assert.deepEqual(savedMessages.map((message) => message.role), ['USER', 'AI']);

  const feedbackResponse = await fetch(`${baseUrl}/api/ai/chats/${chat.id}/feedback`, { headers: auth() });
  assert.equal(feedbackResponse.status, 200);
  const savedFeedback = await feedbackResponse.json() as { data: { feedback: Array<{ explanation: string }> } };
  assert.equal(savedFeedback.data.feedback.length, 1);
  assert.match(savedFeedback.data.feedback[0].explanation, /chủ ngữ/);

  const reloaded = await fetch(`${baseUrl}/api/ai/chats/${chat.id}`, { headers: auth() });
  const reloadedBody = await reloaded.json() as { data: { messages: Array<{ role: string }> } };
  assert.deepEqual(reloadedBody.data.messages.map((message) => message.role), ['USER', 'AI']);
  const history = await fetch(`${baseUrl}/api/ai/chats`, { headers: auth() });
  const historyBody = await history.json() as { data: { chats: Array<{ id: number; last_message: string }> } };
  assert.equal(historyBody.data.chats[0].id, chat.id);
  assert.match(historyBody.data.chats[0].last_message, /music/);

  providerResponse = jsonResponse({ error: { message: 'busy' } }, 429);
  const rateLimited = await fetch(`${baseUrl}/api/ai/chats/${chat.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ message: 'I like music.' }),
  });
  assert.equal(rateLimited.status, 429);
  assert.match(providerRequestBody?.messages?.[0]?.content ?? '', /I likes music/);

  providerResponse = new TypeError('network unavailable');
  const unavailable = await fetch(`${baseUrl}/api/ai/chats/${chat.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ message: 'Try again.' }),
  });
  assert.equal(unavailable.status, 503);

  const timeoutError = new Error('provider timeout');
  timeoutError.name = 'TimeoutError';
  providerResponse = timeoutError;
  const timedOut = await fetch(`${baseUrl}/api/ai/chats/${chat.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ message: 'Try again after timeout.' }),
  });
  assert.equal(timedOut.status, 504);

  providerResponse = providerOk('   ');
  const invalid = await fetch(`${baseUrl}/api/ai/chats/${chat.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ message: 'Try one more time.' }),
  });
  assert.equal(invalid.status, 502);

  interface IdRow extends RowDataPacket { id: number; }
  const [finalMessages] = await pool.execute<IdRow[]>(
    'SELECT id FROM messages WHERE chat_id = ?',
    [chat.id],
  );
  assert.equal(finalMessages.length, 2, 'failed AI responses must not partially save a conversation turn');

  const invalidChatId = await fetch(`${baseUrl}/api/ai/chats/abc`, { headers: auth() });
  assert.equal(invalidChatId.status, 400);
});

test('AI chats can be deleted by their owner and cascade to messages and feedback', async () => {
  const auth = (token = ownerToken) => ({ Authorization: `Bearer ${token}` });
  const create = await fetch(`${baseUrl}/api/ai/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ topic: 'TRAVEL' }),
  });
  assert.equal(create.status, 201);
  const { data: { chat } } = await create.json() as { data: { chat: { id: number } } };

  providerResponse = providerOk('Nice trip plan! Where will you go first?', [{
    type: 'VOCABULARY',
    original_text: 'I want go beach.',
    corrected_text: 'I want to go to the beach.',
    explanation: 'Sau “want” cần “to + động từ nguyên thể”.',
  }]);
  const sent = await fetch(`${baseUrl}/api/ai/chats/${chat.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ message: 'I want go beach.' }),
  });
  assert.equal(sent.status, 201);

  const forbidden = await fetch(`${baseUrl}/api/ai/chats/${chat.id}`, {
    method: 'DELETE',
    headers: auth(otherToken),
  });
  assert.equal(forbidden.status, 404, 'another user must not delete this chat');

  const deleted = await fetch(`${baseUrl}/api/ai/chats/${chat.id}`, {
    method: 'DELETE',
    headers: auth(),
  });
  assert.equal(deleted.status, 200);
  const deletedBody = await deleted.json() as { data: { chat_id: number; deleted: boolean } };
  assert.deepEqual(deletedBody.data, { chat_id: chat.id, deleted: true });

  const missing = await fetch(`${baseUrl}/api/ai/chats/${chat.id}`, { headers: auth() });
  assert.equal(missing.status, 404);
  const repeat = await fetch(`${baseUrl}/api/ai/chats/${chat.id}`, { method: 'DELETE', headers: auth() });
  assert.equal(repeat.status, 404);

  const history = await fetch(`${baseUrl}/api/ai/chats`, { headers: auth() });
  const historyBody = await history.json() as { data: { chats: Array<{ id: number }> } };
  assert.ok(!historyBody.data.chats.some((item) => item.id === chat.id), 'deleted chat leaves the history list');

  interface CountRow extends RowDataPacket { n: number; }
  const [messageRows] = await pool.execute<CountRow[]>(
    'SELECT COUNT(*) AS n FROM messages WHERE chat_id = ?',
    [chat.id],
  );
  const [feedbackRows] = await pool.execute<CountRow[]>(
    `SELECT COUNT(*) AS n FROM ai_feedback f
     JOIN messages m ON m.id = f.message_id WHERE m.chat_id = ?`,
    [chat.id],
  );
  assert.equal(Number(messageRows[0].n), 0, 'deleting a chat cascades its messages');
  assert.equal(Number(feedbackRows[0].n), 0, 'deleting a chat cascades its AI feedback');
});

test('study plan and coach chat are grounded in real learner data and page context', async () => {
  const auth = { Authorization: `Bearer ${ownerToken}` };

  const unauthorizedPlan = await fetch(`${baseUrl}/api/ai/study-plan`);
  assert.equal(unauthorizedPlan.status, 401);

  providerResponse = providerOk('Bạn nên học bài tiếp theo trước vì nó đang mở trong lộ trình.');
  const planResponse = await fetch(`${baseUrl}/api/ai/study-plan`, { headers: auth });
  assert.equal(planResponse.status, 200);
  const planBody = await planResponse.json() as {
    data: {
      snapshot: { completedLessons: number; totalLessons: number; nextLesson: { id: number } | null };
      steps: Array<{ id: string; kind: string; title: string; minutes: number; target: { tab: string; lessonId?: number } }>;
      aiNote: string | null;
    };
  };
  assert.equal(planBody.data.steps.length, 3, 'a plan always has three concrete steps');
  assert.ok(planBody.data.steps[0].target.tab, 'each step links back to a dashboard tab');
  assert.ok(planBody.data.steps.every((step) => step.title && step.minutes > 0));
  assert.ok(planBody.data.snapshot.totalLessons > 0, 'plan reads the real lesson catalogue');
  assert.equal(typeof planBody.data.aiNote, 'string');

  const create = await fetch(`${baseUrl}/api/ai/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ topic: 'STUDY_COACH' }),
  });
  assert.equal(create.status, 201, 'STUDY_COACH is a valid topic');
  const { data: { chat } } = await create.json() as { data: { chat: { id: number; title: string } } };
  assert.equal(chat.title, 'En Buddy');

  providerResponse = providerOk('Mình gợi ý bạn làm bài tiếp theo trước, rồi ôn chủ đề yếu.');
  const sent = await fetch(`${baseUrl}/api/ai/chats/${chat.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({
      message: 'Hôm nay học gì trước?',
      intent: 'plan',
      context: { tab: 'study', focus: 'Bài hiện tại' },
    }),
  });
  assert.equal(sent.status, 201);
  const prompt = providerRequestBody?.messages?.[0]?.content ?? '';
  assert.match(prompt, /CURRENT_PAGE_JSON/, 'coach prompt receives the current page');
  assert.match(prompt, /plan_steps/, 'coach prompt receives the deterministic plan');
  assert.match(prompt, /"tab":"study"/, 'page context is passed through');
  assert.match(prompt, /LEARNER_DATA_JSON/, 'coach prompt still carries learner data');

  const badIntent = await fetch(`${baseUrl}/api/ai/chats/${chat.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ message: 'Hello', intent: 'HACK' }),
  });
  assert.equal(badIntent.status, 422, 'unknown intents are rejected');

  const cleaned = await fetch(`${baseUrl}/api/ai/chats/${chat.id}`, {
    method: 'DELETE',
    headers: auth,
  });
  assert.equal(cleaned.status, 200);
});

test('coach chat falls back to the notebook when every AI provider is down', async () => {
  const auth = { Authorization: `Bearer ${ownerToken}` };
  const create = await fetch(`${baseUrl}/api/ai/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ topic: 'STUDY_COACH' }),
  });
  assert.equal(create.status, 201);
  const { data: { chat } } = await create.json() as { data: { chat: { id: number } } };

  forceProviderFailure = true;
  try {
    const sent = await fetch(`${baseUrl}/api/ai/chats/${chat.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ message: 'Hôm nay học gì trước?', intent: 'plan' }),
    });
    assert.equal(sent.status, 201, 'the buddy still answers from real data');
    const body = await sent.json() as { data: { aiMessage: { content: string }; feedback: unknown[] } };
    const content = body.data.aiMessage.content;
    // The offline answer carries the learner's own numbers, not an apology.
    assert.match(content, /Việc tiếp theo/);
    assert.doesNotMatch(
      content,
      /tự lật sổ tay|Chào bạn|cố lên|Hỏi lại mình tí nữa/i,
      'no conversational filler in the fallback',
    );
    assert.deepEqual(body.data.feedback, []);
  } finally {
    forceProviderFailure = false;
  }

  const cleaned = await fetch(`${baseUrl}/api/ai/chats/${chat.id}`, { method: 'DELETE', headers: auth });
  assert.equal(cleaned.status, 200);
});

test('study plan notes reuse identical learner state, refresh after changes and retry a failed note', async () => {
  const identity = randomUUID();
  const [user] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
    [`plan-${identity.slice(0, 12)}`, `plan-${identity}@example.test`, 'integration fixture', 'Plan fixture'],
  );
  try {
    const { getStudyPlan } = await import('../src/modules/ai/ai.service');
    modelAnswers({ reply: 'Start with your unlocked lesson.' });
    const before = providerCallCount;
    const [first, duplicate] = await Promise.all([getStudyPlan(user.insertId), getStudyPlan(user.insertId)]);
    assert.equal(first.aiNote, 'Start with your unlocked lesson.');
    assert.equal(duplicate.aiNote, first.aiNote);
    assert.equal(providerCallCount - before, 1);

    const [[question]] = await pool.execute<Array<RowDataPacket & { id: number }>>('SELECT id FROM questions ORDER BY id LIMIT 1');
    assert.ok(question);
    await pool.execute(
      "INSERT INTO review_items (user_id, kind, ref_id, source, due_at) VALUES (?, 'question', ?, 'manual', NOW())",
      [user.insertId, question.id],
    );
    forceProviderFailure = true;
    const unavailable = await getStudyPlan(user.insertId);
    assert.equal(unavailable.aiNote, null);
    assert.equal(unavailable.snapshot.reviewDue, 1);
    forceProviderFailure = false;
    modelAnswers({ reply: 'Save a few minutes for the item now due.' });
    const refreshed = await getStudyPlan(user.insertId);
    assert.equal(refreshed.aiNote, 'Save a few minutes for the item now due.');
    assert.equal(refreshed.snapshot.reviewDue, 1);
  } finally {
    forceProviderFailure = false;
    await pool.execute('DELETE FROM users WHERE id = ?', [user.insertId]);
  }
});

test('the mobile plan is usable before the shared AI note finishes', async () => {
  const path = `${baseUrl}/api/ai/study-plan`;
  const headers = { Authorization: `Bearer ${otherToken}` };
  const note = Promise.withResolvers<Response>();
  waitForProviderCancellation = () => note.promise;
  const before = providerCallCount;
  const signal = AbortSignal.timeout(10_000);
  try {
    const response = await fetch(path, { headers: { ...headers, Accept: 'application/x-ndjson' }, signal });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /^application\/x-ndjson/);
    const preview = Promise.withResolvers<MobileStudyPlan>();
    const streamed = readStudyPlanStream(response.body, preview.resolve);
    const early = await Promise.race([preview.promise, streamed.then(() => assert.fail('Expected a plan before the note'))]);
    assert.equal(early.aiNote, null);
    assert.equal(early.steps.length, 3);
    assert.equal(early.steps[0].target.lessonId, early.snapshot.nextLesson?.id);
    assert.deepEqual(planDestination(early.steps[0])?.href, {
      pathname: '/lesson/[id]', params: { id: early.snapshot.nextLesson?.id },
    });
    assert.ok(early.steps.every((step) => planDestination(step) !== null));

    const legacy = fetch(path, { headers, signal });
    note.resolve(providerOk('Học bài đang mở để tiếp nối lộ trình.'));
    const final = await streamed;
    const legacyResponse = await legacy;
    assert.equal(legacyResponse.status, 200);
    assert.match(legacyResponse.headers.get('content-type') ?? '', /^application\/json/);
    const { data } = await legacyResponse.json();
    assert.equal(final.aiNote, 'Học bài đang mở để tiếp nối lộ trình.');
    assert.deepEqual(final.steps, early.steps);
    assert.deepEqual(final.snapshot, early.snapshot);
    assert.equal(data.aiNote, final.aiNote);
    assert.deepEqual(data.steps, final.steps);
    assert.equal(providerCallCount - before, 1);

    const warm = await fetch(path, { headers: { ...headers, Accept: 'application/x-ndjson' }, signal });
    const warmPlan = await readStudyPlanStream(warm.body, () => assert.fail('A cached note should arrive with its plan'));
    assert.equal(warmPlan.aiNote, final.aiNote);
    assert.equal(providerCallCount - before, 1);
  } finally {
    waitForProviderCancellation = null;
    note.resolve(providerOk('Học bài đang mở để tiếp nối lộ trình.'));
  }
});

test('coach chats use grounded recommendation and selection without changing the chat message contract', async () => {
  const repo = await import('../src/modules/ai/ai.repository');
  const chat = await repo.createChat(ownerId, 'STUDY_COACH');
  const post = async (message: string) => {
    const response = await fetch(`${baseUrl}/api/ai/chats/${chat.id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    assert.equal(response.status, 201);
    return (await response.json() as { data: Awaited<ReturnType<typeof import('../src/modules/ai/ai.service').sendMessage>> }).data;
  };
  try {
    providerRequestBody = null;
    const recommendation = await post('Recommend a lesson about job interview.');
    assert.equal(recommendation.userMessage.role, 'USER');
    assert.equal(recommendation.aiMessage.role, 'AI');
    assert.equal(recommendation.action, null);
    assert.ok(recommendation.actions?.some(({ lessonTitle }) => lessonTitle === 'Phỏng vấn xin việc'));
    const picked = await post('Open the first one.');
    assert.equal(picked.action?.lessonId, recommendation.actions?.[0]?.lessonId);
    assert.deepEqual(picked.feedback, []);
    assert.equal((await repo.getMessages(chat.id)).length, 4);
    assert.equal(providerRequestBody, null);

    const compound = await post('Open my vocabulary notebook and open translation.');
    assert.deepEqual(compound.actions?.map(({ kind, tab }) => [kind, tab]), [
      ['open_notebook', 'videos'], ['open_tab', 'translate'],
    ]);
    const second = await post('Open the second one.');
    assert.equal(second.action?.tab, 'translate');
    assert.equal((await post('Open the first one.')).action?.kind, 'open_notebook', 'history keeps the original option order');
    const url = `${baseUrl}/api/ai/chats/${chat.id}`;
    const auth = { Authorization: `Bearer ${ownerToken}` };
    const response = await fetch(`${url}?include=destinations`, { headers: auth });
    assert.equal(response.status, 200);
    const history = (await response.json()).data.messages;
    assert.deepEqual(history.find(({ id }: { id: number }) => id === compound.aiMessage.id).actions.map(({ tab }: { tab: string }) => tab), ['videos', 'translate']);
    assert.deepEqual(history.find(({ id }: { id: number }) => id === second.aiMessage.id).actions.map(({ tab }: { tab: string }) => tab), ['translate']);
    assert.ok(history.every(({ role }: { role: string }) => role !== 'SYSTEM'));
    const legacy = (await (await fetch(url, { headers: auth })).json()).data.messages;
    assert.ok(legacy.every((message: object) => !('actions' in message)));
    assert.equal((await fetch(`${url}?include=destinations`, { headers: { Authorization: `Bearer ${otherToken}` } })).status, 404);
    assert.equal(providerRequestBody, null, 'local destinations make no generation call');
  } finally {
    await repo.deleteChat(ownerId, chat.id);
  }
});

test('closing a chat request cancels the provider and leaves the unfinished turn unsaved', { timeout: 5000 }, async () => {
  const repo = await import('../src/modules/ai/ai.repository');
  const chat = await repo.createChat(ownerId, 'DAILY_CONVERSATION');
  const client = new AbortController();
  let notifyStarted: () => void = () => {};
  let notifyCancelled: () => void = () => {};
  const started = new Promise<void>((resolve) => { notifyStarted = resolve; });
  const cancelled = new Promise<void>((resolve) => { notifyCancelled = resolve; });
  waitForProviderCancellation = (signal) => new Promise((_resolve, reject) => {
    notifyStarted();
    const onAbort = () => {
      notifyCancelled();
      reject(signal.reason);
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    const sent = fetch(`${baseUrl}/api/ai/chats/${chat.id}/messages`, {
      method: 'POST',
      signal: client.signal,
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'I went to school yesterday.' }),
    });
    const closed = assert.rejects(sent, { name: 'AbortError' });
    await started;
    client.abort();
    await Promise.all([closed, cancelled]);
    assert.deepEqual(await repo.getMessages(chat.id), []);
  } finally {
    client.abort();
    waitForProviderCancellation = null;
    await repo.deleteChat(ownerId, chat.id);
  }
});

test('the mobile coach endpoint emits a draft before committing the existing message payload', { timeout: 5000 }, async () => {
  const repo = await import('../src/modules/ai/ai.repository');
  const chat = await repo.createChat(ownerId, 'STUDY_COACH');
  const encoder = new TextEncoder();
  const event = (value: object) => encoder.encode(`data: ${JSON.stringify(value)}\n\n`);
  let finish = () => {};
  const client = new AbortController();
  providerResponse = new Response(new ReadableStream<Uint8Array>({
    start(writer) {
      writer.enqueue(event({ choices: [{ delta: { content: '{"reply":"Dùng thì quá khứ đơn' } }] }));
      finish = () => {
        writer.enqueue(event({ choices: [{ delta: { content: ' để kể việc đã xong.","feedback":[]}' } }] }));
        writer.enqueue(encoder.encode('data: [DONE]\n\n'));
        writer.close();
      };
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } });

  try {
    const response = await fetch(`${baseUrl}/api/ai/chats/${chat.id}/messages`, {
      method: 'POST',
      signal: client.signal,
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify({ message: 'Giải thích cách dùng thì quá khứ đơn.' }),
    });
    assert.equal(response.status, 201);
    assert.match(response.headers.get('content-type') ?? '', /^application\/x-ndjson/);
    assert.equal(response.headers.get('x-accel-buffering'), 'no');
    let sawDraft!: (text: string) => void;
    const firstDraft = new Promise<string>((resolve) => { sawDraft = resolve; });
    const turn = readAiReplyStream(response.body, sawDraft);
    const draft = await Promise.race([firstDraft, turn.then(() => null)]);
    assert.equal(draft, 'Dùng thì quá khứ đơn');
    assert.deepEqual(await repo.getMessages(chat.id), []);
    finish();
    const answer = await turn;
    assert.equal(answer.userMessage.chat_id, chat.id);
    assert.equal(answer.aiMessage.content, 'Dùng thì quá khứ đơn để kể việc đã xong.');
    assert.deepEqual(answer.feedback, []);
    assert.deepEqual((await repo.getMessages(chat.id)).map(({ id }) => id), [answer.userMessage.id, answer.aiMessage.id]);

    const beforeGreeting = providerCallCount;
    const greeting = await fetch(`${baseUrl}/api/ai/chats/${chat.id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify({ message: 'Hello' }),
    });
    assert.equal(greeting.status, 201);
    const local = await readAiReplyStream(greeting.body, () => assert.fail('A greeting needs no draft'));
    assert.match(local.aiMessage.content, /^Hi/);
    assert.equal(providerCallCount, beforeGreeting);
  } finally {
    client.abort();
    await repo.deleteChat(ownerId, chat.id);
  }
});

test('a due review keeps its new schedule until the learner makes a newer mistake', async () => {
  const { answerItem, getQueue } = await import('../src/modules/analytics/review.service');
  const [[question]] = await pool.execute<Array<RowDataPacket & { question_id: number; answer_text: string }>>(
    'SELECT question_id, answer_text FROM answers WHERE is_correct = 1 ORDER BY id LIMIT 1',
  );
  assert.ok(question);
  const id = randomUUID();
  const [learner] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
    [`review-${id.slice(0, 12)}`, `review-${id}@example.test`, 'test fixture', 'Review learner'],
  );
  try {
    await pool.execute(
      `INSERT INTO learning_answer_attempts (user_id, question_id, submitted_answer, is_correct, created_at)
       VALUES (?, ?, 'mistake', FALSE, DATE_SUB(NOW(), INTERVAL 1 DAY))`,
      [learner.insertId, question.question_id],
    );
    const first = (await getQueue(learner.insertId)).due.find(({ ref_id }) => ref_id === question.question_id);
    assert.ok(first);
    const result = await answerItem(learner.insertId, first.id, { answer: question.answer_text, responseMs: 2_000 });
    assert.equal(result.grade, 'easy');
    const after = await getQueue(learner.insertId);
    assert.ok(!after.due.some(({ id: itemId }) => itemId === first.id));
    assert.ok(after.upcoming.some(({ id: itemId }) => itemId === first.id));

    await pool.execute('UPDATE review_items SET last_reviewed_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ?', [first.id]);
    await pool.execute(
      `INSERT INTO learning_answer_attempts (user_id, question_id, submitted_answer, is_correct, created_at)
       VALUES (?, ?, 'new mistake', FALSE, NOW())`, [learner.insertId, question.question_id],
    );
    const retry = await getQueue(learner.insertId);
    assert.ok(retry.due.some(({ id: itemId, mistake_count }) => itemId === first.id && mistake_count === 2));
  } finally {
    await pool.execute('DELETE FROM users WHERE id = ?', [learner.insertId]);
  }
});

async function askBuddy(message: string, token = ownerToken) {
  const response = await fetch(`${baseUrl}/api/buddy/ask`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  assert.equal(response.status, 200);
  return (await response.json() as { data: import('../src/modules/ai/ai.service').BuddyAnswer }).data;
}

// The buddy makes one model call per turn. modelAnswers stands in for the JSON the
// model picks; the app's job under test is to validate and ground that choice.
function modelAnswers(payload: Record<string, unknown>): void {
  providerResponse = jsonResponse({
    choices: [{
      message: {
        content: JSON.stringify({ feedback: [], followups: [], action: null, reminder: null, ...payload }),
      },
    }],
  });
}

function systemPrompt(): string {
  return providerRequestBody?.messages?.[0]?.content ?? '';
}

test('Buddy saves standalone greetings without calling the model', async () => {
  providerRequestBody = null;
  const vietnamese = await askBuddy('Xin chào!');
  const english = await askBuddy('Hi.');
  assert.equal(vietnamese.language, 'vi');
  assert.equal(english.language, 'en');
  assert.equal(english.route, 'open_prompt');
  assert.equal(english.action, null);
  assert.equal(providerRequestBody, null);

  const { getConversationHistory, ensureCoachChat } = await import('../src/modules/ai/ai.repository');
  const messages = await getConversationHistory(await ensureCoachChat(ownerId), 4);
  assert.deepEqual(messages.map((entry) => entry.content), [
    'Xin chào!', vietnamese.reply, 'Hi.', english.reply,
  ]);

  modelAnswers({ reply: 'Mình giúp bạn chọn bài tiếp theo nhé.' });
  const question = await askBuddy('Xin chào, hôm nay mình học gì?');
  assert.equal(question.reply, 'Mình giúp bạn chọn bài tiếp theo nhé.');
  assert.ok(providerRequestBody);
});

test('Buddy answers complete social turns locally and keeps appended learning questions', async () => {
  providerRequestBody = null;
  const streaming = await askBuddy('Good morning. How are you today?');
  const recorded = await askBuddy('Good morning! How are you today?');
  assert.equal(streaming.reply, recorded.reply);
  assert.match(streaming.reply, /^Good morning! I'm doing well, thanks/u);
  assert.equal(streaming.language, 'en');
  assert.equal(streaming.action, null);
  assert.ok(streaming.followups.includes('How many items are due for review?'));

  const vietnamese = await askBuddy('Chào buổi sáng! Bạn khỏe không?');
  assert.equal(vietnamese.language, 'vi');
  assert.match(vietnamese.reply, /^Mình khỏe, cảm ơn bạn!/u);
  assert.equal(vietnamese.action, null);
  const due = await askBuddy(vietnamese.followups[0]);
  assert.match(due.reply, /ôn/u);
  assert.equal(providerRequestBody, null);

  modelAnswers({ reply: 'Use “Good morning” before noon.' });
  const lesson = await askBuddy('Good morning! How are you today? Can you explain when to say good morning?');
  assert.match(lesson.reply, /before noon/u);
  assert.ok(providerRequestBody);
});

test('Buddy supplies a real answer for a standard cloze exercise and routes custom exercises to the model', async () => {
  providerRequestBody = null;
  const english = await askBuddy('Give me one fill-in-the-blank exercise about the past simple. Put the answer at the end.');
  assert.equal((english.reply.match(/___/g) ?? []).length, 1);
  const expected = { go: 'went', visit: 'visited', buy: 'bought' } as const;
  const verb = /___ \((go|visit|buy)\)/u.exec(english.reply)?.[1] as keyof typeof expected | undefined;
  assert.ok(verb);
  assert.equal(english.reply.split('\n').at(-1), `Answer: ${expected[verb]}`);
  const vietnamese = await askBuddy('Ra cho mình một bài điền vào chỗ trống về thì hiện tại đơn, ghi đáp án ở cuối bài.');
  assert.match(vietnamese.reply, /\nĐáp án: (?:walks|studies|closes)$/u);
  assert.equal(providerRequestBody, null);

  modelAnswers({ reply: 'Write a story using both the past simple and the past perfect.' });
  const custom = await askBuddy('Give me one fill-in-the-blank exercise comparing past simple and past perfect.');
  assert.match(custom.reply, /past perfect/u);
  assert.ok(providerRequestBody);
});

test('Buddy resolves exact navigation locally and checks model actions for other requests', async () => {
  providerRequestBody = null;
  const profile = await askBuddy('Chuyển tab sang Hồ sơ');
  assert.equal(profile.action?.tab, 'profile');
  assert.equal(profile.route, 'navigate');
  assert.equal(providerRequestBody, null, 'an exact command bypasses the model');

  modelAnswers({ reply: 'Nút Tìm trận nằm ở Thi Đua.', action: { kind: 'spotlight', tab: 'compete', highlight: 'control:arena-start' } });
  const match = await askBuddy('Tìm trận đấu giúp mình');
  assert.equal(match.action?.tab, 'compete');
  assert.equal(match.action?.highlight, 'control:arena-start');

  modelAnswers({ reply: 'Mở bài 999.', action: { kind: 'open_lesson', lessonId: 999999999 } });
  const invented = await askBuddy('Mở bài 999');
  assert.equal(invented.action, null, 'an id outside the learner data never becomes a navigation');
  assert.equal(invented.route, 'open_prompt');
  assert.match(systemPrompt(), /"lesson_catalog":/);

  modelAnswers({ reply: 'Mình mua khiên cho bạn.', action: { kind: 'buy_shop_item', itemCode: 'booster_streak_shield' } });
  const buy = await askBuddy('mua khiên');
  assert.equal(buy.action?.kind, 'show_shop_item', 'the buddy opens the item card and never buys it');
});

test('Buddy answers a balance question from the grounded wallet and keeps the spotlight', async () => {
  const { getWallet } = await import('../src/modules/gamification/gamification.service');
  const wallet = await getWallet(ownerId);
  providerRequestBody = null;
  const data = await askBuddy('How many RC do I have?');
  assert.equal(data.reply, `You have ${wallet.coins} RC.`);
  assert.equal(data.language, 'en');
  assert.equal(data.action?.highlight, 'wallet:summary');
  assert.equal(data.route, 'navigate');
  assert.equal(providerRequestBody, null);
});

test('Buddy reports only the learner’s due review items and suggests opening review', async () => {
  const [[question]] = await pool.execute<Array<RowDataPacket & { id: number }>>(
    'SELECT id FROM questions ORDER BY id LIMIT 1',
  );
  assert.ok(question);
  const [row] = await pool.execute<ResultSetHeader>(
    "INSERT INTO review_items (user_id, kind, ref_id, source, due_at) VALUES (?, 'question', ?, 'manual', NOW())",
    [ownerId, question.id],
  );
  try {
    providerRequestBody = null;
    const due = await askBuddy('How many items are due for review?');
    assert.equal(due.reply, 'You have 1 item due for review.');
    assert.equal(due.action, null);
    assert.deepEqual(due.followups, ['Open review']);
    assert.equal((await askBuddy(due.followups[0])).action?.kind, 'open_review');
    const localized = await askBuddy('Hôm nay mình còn bao nhiêu mục cần ôn tập?');
    assert.equal(localized.reply, 'Bạn có 1 mục đến hạn ôn tập.');
    const other = await askBuddy('How many items are due for review?', otherToken);
    assert.equal(other.reply, 'Nothing is due for review right now.');
    assert.deepEqual(other.followups, []);
    assert.equal(providerRequestBody, null);

    const timed = await askBuddy('I only have ten minutes. What should I study first?');
    assert.equal(timed.action, null);
    assert.equal(timed.actions?.[0]?.kind, 'open_review');
    assert.match(timed.reply, /Review 1 due item \(1 min\)/u);
    const minutes = [...timed.reply.matchAll(/\((\d+) min\)/gu)].reduce((sum, part) => sum + Number(part[1]), 0);
    assert.ok(minutes > 0 && minutes <= 10);
    const short = await askBuddy('Mình chỉ có 2 phút, nên học gì trước?');
    assert.match(short.reply, /Dùng khoảng [12]\/2 phút/u);
    assert.equal(short.actions?.[0]?.kind, 'open_review');
    assert.equal(providerRequestBody, null);

    modelAnswers({ reply: 'Here is your review plan and one practice exercise.' });
    const compound = await askBuddy('How many items are due for review, and give me a practice exercise.');
    assert.equal(compound.reply, 'Here is your review plan and one practice exercise.');
    assert.ok(providerRequestBody);
  } finally {
    await pool.execute('DELETE FROM review_items WHERE id = ? AND user_id = ?', [row.insertId, ownerId]);
  }
});

test('Buddy returns separate grounded destinations and a reminder in one reply', async () => {
  modelAnswers({
    reply: 'Mình đã tìm Sổ từ và mục Ôn tập. Bạn chọn mục để mở và xác nhận lời nhắc bên dưới.',
    action: { kind: 'open_notebook', label: 'Mở Sổ từ' },
    actions: [
      { kind: 'open_notebook', label: 'Sổ từ của mình' },
      { kind: 'open_video', videoId: 999999999 },
      { kind: 'open_review', label: 'Ôn tập' },
    ],
    reminder: { title: 'Ôn từ vựng', in_minutes: 20 },
  });
  const answer = await askBuddy('Nhắc mình ôn từ sau 20 phút rồi mở Sổ từ và mở bài ôn tập.');
  assert.equal(answer.keepChatOpen, true);
  assert.equal(answer.action?.kind, 'open_notebook', 'the first valid destination remains available to older clients');
  assert.deepEqual(answer.actions?.map(({ kind }) => kind), ['open_notebook', 'open_review']);
  assert.equal(answer.suggestion?.in_minutes, 20);
  assert.equal(answer.route, 'navigate');
});

test('Buddy composes exact destinations and a separate reminder locally without saving the reminder', async () => {
  const [[before]] = await pool.execute<Array<RowDataPacket & { total: number }>>(
    'SELECT COUNT(*) AS total FROM study_reminders WHERE user_id = ?', [ownerId],
  );
  providerRequestBody = null;
  const result = await askBuddy('Open my vocabulary notebook, then open my review queue, and remind me in 20 minutes to review vocabulary.');
  assert.deepEqual(result.actions?.map(({ kind }) => kind), ['open_notebook', 'open_review']);
  assert.equal(result.action?.kind, 'open_notebook');
  assert.equal(result.suggestion?.in_minutes, 20);
  assert.equal(result.keepChatOpen, true);
  const [[after]] = await pool.execute<Array<RowDataPacket & { total: number }>>(
    'SELECT COUNT(*) AS total FROM study_reminders WHERE user_id = ?', [ownerId],
  );
  assert.equal(after.total, before.total);
  assert.equal(providerRequestBody, null);
});

test('Buddy remembers ordered destinations and exposes only ordinary chat messages', async () => {
  const repo = await import('../src/modules/ai/ai.repository');
  const chatId = await repo.ensureCoachChat(ownerId);
  const destinations = [
    { kind: 'open_notebook', tab: 'videos', label: 'Notebook' },
    { kind: 'open_review', tab: 'profile', label: 'Review' },
  ] as const;
  await repo.saveConversation(ownerId, chatId, 'Find my notebook and review queue.', 'Here are two places to continue.', [], destinations);
  const visible = await repo.getMessages(chatId);
  assert.deepEqual(visible.slice(-2).map(({ content }) => content), [
    'Find my notebook and review queue.', 'Here are two places to continue.',
  ]);
  assert.ok(visible.every(({ content }) => !content.startsWith('engorace:buddy-destinations')));
  assert.equal((await repo.getChat(ownerId, chatId))?.last_message, 'Here are two places to continue.');

  providerRequestBody = null;
  const exact = await askBuddy('Mở cái thứ hai');
  assert.equal(exact.action?.kind, 'open_review');
  const first = await askBuddy('Open the first one.');
  assert.equal(first.action?.kind, 'open_notebook');
  assert.equal(providerRequestBody, null);

  modelAnswers({ reply: 'You can review old exercises in the review queue.' });
  await askBuddy('Can I practice something like the second one?');
  assert.match(systemPrompt(), /RECENT_DESTINATIONS_JSON: .*"option":2,"destination":\{"kind":"open_review"/);
});

test('Remembered videos are rechecked after their visibility changes', async () => {
  const repo = await import('../src/modules/ai/ai.repository');
  const [video] = await pool.execute<ResultSetHeader>(
    `INSERT INTO video_lessons
       (code, title, topic, cefr_level, provider, video_url, duration_seconds, xp_reward, sort_order, published_at)
     VALUES (?, 'Temporary listening exercise', 'Travel', 'A1', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 3600, 10, 65535, NOW())`,
    [randomUUID()],
  );
  try {
    const chatId = await repo.ensureCoachChat(ownerId);
    await repo.saveConversation(ownerId, chatId, 'Show both review and the listening video.', 'Here are the two places.', [], [
      { kind: 'open_review', tab: 'profile', label: 'Review' },
      { kind: 'open_video', tab: 'videos', label: 'Listening exercise', videoId: video.insertId },
    ]);
    await pool.execute('UPDATE video_lessons SET published_at = NULL WHERE id = ?', [video.insertId]);
    providerRequestBody = null;
    const answer = await askBuddy('Open the second one.');
    assert.equal(answer.action, null);
    assert.match(answer.reply, /no longer available/);
    assert.equal(providerRequestBody, null);
  } finally {
    await pool.execute('DELETE FROM video_lessons WHERE id = ?', [video.insertId]);
  }
});

test('Buddy retrieves a relevant earlier language example only from the same coach chat', async () => {
  const repo = await import('../src/modules/ai/ai.repository');
  const chatId = await repo.ensureCoachChat(ownerId);
  const savedExample = 'We toured Kyoto before sunrise.';
  await repo.saveConversation(ownerId, chatId,
    `In the Kyoto sightseeing exercise I wrote “${savedExample}”`, 'Good use of the simple past.', []);
  await repo.saveConversation(ownerId, chatId, 'I like kimchi.', 'That is a delicious topic.', []);
  for (let index = 0; index < 5; index++) {
    await repo.saveConversation(ownerId, chatId, 'Let’s talk about vegetables.', 'What do you like to eat?', []);
  }
  modelAnswers({ reply: savedExample });
  const recalled = await askBuddy('What example did we use about Kyoto sightseeing earlier?');
  assert.equal(recalled.reply, savedExample);
  const memory = /^RELEVANT_PAST_TURNS_JSON: (.+)$/mu.exec(systemPrompt())?.[1] ?? '';
  assert.ok(memory.includes(savedExample));
  assert.ok(!memory.includes('kimchi'));
  assert.equal(providerRequestBody?.messages?.slice(1).some(({ content }) => content.includes(savedExample)), false);

  modelAnswers({ reply: 'What do you like to eat?' });
  await askBuddy('Let’s talk about vegetables again.');
  assert.doesNotMatch(systemPrompt(), /RELEVANT_PAST_TURNS_JSON/);
  modelAnswers({ reply: 'I do not have an earlier example.' });
  await askBuddy('What example did we use about Kyoto sightseeing earlier?', otherToken);
  assert.ok(!systemPrompt().includes(savedExample));
});

test('the tutor recalls an older example from its own chat and keeps normal history and feedback', async () => {
  const repo = await import('../src/modules/ai/ai.repository');
  const { sendMessage } = await import('../src/modules/ai/ai.service');
  const tutor = await repo.createChat(ownerId, 'TRAVEL');
  const anotherTutor = await repo.createChat(ownerId, 'TRAVEL');
  const example = 'We visited Kyoto before sunrise.';
  const recall = 'What example did we use about Kyoto sightseeing earlier?';
  try {
    await repo.saveConversation(ownerId, tutor.id, `For Kyoto sightseeing I wrote: “${example}”`, 'Good use of the simple past.', []);
    for (let index = 0; index < 6; index++) {
      await repo.saveConversation(ownerId, tutor.id, 'I like orange juice.', 'What other drinks do you like?', []);
    }

    const decisions = decisionCalls;
    modelAnswers({ reply: example });
    const recalled = await sendMessage(ownerId, tutor.id, recall);
    assert.equal(recalled.aiMessage.content, example);
    assert.equal(recalled.action, null);
    assert.equal(decisionCalls, decisions);
    assert.match(systemPrompt(), /^RELEVANT_PAST_TURNS_JSON: .*We visited Kyoto before sunrise\./m);
    assert.ok(providerRequestBody?.messages?.slice(1, -1).every(({ content }) => !content.includes(example)));
    assert.equal(providerRequestBody?.messages?.length, 12);

    modelAnswers({ reply: 'I do not have that example here.' });
    await sendMessage(ownerId, anotherTutor.id, recall);
    assert.match(systemPrompt(), /^RELEVANT_PAST_TURNS_JSON: \[\]$/m);
    assert.ok(providerRequestBody?.messages?.every(({ content }) => !content.includes(example)));

    modelAnswers({ reply: 'What did you do at school?', feedback: [
      { type: 'TENSE', original_text: 'goed', corrected_text: 'went', explanation: 'Dùng went cho thì quá khứ.' },
    ] });
    const ordinary = await sendMessage(ownerId, tutor.id, 'Yesterday I goed to school.');
    assert.doesNotMatch(systemPrompt(), /RELEVANT_PAST_TURNS_JSON/);
    assert.match(systemPrompt(), /LEARNER_DATA_JSON/);
    assert.ok(ordinary.feedback.some(({ corrected_text }) => corrected_text === 'went'));
    assert.equal(decisionCalls, decisions);
  } finally {
    await repo.deleteChat(ownerId, tutor.id);
    await repo.deleteChat(ownerId, anotherTutor.id);
  }
});

test('the first tutor greeting opens the selected topic even when the models are unavailable', async () => {
  const repo = await import('../src/modules/ai/ai.repository');
  const tutor = await repo.createChat(ownerId, 'TRAVEL');
  const send = (message: string, accept = 'application/json') => fetch(`${baseUrl}/api/ai/chats/${tutor.id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json', Accept: accept },
    body: JSON.stringify({ message }),
  });
  const before = providerCallCount;
  try {
    forceProviderFailure = true;
    const first = await send('Chào bạn!', 'application/x-ndjson');
    assert.equal(first.status, 201);
    const greeting = await readAiReplyStream(first.body, () => assert.fail('The opening is already complete'));
    assert.equal(greeting.aiMessage.content, 'Hi! Where would you like to travel?');
    assert.equal(greeting.action, null);
    assert.deepEqual(greeting.feedback, []);
    assert.equal(providerCallCount, before);
    assert.deepEqual((await repo.getMessages(tutor.id)).map(({ content }) => content), ['Chào bạn!', greeting.aiMessage.content]);

    forceProviderFailure = false;
    modelAnswers({ reply: 'Hello again! Do you have a destination in mind?' });
    const repeated = await send('Hello!');
    assert.equal(repeated.status, 201);
    assert.equal((await repeated.json()).data.aiMessage.content, 'Hello again! Do you have a destination in mind?');
    assert.equal(providerCallCount, before + 1);
  } finally {
    forceProviderFailure = false;
    await repo.deleteChat(ownerId, tutor.id);
  }
});

test('the tutor uses brief DeepSeek reasoning only for uncomplicated practice', async () => {
  const repo = await import('../src/modules/ai/ai.repository');
  const tutor = await repo.createChat(ownerId, 'DAILY_CONVERSATION');
  const previous = { thApiKey: env.thApiKey, thApiUrl: env.thApiUrl, thModel: env.thModel };
  Object.assign(env, { thApiKey: 'test-primary', thApiUrl: env.aiApiUrl, thModel: 'deepseek-v4.1-flash-1017' });
  const send = (message: string) => fetch(`${baseUrl}/api/ai/chats/${tutor.id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  try {
    modelAnswers({ reply: 'What did you do at school?', feedback: [
      { type: 'TENSE', original_text: 'goed', corrected_text: 'went', explanation: '“Went” là quá khứ của “go”.' },
    ] });
    const short = await send('Yesterday I goed to school.');
    assert.equal(short.status, 201);
    assert.equal(providerRequestBody?.reasoning_effort, 'none');
    const { data } = await short.json();
    assert.equal(data.feedback[0].corrected_text, 'went');

    modelAnswers({ reply: 'That is a good example of the third conditional. How did you hear the news?' });
    const complex = await send('I would have gone if I had heard the news.');
    assert.equal(complex.status, 201);
    assert.equal(providerRequestBody?.reasoning_effort, 'low');
    assert.equal((await complex.json()).data.action, null);

    modelAnswers({ reply: 'What did you like about your example?' });
    const reference = await send('I enjoyed it.');
    assert.equal(reference.status, 201);
    assert.equal(providerRequestBody?.reasoning_effort, 'low');
    assert.match(systemPrompt(), /name it in the reply/);
    assert.ok((await reference.json()).data.aiMessage.content);
  } finally {
    Object.assign(env, previous);
    await repo.deleteChat(ownerId, tutor.id);
  }
});

test('Concurrent first Buddy requests reuse one coach chat while the chat API can create another', async () => {
  const userIds: number[] = [];
  try {
    for (let index = 0; index < 2; index++) {
      const id = randomUUID();
      const [user] = await pool.execute<ResultSetHeader>(
        'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
        [`race-${id.slice(0, 12)}`, `race-${id}@example.test`, 'integration fixture', 'Coach race'],
      );
      userIds.push(user.insertId);
    }
    const repo = await import('../src/modules/ai/ai.repository');
    const results = await Promise.all(userIds.map((id) =>
      Promise.all(Array.from({ length: 6 }, () => repo.ensureCoachChat(id)))));
    assert.notEqual(results[0][0], results[1][0]);
    for (const [index, ids] of results.entries()) {
      const id = userIds[index];
      assert.equal(new Set(ids).size, 1);
      assert.equal((await repo.listChats(id)).length, 1);
      const separate = await repo.createChat(id, 'STUDY_COACH');
      assert.notEqual(separate.id, ids[0]);
      assert.equal(await repo.ensureCoachChat(id), ids[0]);
    }
  } finally {
    if (userIds.length) await pool.execute(`DELETE FROM users WHERE id IN (${userIds.map(() => '?').join(', ')})`, userIds);
  }
});

test('Buddy answers notebook questions from the learner’s private saved vocabulary', async () => {
  const { saveWord, deleteSavedWord } = await import('../src/modules/video/video.repository');
  await saveWord(ownerId, 'well-known', '/ˌwel ˈnəʊn/', 'nổi tiếng trong bài nghe của Minh', 'dùng trước danh từ', null);
  try {
    providerRequestBody = null;
    const english = await askBuddy('What does “well-known” mean in my notebook?');
    assert.match(english.reply, /nổi tiếng trong bài nghe của Minh/u);
    assert.match(english.reply, /dùng trước danh từ/u);
    assert.equal(english.language, 'en');
    assert.equal(english.action, null);
    const vietnamese = await askBuddy('Tra nghĩa từ well-known trong Sổ từ vựng của mình');
    assert.match(vietnamese.reply, /nổi tiếng trong bài nghe của Minh/u);
    const recent = await askBuddy('Liệt kê những từ mình mới lưu');
    assert.match(recent.reply, /well-known/u);
    assert.deepEqual(recent.followups, ['Mở Sổ từ']);
    const other = await askBuddy('What does “well-known” mean in my notebook?', otherToken);
    assert.match(other.reply, /couldn’t find/u);
    assert.doesNotMatch(other.reply, /Minh/u);
    assert.equal(providerRequestBody, null);
  } finally {
    await deleteSavedWord(ownerId, 'well-known');
  }
});

test('Buddy recommends published videos and gives a safe action for a locked lesson', async () => {
  const entries = [
    { name: 'Fixture grocery shopping A2', level: 'A2', owner: null, published: true },
    { name: 'Fixture grocery shopping A1', level: 'A1', owner: null, published: true },
    { name: 'Fixture private grocery shopping', level: 'A2', owner: ownerId, published: true },
    { name: 'Fixture unpublished grocery shopping', level: 'A2', owner: null, published: false },
  ];
  const ids: number[] = [];
  try {
    for (const entry of entries) {
      const [video] = await pool.execute<ResultSetHeader>(
        `INSERT INTO video_lessons
          (code, title, topic, cefr_level, provider, video_url, duration_seconds, xp_reward, sort_order, owner_user_id, published_at)
         VALUES (?, ?, 'Grocery shopping', ?, 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 3600, 10, 65535, ?, ?)`,
        [randomUUID(), entry.name, entry.level, entry.owner, entry.published ? new Date() : null],
      );
      ids.push(video.insertId);
    }
    providerRequestBody = null;
    const videos = await askBuddy('Gợi ý video về đi siêu thị A2.');
    assert.equal(videos.action, null);
    assert.equal(videos.route, 'open_prompt');
    assert.ok(videos.actions?.some(({ videoId }) => videoId === ids[0]));
    assert.ok(!videos.actions?.some(({ videoId }) => ids.slice(1).includes(videoId ?? 0)));
    assert.equal((await askBuddy('Open the first one.')).action?.kind, 'open_video');
    const lessons = await askBuddy('Recommend a lesson about job interview.');
    assert.equal(lessons.action, null);
    assert.ok(lessons.actions?.some(({ lessonTitle, mode }) => lessonTitle === 'Phỏng vấn xin việc' && mode === 'reveal'));
    const review = await askBuddy('What should I review next?');
    assert.equal(review.action, null);
    assert.equal(review.actions?.[0]?.kind, 'open_review');
    assert.equal(providerRequestBody, null);
  } finally {
    if (ids.length) await pool.execute(`DELETE FROM video_lessons WHERE id IN (${ids.map(() => '?').join(', ')})`, ids);
  }
});

test('Buddy matches conversational requests by level, duration and video-library ownership', async () => {
  const topic = `shortvideo${randomUUID().replaceAll('-', '')}`;
  const length = [75, 120, 480, 60, 90];
  const ids: number[] = [];
  try {
    for (const [index, seconds] of length.entries()) {
      const [item] = await pool.execute<ResultSetHeader>(
        `INSERT INTO video_lessons
          (code, title, topic, cefr_level, provider, video_url, duration_seconds, xp_reward, sort_order, owner_user_id, published_at)
         VALUES (?, ?, ?, ?, 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ?, 10, 65535, ?, NOW())`,
        [randomUUID(), `Video ${index + 1}`, topic, index === 4 ? 'A1' : 'A2', seconds, index === 3 ? ownerId : null],
      );
      ids.push(item.insertId);
    }
    providerRequestBody = null;
    const strict = await askBuddy(`Could you recommend a short video about ${topic} A2 under two minutes?`);
    assert.deepEqual(strict.actions?.map(({ videoId }) => videoId), [ids[0]]);
    assert.equal(strict.action, null);
    assert.match(strict.reply, /1:15/);
    const inclusive = await askBuddy(`Có video A2 nào về ${topic} không quá 2 phút không?`);
    assert.deepEqual(inclusive.actions?.map(({ videoId }) => videoId), ids.slice(0, 2));
    const privateQuery = `Any of my private A2 videos about ${topic}?`;
    assert.deepEqual((await askBuddy(privateQuery)).actions?.map(({ videoId }) => videoId), [ids[3]]);
    assert.equal((await askBuddy(privateQuery, otherToken)).actions, undefined);
    assert.equal((await askBuddy(`Any B2 videos about ${topic}?`)).actions, undefined);
    assert.equal((await askBuddy(`Find a video about ${topic} A2 under 2 minutes.`, otherToken)).action?.videoId, ids[0]);
    assert.equal(providerRequestBody, null);

    modelAnswers({ reply: 'Opening the long video.', action: { kind: 'open_video', videoId: ids[2] } });
    const checked = await askBuddy(`Find a video about ${topic} A2 under 5 minutes.`, otherToken);
    assert.doesNotMatch(checked.reply, /Opening the long video/);
    const choices = checked.actions ?? (checked.action ? [checked.action] : []);
    assert.ok(choices.length && choices.every(({ videoId }) => ids.slice(0, 2).includes(videoId ?? 0)));
    assert.match(systemPrompt(), /"duration_seconds":480/);
  } finally {
    if (ids.length) await pool.execute(`DELETE FROM video_lessons WHERE id IN (${ids.map(() => '?').join(', ')})`, ids);
  }
});

test('Buddy streams reply text before transport completion and keeps the final JSON contract', async () => {
  const encoder = new TextEncoder();
  const sse = (data: object) => encoder.encode(`data: ${JSON.stringify(data)}\r\n\r\n`);
  let completeProvider = () => {};
  providerResponse = new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(sse({ choices: [{ delta: {
        reasoning_content: 'Private thinking',
        content: '{"reply":"Regular verbs',
      } }] }));
      completeProvider = () => {
        controller.enqueue(sse({ choices: [{ delta: { content: ' often add -ed.","feedback":[]}' }, finish_reason: 'stop' }] }));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      };
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
  const response = await fetch(`${baseUrl}/api/buddy/ask`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson',
    },
    body: JSON.stringify({ message: 'Explain regular past tense verbs' }),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^application\/x-ndjson/);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let output = '';
  try {
    while (!output.includes('\n')) {
      const chunk = await reader.read();
      assert.equal(chunk.done, false);
      output += decoder.decode(chunk.value, { stream: true });
    }
    assert.deepEqual(JSON.parse(output.trim()), { type: 'draft', text: 'Regular verbs' });
  } finally {
    completeProvider();
  }
  for (;;) {
    const chunk = await reader.read();
    output += decoder.decode(chunk.value, { stream: !chunk.done });
    if (chunk.done) break;
  }
  const answer = JSON.parse(output.trim().split('\n').at(-1) ?? '');
  assert.equal(answer.type, 'answer');
  assert.equal(answer.data.reply, 'Regular verbs often add -ed.');
  assert.equal(answer.data.action, null);
  assert.doesNotMatch(output, /Private thinking/);
});

test('Buddy labels the language of the reply, even if the question used the other language', async () => {
  modelAnswers({ reply: 'A verb describes an action. For example, “đọc sách” means “read a book”.' });
  assert.equal((await askBuddy('Động từ dùng để làm gì?')).language, 'en');

  modelAnswers({ reply: 'Động từ chỉ hành động hoặc trạng thái. Ví dụ “The dog runs”.' });
  assert.equal((await askBuddy('What is a verb?')).language, 'vi');

  modelAnswers({ reply: 'The café is open.' });
  assert.equal((await askBuddy('Từ này đặt câu ra sao?')).language, 'en');
});

test('Buddy keeps grammar explanations in chat and still opens explicitly requested destinations', async () => {
  const explanation = 'Use the past simple for finished actions, as in “I walked to school yesterday.”';
  const action = { kind: 'open_review', tab: 'profile' } as const;
  modelAnswers({ reply: explanation, action });
  const learningQuestion = await askBuddy('How can I use the past simple in a conversation?');
  assert.equal(learningQuestion.reply, explanation);
  assert.equal(learningQuestion.action, null);
  assert.equal(learningQuestion.route, 'open_prompt');
  assert.equal(learningQuestion.actions?.[0]?.kind, 'open_review');
  assert.equal((await askBuddy('Open the first one.')).action?.kind, 'open_review');

  modelAnswers({ reply: explanation, action });
  const combined = await askBuddy('Explain the past simple and then open my review queue.');
  assert.equal(combined.reply, explanation);
  assert.equal(combined.action?.kind, 'open_review');
});

test('Buddy opens weekly rankings from a polite, noisy voice transcript', async () => {
  providerRequestBody = null;
  const answer = await askBuddy('Xin chào bạn có thể vô máy xếp hạng cho tôi được không? Rồi anh ấy.');
  assert.equal(answer.route, 'navigate');
  assert.equal(answer.action?.tab, 'rankings');
  assert.equal(answer.action?.highlight, 'rank:me');
  assert.equal(providerRequestBody, null);
});

test('Buddy recovers an action omitted by the model for opening and introducing a car', async () => {
  const { getShop } = await import('../src/modules/gamification/gamification.service');
  const car = (await getShop(ownerId)).items.find(({ code }) => code === 'car_sport_red');
  assert.ok(car);
  modelAnswers({ reply: 'Mình đã mở thẻ xe cho bạn.' });
  const answer = await askBuddy(`Bạn có thể mở ra và giới thiệu cho tôi ${car.name} không?`);
  assert.equal(answer.action?.itemCode, car.code);
  assert.equal(answer.action?.highlight, `shop:${car.code}`);
  assert.equal(answer.route, 'navigate');
  assert.equal(answer.keepChatOpen, true);
  assert.ok(answer.reply.includes(car.name));
});

test('Buddy resolves a fresh confirmed offer to the exact item in the learner shop', async () => {
  const { getShop } = await import('../src/modules/gamification/gamification.service');
  const { ensureCoachChat, saveConversation } = await import('../src/modules/ai/ai.repository');
  const car = (await getShop(ownerId)).items.find(({ code }) => code === 'car_sport_red');
  assert.ok(car);
  const chatId = await ensureCoachChat(ownerId);
  await saveConversation(ownerId, chatId, 'Mở và giới thiệu một chiếc xe cho mình.',
    `Có vài xe phù hợp. Mình mở thẻ ${car.name} nhé?`, []);
  providerRequestBody = null;
  const confirmed = await askBuddy('oke');
  assert.equal(confirmed.action?.itemCode, car.code);
  assert.equal(providerRequestBody, null);

  modelAnswers({ reply: 'Được nhé.' });
  assert.equal((await askBuddy('oke')).action, null, 'an acknowledgement does not replay an executed action');
});

test('a chat turn ships the first draft with no review call, and falls back to offline copy when providers fail', async () => {
  const { answerTurn } = await import('../src/modules/ai/ai.pipeline');
  const decisionsBefore = decisionCalls;
  providerResponse = providerOk('The first draft');
  const tutor = await answerTurn({ messages: [], flavor: 'tutor', offline: null });
  assert.equal(tutor.reply, 'The first draft');
  assert.equal(decisionCalls, decisionsBefore, 'the draft is not sent to a review model');

  const offline = { reply: 'Offline answer', action: null, reminder: null, feedback: [], followups: [] };
  forceProviderFailure = true;
  try {
    const coach = await answerTurn({ messages: [], flavor: 'coach', offline });
    assert.deepEqual(coach, offline);
    await assert.rejects(answerTurn({ messages: [], flavor: 'tutor', offline: null }));
  } finally {
    forceProviderFailure = false;
  }
});

test('Buddy turns a model lesson pick into a locked or open lesson from real progress', async () => {
  const { getStudyStats } = await import('../src/modules/ai/ai.repository');
  const { pickNextLesson } = await import('../src/modules/ai/ai.study');
  const stats = await getStudyStats(ownerId);
  const frontier = pickNextLesson(stats);
  assert.ok(frontier);
  const firstIndex = stats.lessons.findIndex(({ id }) => id === frontier.id);
  const next = stats.lessons[firstIndex + 1];
  assert.ok(next);

  // The model asks for a lesson past the frontier; the app locks it and names the real next step.
  modelAnswers({ reply: 'Bài này học ngay bây giờ.', action: { kind: 'open_lesson', lessonId: next.id, mode: 'open' } });
  const locked = await askBuddy(`Mở bài ${next.title}`);
  assert.equal(locked.action?.lessonId, next.id);
  assert.equal(locked.action?.mode, 'reveal');
  assert.equal(locked.action?.highlight, `lesson:${next.id}`);
  assert.ok(locked.reply.includes(frontier.title));
  assert.match(locked.reply, /hoàn thành 1 bài/);

  modelAnswers({ reply: 'Mở bài tiếp theo của bạn.', action: { kind: 'open_lesson', lessonId: frontier.id, mode: 'open' } });
  const open = await askBuddy(`Mở bài ${frontier.title}`);
  assert.equal(open.action?.lessonId, frontier.id);
  assert.equal(open.action?.mode, 'open');
  assert.equal(open.reply, 'Mở bài tiếp theo của bạn.');

  modelAnswers({ reply: 'Mình chưa thấy bài đó trong dữ liệu của bạn.' });
  const missing = await askBuddy('Bài 9999 là gì?');
  assert.equal(missing.action, null);
  assert.equal(missing.route, 'open_prompt');
});

test('Buddy opens private videos only for the owner and prefers unfinished public random picks', async () => {
  const { buildBuddySnapshot, resolveBuddyCommand } = await import('../src/modules/ai/ai.copilot');
  const topic = `copilot${randomUUID().replaceAll('-', '')}`;
  const insert = async (title: string, owner: number | null, published: boolean) => {
    const code = randomUUID();
    const [row] = await pool.execute<ResultSetHeader>(
      `INSERT INTO video_lessons
       (code, title, topic, cefr_level, provider, video_url, duration_seconds, xp_reward, sort_order, owner_user_id, published_at)
       VALUES (?, ?, ?, 'A1', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 60, 10, 0, ?, ?)`,
      [code, title, topic, owner, published ? new Date() : null],
    );
    return { id: row.insertId, code };
  };
  const draft = await insert('Shared draft', null, false);
  const personal = await insert('My personal video', ownerId, true);
  const shared = await insert('Published Co-pilot test', null, true);
  try {
    const snapshot = await buildBuddySnapshot(ownerId);
    const catalog = snapshot.study.videoCatalog;
    assert.ok(catalog.some(({ id }) => id === shared.id));
    assert.ok(!catalog.some(({ id }) => id === draft.id || id === personal.id));
    assert.equal(snapshot.study.videosTotal, catalog.length);
    assert.ok(snapshot.study.ownedVideoTitles.includes('My personal video'));

    modelAnswers({ reply: 'Mình mở video công khai phù hợp.', action: { kind: 'open_video', videoId: shared.id } });
    assert.equal((await askBuddy(`Tìm video về ${topic}`)).action?.videoId, shared.id);
    assert.ok(providerRequestBody, 'a topic shared by multiple visible videos keeps the coach path');

    providerRequestBody = null;
    assert.equal((await askBuddy('Tìm video Published Co-pilot test')).action?.videoId, shared.id);
    assert.equal((await askBuddy(`Mở video mã ${personal.code}`)).action?.videoId, personal.id);
    assert.equal(providerRequestBody, null, 'an exact visible title, topic or code does not call the model');

    modelAnswers({ reply: 'Đây là video riêng của bạn.', action: { kind: 'open_video', videoId: personal.id } });
    const ownVideo = await askBuddy(`Mở video mã ${personal.code} và giải thích chủ đề`);
    assert.equal(ownVideo.action?.videoId, personal.id);
    const ownerPrompt = systemPrompt();
    const ownerPrefix = ownerPrompt.match(/^[\s\S]*\nAPP_CATALOG_JSON: [^\n]+/u)?.[0];
    assert.ok(ownerPrefix, 'the prompt begins with reusable instructions and the public catalogue');
    assert.ok(!ownerPrefix.includes(personal.code), 'the shared prefix excludes private videos');
    assert.ok(ownerPrompt.slice(ownerPrefix.length).includes(personal.code), 'the private video is in the owner\'s learner data');
    const readPublicVideo = (prompt: string) => {
      const line = /^APP_CATALOG_JSON: (.+)$/mu.exec(prompt)?.[1];
      assert.ok(line);
      const catalog = JSON.parse(line) as { video_catalog: Array<{ code: string; completed?: boolean }> };
      return catalog.video_catalog.find((video) => video.code === shared.code);
    };
    const publicVideo = readPublicVideo(ownerPrompt);
    assert.ok(publicVideo);
    assert.equal(publicVideo.completed, undefined, 'public catalog excludes learner progress');

    modelAnswers({ reply: 'Đây là video riêng của bạn.', action: { kind: 'open_video', videoId: personal.id } });
    const denied = await askBuddy(`Mở video mã ${personal.code}`, otherToken);
    assert.equal(denied.action, null, 'a model pick of another learner\'s private video is dropped');
    assert.deepEqual(readPublicVideo(systemPrompt()), publicVideo, 'public catalog rows are reusable across learners');
    assert.ok(!systemPrompt().includes(personal.code), 'another learner\'s prompt never carries the private code');
    assert.doesNotMatch(systemPrompt(), /My personal video/);

    providerRequestBody = null;
    assert.equal((await askBuddy('Open a random private video')).action?.videoId, personal.id);
    assert.equal((await askBuddy('Open a random private video', otherToken)).action, null);
    const publicPick = await askBuddy('Open a random video');
    assert.ok(catalog.some(({ id }) => id === publicPick.action?.videoId));
    assert.equal(providerRequestBody, null, 'random video requests read the visible library locally');

    modelAnswers({ reply: 'Mình mở video nháp.', action: { kind: 'open_video', videoId: draft.id } });
    assert.equal((await askBuddy(`Mở video mã ${draft.code}`)).action, null, 'drafts are never opened');

    const random = { kind: 'video', params: { choice: 'random' }, language: 'en' } as const;
    const forced = { ...snapshot, study: { ...snapshot.study,
      videoCatalog: catalog.map((video) => ({ ...video, completed: video.id !== shared.id })),
    } };
    assert.equal(resolveBuddyCommand(random, forced).action?.videoId, shared.id);
    const unfinished = forced.study.videoCatalog.find(({ id }) => id === shared.id);
    assert.ok(unfinished);
    unfinished.completed = true;
    const fallbackPick = resolveBuddyCommand(random, forced).action?.videoId;
    assert.ok(catalog.some(({ id }) => id === fallbackPick));
  } finally {
    await pool.execute('DELETE FROM video_lessons WHERE id IN (?, ?, ?)', [draft.id, personal.id, shared.id]);
  }
});

test('Buddy finds a described shop item in the grounded catalogue and opens its card', async () => {
  providerRequestBody = null;
  const exact = await askBuddy('Find a streak shield in the shop.');
  assert.equal(exact.action?.itemCode, 'booster_streak_shield');
  assert.equal(exact.action?.highlight, 'shop:booster_streak_shield');
  assert.match(exact.reply, /60 RC/);
  assert.equal(providerRequestBody, null, 'an exact catalogue item does not call the model');

  modelAnswers({ reply: 'Xe đỏ trong Gara là Sport Red.', action: { kind: 'show_shop_item', itemCode: 'car_sport_red' } });
  const answer = await askBuddy('chiếc xe màu đỏ');
  assert.equal(answer.route, 'navigate');
  assert.equal(answer.action?.kind, 'show_shop_item');
  assert.equal(answer.action?.itemCode, 'car_sport_red');
  assert.equal(answer.action?.highlight, 'shop:car_sport_red');
  assert.match(systemPrompt(), /"shop_catalog":.*"car_sport_red"/);

  modelAnswers({ reply: 'Bạn muốn màu nào?' });
  const unspecified = await askBuddy('Mua xe màu đó');
  assert.equal(unspecified.action, null);
  assert.match(unspecified.reply, /màu nào/);

  modelAnswers({ reply: 'Mình mở món này.', action: { kind: 'show_shop_item', itemCode: 'car_fake_item' } });
  assert.equal((await askBuddy('xe bay')).action, null, 'an item code outside shop_catalog is dropped');
});

test('Buddy grounds a generated shop action even when the question does not preload the shop', async () => {
  modelAnswers({
    reply: 'Bạn có thể xem khiên bảo vệ chuỗi hoặc mở Ôn tập.',
    action: { kind: 'buy_shop_item', itemCode: 'booster_streak_shield' },
    actions: [{ kind: 'open_review', tab: 'profile' }],
  });
  const answer = await askBuddy('Bạn có đề xuất nào không?');
  assert.match(systemPrompt(), /"shop_catalog":\[\]/);
  assert.equal(answer.action?.kind, 'show_shop_item');
  assert.equal(answer.action?.itemCode, 'booster_streak_shield');
  assert.equal(answer.actions?.[1]?.kind, 'open_review');
});

test('Buddy shows the shield and never spends coins, whatever the model picks', async () => {
  const { buildBuddySnapshot, resolveBuddyCommand } = await import('../src/modules/ai/ai.copilot');
  const { getShop } = await import('../src/modules/gamification/gamification.service');
  const snapshot = await buildBuddySnapshot(ownerId);
  const shield = snapshot.shop.items.find(({ code }) => code === 'booster_streak_shield');
  assert.ok(shield);
  const initialCoins = snapshot.shop.coins;
  try {
    for (const coins of [0, shield.price]) {
      await pool.execute('UPDATE users SET coins = ? WHERE id = ?', [coins, ownerId]);
      modelAnswers({ reply: 'Mình mua khiên cho bạn.', action: { kind: 'buy_shop_item', itemCode: shield.code } });
      const answer = await askBuddy(coins === 0 ? 'mua khiên' : 'Buy the shield');
      assert.equal(answer.action?.kind, 'show_shop_item');
      assert.equal(answer.action?.itemCode, shield.code);
      assert.equal(answer.action?.itemName, shield.name);
      assert.equal(answer.action?.highlight, `shop:${shield.code}`);
      const current = await getShop(ownerId);
      assert.equal(current.coins, coins);
      assert.deepEqual(current.boosters, snapshot.shop.boosters);
    }
    modelAnswers({ reply: 'Mình mua copilotfakeitem.', action: { kind: 'buy_shop_item', itemCode: 'copilotfakeitem' } });
    assert.equal((await askBuddy('Mua copilotfakeitem')).action, null);

    // The offline guide still covers affordability and locks when no model answers.
    const command = { kind: 'shopItem', language: 'vi', params: { item: shield.code.replaceAll('_', ' ') } } as const;
    const mockItem = { ...shield, unlocked: false, unlock_label: 'Cần cấp 20' };
    const mock = { ...snapshot, shop: { ...snapshot.shop, items: [mockItem] } };
    assert.match(resolveBuddyCommand(command, mock).reply, /Cần cấp 20/);
    mockItem.unlocked = true;
    mockItem.owned = true;
    assert.match(resolveBuddyCommand(command, mock).reply, /đã sở hữu/);
  } finally {
    await pool.execute('UPDATE users SET coins = ? WHERE id = ?', [initialCoins, ownerId]);
  }
});
