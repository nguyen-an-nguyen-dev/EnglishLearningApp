import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import type { RowDataPacket } from 'mysql2';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}
process.env.AI_API_KEY = 'test-only-provider-key';

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
    if (url === (process.env.AI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions')) {
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
     JOIN questions q ON q.lesson_id = l.id LIMIT 1`,
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
