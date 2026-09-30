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

let server: Server;
let baseUrl: string;
let email: string;
let token: string;
let testPool: typeof import('../src/db/pool').pool;

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
  email = `learning-test-${randomUUID()}@example.test`;

  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Learning Test', email, password: 'correct-horse-7' }),
  });
  assert.equal(response.status, 201);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct-horse-7' }),
  });
  assert.equal(login.status, 200);
  const body = await login.json() as { data: { token: string } };
  token = body.data.token;
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

test('lesson completion requires every answer to be correct before unlocking the next lesson', async () => {
  interface AnswerRow extends RowDataPacket {
    question_id: number;
    answer_id: number;
    is_correct: boolean | 0 | 1;
  }

  const [lessonRows] = await testPool.execute<RowDataPacket[]>(
    `SELECT l.id, l.stage_id
     FROM lessons l JOIN stages s ON s.id = l.stage_id
     ORDER BY s.sort_order, l.sort_order LIMIT 1`,
  );
  assert.ok(lessonRows[0], 'Seed at least one lesson before running learning tests.');
  const lessonId = Number(lessonRows[0].id);
  const stageId = Number(lessonRows[0].stage_id);
  const [stageLessonRows] = await testPool.execute<RowDataPacket[]>(
    'SELECT id FROM lessons WHERE stage_id = ? ORDER BY sort_order',
    [stageId],
  );
  const stageLessonIds = stageLessonRows.map((row) => Number(row.id));

  const [answerRows] = await testPool.execute<AnswerRow[]>(
    `SELECT q.id AS question_id, a.id AS answer_id, a.is_correct
     FROM questions q JOIN answers a ON a.question_id = q.id
     WHERE q.lesson_id = ? ORDER BY q.sort_order, a.sort_order`,
    [lessonId],
  );
  const questionIds = [...new Set(answerRows.map((row) => row.question_id))];
  assert.ok(questionIds.length > 0, 'The first lesson must have questions.');

  const correctSubmission = questionIds.map((questionId) => {
    const correct = answerRows.find((row) => row.question_id === questionId && (row.is_correct === true || row.is_correct === 1));
    assert.ok(correct, `Question ${questionId} must have a correct answer.`);
    return { questionId, answer: String(correct.answer_id) };
  });
  const incorrectSubmission = correctSubmission.map((answer, index) => {
    if (index > 0) return answer;
    const questionId = answer.questionId;
    const incorrect = answerRows.find((row) => row.question_id === questionId && (row.is_correct === false || row.is_correct === 0));
    assert.ok(incorrect, `Question ${questionId} must have an incorrect answer.`);
    return { questionId, answer: String(incorrect.answer_id) };
  });

  const submit = (targetLessonId: number, answers: typeof correctSubmission) => fetch(`${baseUrl}/api/lessons/${targetLessonId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ answers }),
  });

  const failedAttempt = await submit(lessonId, incorrectSubmission);
  assert.equal(failedAttempt.status, 200);
  const failedResult = await failedAttempt.json() as { data: { lesson_status: string; xp_earned: number; score: number } };
  assert.equal(failedResult.data.lesson_status, 'retry');
  assert.equal(failedResult.data.xp_earned, 0);
  assert.ok(failedResult.data.score < 100);

  const progressAfterFailure = await fetch(`${baseUrl}/api/progress`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const failedProgress = await progressAfterFailure.json() as { data: { completed_lesson_ids: number[]; total_xp: number } };
  assert.equal(failedProgress.data.completed_lesson_ids.includes(lessonId), false);
  assert.equal(failedProgress.data.total_xp, 0);

  const successfulAttempt = await submit(lessonId, correctSubmission);
  assert.equal(successfulAttempt.status, 200);
  const successfulResult = await successfulAttempt.json() as { data: { lesson_status: string; stage_completed: boolean; xp_earned: number; score: number } };
  assert.equal(successfulResult.data.lesson_status, 'completed');
  assert.equal(successfulResult.data.score, 100);
  assert.equal(successfulResult.data.xp_earned, 20);
  assert.equal(successfulResult.data.stage_completed, stageLessonIds.length === 1);

  const [nextLessonRows] = await testPool.execute<RowDataPacket[]>(
    `SELECT l.id
     FROM lessons l JOIN stages s ON s.id = l.stage_id
     ORDER BY s.sort_order, l.sort_order LIMIT 1 OFFSET 1`,
  );
  if (nextLessonRows[0]) {
    const nextLessonId = Number(nextLessonRows[0].id);
    const nextLessonResponse = await fetch(`${baseUrl}/api/lessons/${nextLessonId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const nextLesson = await nextLessonResponse.json() as { data: { lesson: { state: { status: string } } } };
    assert.equal(nextLesson.data.lesson.state.status, 'unlocked');
  }

  for (const [index, stageLessonId] of stageLessonIds.slice(1).entries()) {
    const [stageAnswerRows] = await testPool.execute<AnswerRow[]>(
      `SELECT q.id AS question_id, a.id AS answer_id, a.is_correct
       FROM questions q JOIN answers a ON a.question_id = q.id
       WHERE q.lesson_id = ? ORDER BY q.sort_order, a.sort_order`,
      [stageLessonId],
    );
    const stageQuestionIds = [...new Set(stageAnswerRows.map((row) => row.question_id))];
    const stageSubmission = stageQuestionIds.map((questionId) => {
      const correct = stageAnswerRows.find((row) => row.question_id === questionId && (row.is_correct === true || row.is_correct === 1));
      assert.ok(correct, `Question ${questionId} must have a correct answer.`);
      return { questionId, answer: String(correct.answer_id) };
    });

    const stageAttempt = await submit(stageLessonId, stageSubmission);
    assert.equal(stageAttempt.status, 200);
    const stageResult = await stageAttempt.json() as { data: { lesson_status: string; stage_completed: boolean } };
    assert.equal(stageResult.data.lesson_status, 'completed');
    assert.equal(stageResult.data.stage_completed, index === stageLessonIds.length - 2);
  }

  const [nextStageRows] = await testPool.execute<RowDataPacket[]>(
    `SELECT l.id
     FROM lessons l JOIN stages s ON s.id = l.stage_id
     ORDER BY s.sort_order, l.sort_order LIMIT 1 OFFSET ?`,
    [stageLessonIds.length],
  );
  if (nextStageRows[0]) {
    const nextStageResponse = await fetch(`${baseUrl}/api/lessons/${Number(nextStageRows[0].id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const nextStageLesson = await nextStageResponse.json() as { data: { lesson: { state: { status: string } } } };
    assert.equal(nextStageLesson.data.lesson.state.status, 'unlocked');
  }

  const replayAttempt = await submit(lessonId, correctSubmission);
  assert.equal(replayAttempt.status, 200);
  const replayResult = await replayAttempt.json() as { data: { lesson_status: string; stage_completed: boolean; xp_earned: number } };
  assert.equal(replayResult.data.lesson_status, 'completed');
  assert.equal(replayResult.data.stage_completed, false);
  assert.equal(replayResult.data.xp_earned, 0);
});