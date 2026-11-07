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

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

let server: Server;
let baseUrl: string;
let testPool: typeof import('../src/db/pool').pool;
let adminToken: string;
let learnerToken: string;
let adminId: number;
let learnerId: number;
const createdEmails: string[] = [];
const createdStageIds: number[] = [];
const createdLessonIds: number[] = [];
const createdQuestionIds: number[] = [];
const createdVideoIds: number[] = [];
const createdMatchIds: number[] = [];

async function registerUser(name: string): Promise<{ id: number; token: string; email: string }> {
  const email = `admin-${randomUUID()}@example.test`;
  createdEmails.push(email);
  const registered = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: 'correct-horse-7' }),
  });
  assert.equal(registered.status, 201);
  const body = await registered.json() as Envelope<{ user: { id: number } }>;
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct-horse-7' }),
  });
  assert.equal(login.status, 200);
  const loginBody = await login.json() as Envelope<{ token: string }>;
  return { id: body.data!.user.id, token: loginBody.data!.token, email };
}

async function call<T>(
  path: string,
  token: string,
  options: { method?: string; body?: unknown } = {},
): Promise<{ status: number; body: Envelope<T> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: response.status, body: await response.json() as Envelope<T> };
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

  const admin = await registerUser('Content Admin');
  const learner = await registerUser('Plain Learner');
  adminId = admin.id;
  learnerId = learner.id;
  adminToken = admin.token;
  learnerToken = learner.token;

  await testPool.execute("UPDATE users SET role = 'admin' WHERE id = ?", [adminId]);
});

after(async () => {
  // Children first so no foreign key blocks the cleanup.
  for (const matchId of createdMatchIds) {
    await testPool.execute('DELETE FROM matches WHERE id = ?', [matchId]);
  }
  for (const videoId of createdVideoIds) {
    await testPool.execute('DELETE FROM video_lessons WHERE id = ?', [videoId]);
  }
  for (const lessonId of createdLessonIds) {
    await testPool.execute('DELETE FROM progress WHERE lesson_id = ?', [lessonId]);
    await testPool.execute('DELETE FROM questions WHERE lesson_id = ?', [lessonId]);
    await testPool.execute('DELETE FROM lessons WHERE id = ?', [lessonId]);
  }
  for (const stageId of createdStageIds) {
    await testPool.execute('DELETE FROM lessons WHERE stage_id = ?', [stageId]);
    await testPool.execute('DELETE FROM stages WHERE id = ?', [stageId]);
  }
  for (const email of createdEmails) {
    await testPool.execute('DELETE FROM users WHERE email = ?', [email]);
  }
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await testPool.end();
});

// ─── Access control ──────────────────────────────────────────────────────────

test('learners cannot read or change admin content', async () => {
  const read = await call('/api/admin/content', learnerToken);
  assert.equal(read.status, 403);
  assert.ok(read.body.errors?.includes('ADMIN_REQUIRED'));

  const create = await call('/api/admin/stages', learnerToken, {
    method: 'POST',
    body: { title: 'Blocked stage' },
  });
  assert.equal(create.status, 403);

  const sharedVideos = await call('/api/admin/videos', learnerToken);
  assert.equal(sharedVideos.status, 403);

  const anonymous = await fetch(`${baseUrl}/api/admin/content`);
  assert.equal(anonymous.status, 401);
});

test('the admin role is read from the database, not from the token', async () => {
  const content = await call<{ stages: unknown[] }>('/api/admin/content', adminToken);
  assert.equal(content.status, 200);
  assert.ok(Array.isArray(content.body.data?.stages));
  assert.ok(content.body.data!.stages.length > 0);
});

// ─── Stage → lesson → question ───────────────────────────────────────────────

test('admin builds a stage, a lesson and questions that the learner sees on the roadmap', async () => {
  const stageResponse = await call<{ stage: { id: number; code: string; theme_key: string; lessons: unknown[] } }>(
    '/api/admin/stages',
    adminToken,
    {
      method: 'POST',
      body: { title: 'Chặng Kiểm Thử Admin', description: 'Nội dung do admin tạo.', theme_key: 'coast' },
    },
  );
  assert.equal(stageResponse.status, 201);
  const stage = stageResponse.body.data!.stage;
  createdStageIds.push(stage.id);
  assert.equal(stage.theme_key, 'coast');
  assert.ok(stage.code.length > 0);

  const lessonResponse = await call<{ lesson: { id: number; stage_id: number; title: string; question_count: number } }>(
    '/api/admin/lessons',
    adminToken,
    { method: 'POST', body: { stage_id: stage.id, title: 'Bài Từ Vựng Admin', topic: 'Vocabulary' } },
  );
  assert.equal(lessonResponse.status, 201);
  const lesson = lessonResponse.body.data!.lesson;
  createdLessonIds.push(lesson.id);
  assert.equal(lesson.stage_id, stage.id);
  assert.equal(lesson.question_count, 0);

  const choiceResponse = await call<{ question: { id: number; question_type: string; answers: Array<{ is_correct: boolean }> } }>(
    `/api/admin/lessons/${lesson.id}/questions`,
    adminToken,
    {
      method: 'POST',
      body: {
        question_text: 'Từ "month" nghĩa là gì?',
        question_type: 'multiple_choice',
        difficulty: 'beginner',
        explanation: 'month = tháng',
        answers: [
          { answer_text: 'tháng', is_correct: true },
          { answer_text: 'tuần', is_correct: false },
          { answer_text: 'năm', is_correct: false },
        ],
      },
    },
  );
  assert.equal(choiceResponse.status, 201);
  const choice = choiceResponse.body.data!.question;
  createdQuestionIds.push(choice.id);
  assert.equal(choice.answers.filter((answer) => answer.is_correct).length, 1);

  const wordOrderResponse = await call<{ question: { id: number; word_bank: string[] } }>(
    `/api/admin/lessons/${lesson.id}/questions`,
    adminToken,
    {
      method: 'POST',
      body: {
        question_text: 'Sắp xếp thành câu đúng.',
        question_type: 'word_order',
        answers: [{ answer_text: 'I go to school every day', is_correct: true }],
      },
    },
  );
  assert.equal(wordOrderResponse.status, 201);
  const wordOrder = wordOrderResponse.body.data!.question;
  createdQuestionIds.push(wordOrder.id);
  assert.deepEqual(wordOrder.word_bank, ['I', 'go', 'to', 'school', 'every', 'day']);

  const detail = await call<{ questions: Array<{ id: number; answers: Array<{ is_correct: boolean; answer_text: string }> }> }>(
    `/api/admin/lessons/${lesson.id}/questions`,
    adminToken,
  );
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data!.questions.length, 2);
  const reloaded = detail.body.data!.questions.find((entry) => entry.id === choice.id);
  assert.ok(reloaded);
  assert.ok(reloaded.answers.some((answer) => answer.is_correct && answer.answer_text === 'tháng'));

  // The learner's roadmap carries the new stage, and the appended lesson stays locked.
  const progress = await call<{ stages: Array<{ id: number; lessons: Array<{ id: number; state: { status: string }; total_questions: number }> }> }>(
    '/api/progress',
    learnerToken,
  );
  assert.equal(progress.status, 200);
  const progressStage = progress.body.data!.stages.find((entry) => entry.id === stage.id);
  assert.ok(progressStage, 'the new stage must show up in the learner roadmap');
  const progressLesson = progressStage.lessons.find((entry) => entry.id === lesson.id);
  assert.ok(progressLesson);
  assert.equal(progressLesson.state.status, 'locked');
  assert.equal(progressLesson.total_questions, 2);

  const lockedQuestions = await call(`/api/lessons/${lesson.id}/questions`, learnerToken);
  assert.equal(lockedQuestions.status, 403);
});

test('admin validation rejects bad question shapes', async () => {
  const lessonId = createdLessonIds[0];
  const twoCorrect = await call(`/api/admin/lessons/${lessonId}/questions`, adminToken, {
    method: 'POST',
    body: {
      question_text: 'Câu sai cấu hình',
      question_type: 'multiple_choice',
      answers: [
        { answer_text: 'a', is_correct: true },
        { answer_text: 'b', is_correct: true },
      ],
    },
  });
  assert.equal(twoCorrect.status, 422);

  const singleChoice = await call(`/api/admin/lessons/${lessonId}/questions`, adminToken, {
    method: 'POST',
    body: {
      question_text: 'Chỉ một lựa chọn',
      question_type: 'multiple_choice',
      answers: [{ answer_text: 'a', is_correct: true }],
    },
  });
  assert.equal(singleChoice.status, 422);

  const listeningWithoutAudio = await call(`/api/admin/lessons/${lessonId}/questions`, adminToken, {
    method: 'POST',
    body: {
      question_text: 'Nghe và gõ lại',
      question_type: 'listening',
      answers: [{ answer_text: 'Hello there', is_correct: true }],
    },
  });
  assert.equal(listeningWithoutAudio.status, 422);

  const badTheme = await call('/api/admin/stages', adminToken, {
    method: 'POST',
    body: { title: 'Theme lạ', theme_key: 'neon' },
  });
  assert.equal(badTheme.status, 422);

  const unknownType = await call(`/api/admin/lessons/${lessonId}/questions`, adminToken, {
    method: 'POST',
    body: {
      question_text: 'Dạng lạ',
      question_type: 'essay',
      answers: [{ answer_text: 'a', is_correct: true }],
    },
  });
  assert.equal(unknownType.status, 422);
});

test('admin can reorder lessons and questions without breaking unique sort keys', async () => {
  const stageId = createdStageIds[0];
  const secondLesson = await call<{ lesson: { id: number; sort_order: number } }>(
    '/api/admin/lessons',
    adminToken,
    { method: 'POST', body: { stage_id: stageId, title: 'Bài Thứ Hai Admin', topic: 'Grammar' } },
  );
  assert.equal(secondLesson.status, 201);
  const lessonId = secondLesson.body.data!.lesson.id;
  createdLessonIds.push(lessonId);
  assert.equal(secondLesson.body.data!.lesson.sort_order, 2);

  const moved = await call(`/api/admin/lessons/${lessonId}/move`, adminToken, {
    method: 'POST',
    body: { direction: 'up' },
  });
  assert.equal(moved.status, 200);

  const content = await call<{ stages: Array<{ id: number; lessons: Array<{ id: number; sort_order: number }> }> }>(
    '/api/admin/content',
    adminToken,
  );
  const stage = content.body.data!.stages.find((entry) => entry.id === stageId);
  assert.ok(stage);
  const orders = stage.lessons.map((entry) => entry.sort_order);
  assert.deepEqual(orders, [1, 2]);
  const first = stage.lessons.find((entry) => entry.sort_order === 1);
  assert.equal(first?.id, lessonId);

  const questionId = createdQuestionIds[0];
  const questionMove = await call(`/api/admin/questions/${questionId}/move`, adminToken, {
    method: 'POST',
    body: { direction: 'down' },
  });
  assert.equal(questionMove.status, 200);
});

// ─── Deletion safety ─────────────────────────────────────────────────────────

test('deleting a question detaches battle history instead of failing on foreign keys', async () => {
  const questionId = createdQuestionIds[1];
  const insertMatch = await testPool.execute(
    `INSERT INTO matches (player_one_id, player_two_id, status, started_at)
     VALUES (?, ?, 'completed', NOW())`,
    [learnerId, adminId],
  );
  const matchId = (insertMatch[0] as { insertId: number }).insertId;
  createdMatchIds.push(matchId);
  await testPool.execute(
    `INSERT INTO match_answers (match_id, user_id, question_id, round, is_correct)
     VALUES (?, ?, ?, 1, 0)`,
    [matchId, learnerId, questionId],
  );

  const removed = await call(`/api/admin/questions/${questionId}`, adminToken, { method: 'DELETE' });
  assert.equal(removed.status, 200);

  interface AnswerRow extends RowDataPacket { question_id: number | null }
  const [rows] = await testPool.execute<AnswerRow[]>(
    'SELECT question_id FROM match_answers WHERE match_id = ?',
    [matchId],
  );
  assert.equal(rows.length, 1, 'the battle answer row must survive');
  assert.equal(rows[0].question_id, null);

  const again = await call(`/api/admin/questions/${questionId}`, adminToken, { method: 'DELETE' });
  assert.equal(again.status, 404);
});

test('deleting a lesson clears learner progress, its questions, and blocks non-empty stages', async () => {
  const stageId = createdStageIds[0];
  const lessonId = createdLessonIds[1];
  await testPool.execute(
    `INSERT INTO progress (user_id, lesson_id, status, score, attempts)
     VALUES (?, ?, 'in_progress', NULL, 1)`,
    [learnerId, lessonId],
  );

  const blockedStage = await call(`/api/admin/stages/${stageId}`, adminToken, { method: 'DELETE' });
  assert.equal(blockedStage.status, 409);
  assert.ok(blockedStage.body.errors?.includes('STAGE_NOT_EMPTY'));

  const removed = await call(`/api/admin/lessons/${lessonId}`, adminToken, { method: 'DELETE' });
  assert.equal(removed.status, 200);

  interface CountRow extends RowDataPacket { total: number }
  const [progressRows] = await testPool.execute<CountRow[]>(
    'SELECT COUNT(*) AS total FROM progress WHERE lesson_id = ?',
    [lessonId],
  );
  assert.equal(Number(progressRows[0].total), 0);
  const [questionRows] = await testPool.execute<CountRow[]>(
    'SELECT COUNT(*) AS total FROM questions WHERE lesson_id = ?',
    [lessonId],
  );
  assert.equal(Number(questionRows[0].total), 0);
});

// ─── Shared video library ────────────────────────────────────────────────────

test('shared videos are editable by admins and visible to every learner', async () => {
  const code = `yt_adminqa${Date.now()}_shared`;
  const insert = await testPool.execute(
    `INSERT INTO video_lessons
       (code, title, description, topic, cefr_level, provider, video_url, thumbnail_url,
        duration_seconds, xp_reward, sort_order, owner_user_id, subtitle_en, subtitle_vi)
     VALUES (?, 'Admin QA Shared Video', 'Nội dung kiểm thử', 'Thư viện chung', 'B1', 'youtube',
             'https://www.youtube.com/watch?v=adminqa123', NULL, 120, 20, 900, NULL, 'hello world', NULL)`,
    [code],
  );
  const videoId = (insert[0] as { insertId: number }).insertId;
  createdVideoIds.push(videoId);
  await testPool.execute(
    `INSERT INTO video_segments (video_id, start_ms, end_ms, text_en, text_vi, sort_order)
     VALUES (?, 0, 2000, 'Hello world', NULL, 1)`,
    [videoId],
  );

  const adminList = await call<{ videos: Array<{ id: number; segment_count: number; xp_reward: number }> }>(
    '/api/admin/videos',
    adminToken,
  );
  assert.equal(adminList.status, 200);
  const listed = adminList.body.data!.videos.find((entry) => entry.id === videoId);
  assert.ok(listed);
  assert.equal(listed.segment_count, 1);

  const patched = await call<{ video: { topic: string; xp_reward: number; cefr_level: string } }>(
    `/api/admin/videos/${videoId}`,
    adminToken,
    { method: 'PATCH', body: { topic: 'Giao tiếp', xp_reward: 25, cefr_level: 'A2' } },
  );
  assert.equal(patched.status, 200);
  assert.equal(patched.body.data!.video.topic, 'Giao tiếp');
  assert.equal(patched.body.data!.video.xp_reward, 25);
  assert.equal(patched.body.data!.video.cefr_level, 'A2');

  const learnerList = await call<{ videos: Array<{ id: number; is_owned: boolean }> }>('/api/videos', learnerToken);
  assert.equal(learnerList.status, 200);
  const learnerEntry = learnerList.body.data!.videos.find((entry) => entry.id === videoId);
  assert.ok(learnerEntry, 'shared videos must reach every learner library');
  assert.equal(learnerEntry.is_owned, false);

  const learnerPatch = await call(`/api/admin/videos/${videoId}`, learnerToken, {
    method: 'PATCH',
    body: { topic: 'Hack' },
  });
  assert.equal(learnerPatch.status, 403);

  const removed = await call(`/api/admin/videos/${videoId}`, adminToken, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  const afterRemove = await call<{ videos: Array<{ id: number }> }>('/api/videos', learnerToken);
  assert.equal(afterRemove.body.data!.videos.some((entry) => entry.id === videoId), false);
});

test('admin cannot delete a learner-imported video through the shared endpoint', async () => {
  const code = `yt_ownqa${Date.now()}_u${learnerId}`;
  const insert = await testPool.execute(
    `INSERT INTO video_lessons
       (code, title, topic, cefr_level, provider, video_url, duration_seconds, xp_reward, sort_order, owner_user_id)
     VALUES (?, 'Learner Own Video', 'Video của tôi', 'B1', 'youtube',
             'https://www.youtube.com/watch?v=ownqa123', 90, 0, 0, ?)`,
    [code, learnerId],
  );
  const videoId = (insert[0] as { insertId: number }).insertId;
  createdVideoIds.push(videoId);

  const response = await call(`/api/admin/videos/${videoId}`, adminToken, { method: 'DELETE' });
  assert.equal(response.status, 404);
});
