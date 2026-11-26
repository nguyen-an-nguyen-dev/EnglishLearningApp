import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { env } from '../src/config/env';

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
let providerRequestBody: { messages?: Array<{ role: string; content: string }> } | null = null;
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
      if (forceProviderFailure) return jsonResponse({ error: { message: 'provider down' } }, 503);
      const current = providerResponse;
      providerResponse = null;
      providerRequestBody = typeof init?.body === 'string'
        ? JSON.parse(init.body) as { messages?: Array<{ role: string; content: string }> }
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

test('Buddy sends each turn to one model call and only validates the action it picks', async () => {
  providerRequestBody = null;
  modelAnswers({ reply: 'Mình mở Hồ sơ cho bạn.', action: { kind: 'open_tab', tab: 'profile' } });
  const profile = await askBuddy('Chuyển tab sang Hồ sơ');
  assert.equal(profile.action?.tab, 'profile');
  assert.equal(profile.route, 'navigate');
  assert.equal(profile.reply, 'Mình mở Hồ sơ cho bạn.');
  assert.ok(providerRequestBody, 'every turn reaches the model');
  assert.match(systemPrompt(), /"lesson_catalog":/);
  assert.match(systemPrompt(), /"owned_video_catalog":/);

  modelAnswers({ reply: 'Nút Tìm trận nằm ở Thi Đua.', action: { kind: 'spotlight', tab: 'compete', highlight: 'control:arena-start' } });
  const match = await askBuddy('Tìm trận đấu giúp mình');
  assert.equal(match.action?.tab, 'compete');
  assert.equal(match.action?.highlight, 'control:arena-start');

  modelAnswers({ reply: 'Mở bài 999.', action: { kind: 'open_lesson', lessonId: 999999999 } });
  const invented = await askBuddy('Mở bài 999');
  assert.equal(invented.action, null, 'an id outside the learner data never becomes a navigation');
  assert.equal(invented.route, 'open_prompt');

  modelAnswers({ reply: 'Mình mua khiên cho bạn.', action: { kind: 'buy_shop_item', itemCode: 'booster_streak_shield' } });
  const buy = await askBuddy('mua khiên');
  assert.equal(buy.action?.kind, 'show_shop_item', 'the buddy opens the item card and never buys it');
});

test('Buddy answers a balance question from the grounded wallet and keeps the spotlight', async () => {
  const { getWallet } = await import('../src/modules/gamification/gamification.service');
  const wallet = await getWallet(ownerId);
  providerRequestBody = null;
  modelAnswers({ reply: `You have ${wallet.coins} RC.`, action: { kind: 'spotlight', tab: 'shop', highlight: 'wallet:summary' } });
  const data = await askBuddy('How many RC do I have?');
  assert.equal(data.reply, `You have ${wallet.coins} RC.`);
  assert.equal(data.language, 'en');
  assert.equal(data.action?.highlight, 'wallet:summary');
  assert.equal(data.route, 'navigate');
  assert.match(systemPrompt(), new RegExp(`"coins":${wallet.coins}\\b`));
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

    modelAnswers({ reply: 'Mình mở video đó.', action: { kind: 'open_video', videoId: shared.id } });
    assert.equal((await askBuddy(`Tìm video về ${topic}`)).action?.videoId, shared.id);

    modelAnswers({ reply: 'Đây là video riêng của bạn.', action: { kind: 'open_video', videoId: personal.id } });
    const ownVideo = await askBuddy(`Mở video mã ${personal.code}`);
    assert.equal(ownVideo.action?.videoId, personal.id);
    assert.ok(systemPrompt().includes(personal.code), 'the owner\'s prompt carries the owner\'s own private video');

    modelAnswers({ reply: 'Đây là video riêng của bạn.', action: { kind: 'open_video', videoId: personal.id } });
    const denied = await askBuddy(`Mở video mã ${personal.code}`, otherToken);
    assert.equal(denied.action, null, 'a model pick of another learner\'s private video is dropped');
    assert.ok(!systemPrompt().includes(personal.code), 'another learner\'s prompt never carries the private code');
    assert.doesNotMatch(systemPrompt(), /My personal video/);

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
