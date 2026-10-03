import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import type { RowDataPacket } from 'mysql2';

interface TestUser {
  id: number;
  email: string;
  token: string;
}

let server: Server;
let baseUrl: string;
let testPool: typeof import('../src/db/pool').pool;
const testUsers: TestUser[] = [];

async function createTestUser(name: string): Promise<TestUser> {
  const email = `ranking-${randomUUID()}@example.test`;
  const password = 'correct-horse-7';
  const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  assert.equal(registerResponse.status, 201);
  const registerData = await registerResponse.json() as { data: { user: { id: number } } };

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(loginResponse.status, 200);
  const loginData = await loginResponse.json() as { data: { token: string } };
  return { id: registerData.data.user.id, email, token: loginData.data.token };
}

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

  testUsers.push(await createTestUser('Ranking First'));
  testUsers.push(await createTestUser('Ranking Second'));
  testUsers.push(await createTestUser('Ranking Third'));
  testUsers.push(await createTestUser('Badge Learner'));
});

after(async () => {
  if (testUsers.length) {
    const placeholders = testUsers.map(() => '?').join(', ');
    await testPool.execute(`DELETE FROM users WHERE id IN (${placeholders})`, testUsers.map((user) => user.id));
  }
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await testPool.end();
});

test('ranking orders by XP and reports the current user rank', async () => {
  const xpValues = [4_000_000_000, 3_900_000_000, 3_800_000_000];
  for (const [index, user] of testUsers.slice(0, 3).entries()) {
    await testPool.execute('UPDATE users SET xp = ? WHERE id = ?', [xpValues[index], user.id]);
  }

  const currentUser = testUsers[1];
  const response = await fetch(`${baseUrl}/api/ranking`, {
    headers: { Authorization: `Bearer ${currentUser.token}` },
  });
  assert.equal(response.status, 200);
  const body = await response.json() as {
    data: {
      leaderboard: Array<{ rank: number; userId: number; name: string; avatar: string | null; xp: number }>;
      current_user_rank: number | null;
    };
  };
  const { leaderboard } = body.data;
  const ids = new Set(testUsers.slice(0, 3).map((user) => user.id));
  const rankedTestUsers = leaderboard.filter((entry) => ids.has(entry.userId));

  assert.deepEqual(rankedTestUsers.map((entry) => entry.userId), testUsers.slice(0, 3).map((user) => user.id));
  assert.ok(leaderboard.every((entry, index) => index === 0 || leaderboard[index - 1].xp >= entry.xp));
  const currentEntry = leaderboard.find((entry) => entry.userId === currentUser.id);
  assert.ok(currentEntry);
  assert.equal(body.data.current_user_rank, currentEntry.rank);
  assert.equal(currentEntry.name, 'Ranking Second');
  assert.equal(currentEntry.avatar, null);
  assert.equal(typeof currentEntry.xp, 'number');

  const unauthorized = await fetch(`${baseUrl}/api/ranking`);
  assert.equal(unauthorized.status, 401);
});

test('lesson completion awards eligible badges once and persists them', async () => {
  interface LessonRow extends RowDataPacket {
    id: number;
  }
  interface AnswerRow extends RowDataPacket {
    question_id: number;
    answer_id: number;
    is_correct: boolean | 0 | 1;
  }

  const badgeUser = testUsers[3];
  const [badgeRows] = await testPool.execute<RowDataPacket[]>(
    `SELECT code FROM badges WHERE code IN ('first_lesson', 'lessons_10', 'xp_100', 'xp_500')`,
  );
  assert.equal(badgeRows.length, 4, 'Run database/seed.sql before the badge integration tests.');

  const [lessonRows] = await testPool.execute<LessonRow[]>(
    `SELECT l.id FROM lessons l JOIN stages s ON s.id = l.stage_id
     ORDER BY s.sort_order, l.sort_order LIMIT 10`,
  );
  assert.equal(lessonRows.length, 10, 'Seed at least ten lessons before running badge tests.');

  const now = new Date();
  for (const lesson of lessonRows.slice(0, 9)) {
    await testPool.execute(
      `INSERT INTO progress (user_id, lesson_id, status, score, started_at, completed_at, updated_at)
       VALUES (?, ?, 'completed', 100, ?, ?, ?)`,
      [badgeUser.id, lesson.id, now, now, now],
    );
  }
  await testPool.execute('UPDATE users SET xp = 480 WHERE id = ?', [badgeUser.id]);

  const targetLessonId = lessonRows[9].id;
  const [answerRows] = await testPool.execute<AnswerRow[]>(
    `SELECT q.id AS question_id, a.id AS answer_id, a.is_correct
     FROM questions q JOIN answers a ON a.question_id = q.id
     WHERE q.lesson_id = ? ORDER BY q.sort_order, a.sort_order`,
    [targetLessonId],
  );
  const questionIds = Array.from(new Set(answerRows.map((row) => row.question_id)));
  assert.ok(questionIds.length > 0, 'Seed questions for the tenth lesson.');
  const answers = questionIds.map((questionId) => {
    const correct = answerRows.find((row) => row.question_id === questionId && (row.is_correct === true || row.is_correct === 1));
    assert.ok(correct, `Question ${questionId} needs a correct answer.`);
    return { questionId, answer: String(correct.answer_id) };
  });

  const completionUrl = `${baseUrl}/api/lessons/${targetLessonId}/complete`;
  const submit = () => fetch(completionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${badgeUser.token}` },
    body: JSON.stringify({ answers, xp: 999999, score: 0, completion: false }),
  });

  const completedResponse = await submit();
  assert.equal(completedResponse.status, 200);
  const completed = await completedResponse.json() as {
    data: { score: number; xp_earned: number; badges_awarded: Array<{ code: string }> };
  };
  assert.equal(completed.data.score, 100);
  assert.equal(completed.data.xp_earned, 20);
  assert.deepEqual(
    new Set(completed.data.badges_awarded.map((badge) => badge.code)),
    new Set(['first_lesson', 'lessons_10', 'xp_100', 'xp_500']),
  );

  const earnedResponse = await fetch(`${baseUrl}/api/badges/me`, {
    headers: { Authorization: `Bearer ${badgeUser.token}` },
  });
  assert.equal(earnedResponse.status, 200);
  const earned = await earnedResponse.json() as { data: { badges: Array<{ code: string }> } };
  assert.equal(earned.data.badges.length, 4);

  const replayResponse = await submit();
  assert.equal(replayResponse.status, 200);
  const replay = await replayResponse.json() as { data: { xp_earned: number; badges_awarded: unknown[] } };
  assert.equal(replay.data.xp_earned, 0);
  assert.deepEqual(replay.data.badges_awarded, []);

  const [userRows] = await testPool.execute<RowDataPacket[]>(
    'SELECT xp FROM users WHERE id = ?',
    [badgeUser.id],
  );
  const [persistedBadgeRows] = await testPool.execute<RowDataPacket[]>(
    'SELECT badge_id FROM user_badges WHERE user_id = ?',
    [badgeUser.id],
  );
  assert.equal(Number(userRows[0].xp), 500);
  assert.equal(persistedBadgeRows.length, 4);

  const rankingResponse = await fetch(`${baseUrl}/api/ranking`, {
    headers: { Authorization: `Bearer ${badgeUser.token}` },
  });
  assert.equal(rankingResponse.status, 200);
  const ranking = await rankingResponse.json() as {
    data: { leaderboard: Array<{ userId: number; xp: number }> };
  };
  const rankedBadgeUser = ranking.data.leaderboard.find((entry) => entry.userId === badgeUser.id);
  assert.equal(rankedBadgeUser?.xp, 500);
});