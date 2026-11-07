import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

let server: Server;
let baseUrl: string;
let testPool: typeof import('../src/db/pool').pool;
let token: string;
let userId: number;
let email: string;

before(async () => {
  const [{ app }, db] = await Promise.all([
    import('../src/app'),
    import('../src/db/pool'),
  ]);
  testPool = db.pool;
  server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server failed to bind.');
  baseUrl = `http://127.0.0.1:${address.port}`;

  email = `buddy-${randomUUID()}@example.test`;
  const registered = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Buddy Test', email, password: 'correct-horse-7' }),
  });
  assert.equal(registered.status, 201);
  const body = await registered.json() as Envelope<{ user: { id: number } }>;
  userId = body.data!.user.id;

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct-horse-7' }),
  });
  const loginBody = await login.json() as Envelope<{ token: string }>;
  token = loginBody.data!.token;
});

after(async () => {
  if (email) await testPool.execute('DELETE FROM users WHERE email = ?', [email]);
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await testPool.end();
});

function auth(): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

test('the companion feed is built from the learner rows, never from the model', async () => {
  const response = await fetch(`${baseUrl}/api/buddy/nudges`, { headers: auth() });
  assert.equal(response.status, 200);
  const body = await response.json() as Envelope<{
    nudges: Array<{ id: string; kind: string; title: string; body: string }>;
    summary: { total_lessons: number; due_reminders: number };
    greeting: string;
  }>;

  const data = body.data!;
  assert.ok(data.greeting.length > 0);
  assert.equal(data.summary.total_lessons, 36);
  assert.equal(data.summary.due_reminders, 0);
  assert.ok(data.nudges.length > 0, 'a fresh account still gets a next-lesson nudge');

  for (const nudge of data.nudges) {
    assert.ok(nudge.title.length > 0);
    assert.doesNotMatch(
      `${nudge.title} ${nudge.body}`,
      /cố lên nhé|bạn làm tốt lắm|kiên trì sẽ thành công/i,
      'no empty encouragement',
    );
  }
});

test('a reminder can be scheduled, listed, acknowledged and dismissed', async () => {
  const created = await fetch(`${baseUrl}/api/reminders`, {
    method: 'POST',
    headers: auth(),
    body: JSON.stringify({
      title: 'Ôn Sổ từ',
      in_minutes: 25,
      target: { tab: 'videos', highlight: 'control:notebook' },
    }),
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json() as Envelope<{
    reminder: { id: number; title: string; due_at: string; is_due: boolean; target: { highlight?: string } };
  }>;
  const reminder = createdBody.data!.reminder;
  assert.equal(reminder.title, 'Ôn Sổ từ');
  assert.equal(reminder.is_due, false);
  assert.equal(reminder.target.highlight, 'control:notebook');

  const listed = await fetch(`${baseUrl}/api/reminders`, { headers: auth() });
  const listBody = await listed.json() as Envelope<{ reminders: Array<{ id: number }> }>;
  assert.ok(listBody.data!.reminders.some((entry) => entry.id === reminder.id));

  // Force it due, then the feed must surface it first and count it.
  await testPool.execute(
    'UPDATE study_reminders SET due_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = ?',
    [reminder.id],
  );
  const feed = await fetch(`${baseUrl}/api/buddy/nudges`, { headers: auth() });
  const feedBody = await feed.json() as Envelope<{
    nudges: Array<{ kind: string; id: string }>;
    summary: { due_reminders: number };
  }>;
  assert.equal(feedBody.data!.summary.due_reminders, 1);
  assert.equal(feedBody.data!.nudges[0].kind, 'reminder');
  assert.equal(feedBody.data!.nudges[0].id, `reminder:${reminder.id}`);

  const ack = await fetch(`${baseUrl}/api/reminders/${reminder.id}/acknowledge`, {
    method: 'POST',
    headers: auth(),
  });
  assert.equal(ack.status, 200);

  // Acknowledged reminders stop counting as due.
  const afterAck = await fetch(`${baseUrl}/api/buddy/nudges`, { headers: auth() });
  const afterAckBody = await afterAck.json() as Envelope<{ summary: { due_reminders: number } }>;
  assert.equal(afterAckBody.data!.summary.due_reminders, 0);

  const dismissed = await fetch(`${baseUrl}/api/reminders/${reminder.id}`, {
    method: 'DELETE',
    headers: auth(),
  });
  assert.equal(dismissed.status, 200);

  const afterDelete = await fetch(`${baseUrl}/api/reminders`, { headers: auth() });
  const afterDeleteBody = await afterDelete.json() as Envelope<{ reminders: Array<{ id: number }> }>;
  assert.equal(afterDeleteBody.data!.reminders.some((entry) => entry.id === reminder.id), false);
});

test('an accepted suggestion becomes a real reminder and cannot target another user', async () => {
  const accepted = await fetch(`${baseUrl}/api/buddy/reminder-suggestion`, {
    method: 'POST',
    headers: auth(),
    body: JSON.stringify({
      suggestion: { title: 'Học bài tiếp theo', in_minutes: 15, at_time: null, body: 'Literally 15 minutes.' },
      target: { tab: 'study', lessonId: 1, highlight: 'lesson:1' },
    }),
  });
  assert.equal(accepted.status, 201);
  const body = await accepted.json() as Envelope<{ reminder: { id: number; due_at: string } }>;
  const dueIn = new Date(body.data!.reminder.due_at).getTime() - Date.now();
  assert.ok(dueIn > 13 * 60_000 && dueIn < 17 * 60_000, 'due time comes from the server clock');

  // Another learner must not be able to delete it.
  const other = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Other', email: `other-${randomUUID()}@example.test`, password: 'correct-horse-7' }),
  });
  assert.equal(other.status, 201);
  const otherLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: (await other.json() as Envelope<{ user: { email: string } }>).data!.user.email,
      password: 'correct-horse-7',
    }),
  });
  const otherToken = (await otherLogin.json() as Envelope<{ token: string }>).data!.token;
  const forbidden = await fetch(`${baseUrl}/api/reminders/${body.data!.reminder.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${otherToken}` },
  });
  assert.equal(forbidden.status, 404);

  await testPool.execute('DELETE FROM users WHERE email LIKE ?', ['other-%@example.test']);
  await testPool.execute('DELETE FROM study_reminders WHERE id = ?', [body.data!.reminder.id]);
});

test('buddy routes require a signed-in learner', async () => {
  const feed = await fetch(`${baseUrl}/api/buddy/nudges`);
  assert.equal(feed.status, 401);
  const ask = await fetch(`${baseUrl}/api/buddy/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'hello' }),
  });
  assert.equal(ask.status, 401);
});

void userId;
