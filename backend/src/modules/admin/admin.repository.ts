import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../db/pool';
import {
  LAST_ACTIVITY_JOIN,
  activeUserIds,
  activityEventRows,
} from './admin.activity';
import type {
  AdminAnswerRow,
  AdminLessonRow,
  AdminQuestionRow,
  AdminSharedVideoRow,
  AdminStageRow,
  MoveDirection,
} from './admin.types';
import type { QuestionPatchInput } from './admin.validation';

export async function getStageRows(): Promise<AdminStageRow[]> {
  const [rows] = await pool.execute<AdminStageRow[]>(
    `SELECT s.id, s.code, s.title, s.description, s.theme_key, s.accent_color, s.sort_order,
            (SELECT COUNT(*) FROM lessons l WHERE l.stage_id = s.id) AS lesson_count,
            (SELECT COUNT(*) FROM questions q JOIN lessons l ON l.id = q.lesson_id WHERE l.stage_id = s.id) AS question_count
     FROM stages s
     ORDER BY s.sort_order ASC`,
  );
  return rows;
}

export async function getLessonRows(): Promise<AdminLessonRow[]> {
  const [rows] = await pool.execute<AdminLessonRow[]>(
    `SELECT l.id, l.stage_id, l.code, l.title, l.topic, l.sort_order,
            (SELECT COUNT(*) FROM questions q WHERE q.lesson_id = l.id) AS question_count
     FROM lessons l
     ORDER BY l.stage_id ASC, l.sort_order ASC`,
  );
  return rows;
}

export async function getStageRow(stageId: number): Promise<AdminStageRow | undefined> {
  const [rows] = await pool.execute<AdminStageRow[]>(
    `SELECT s.id, s.code, s.title, s.description, s.theme_key, s.accent_color, s.sort_order,
            (SELECT COUNT(*) FROM lessons l WHERE l.stage_id = s.id) AS lesson_count,
            (SELECT COUNT(*) FROM questions q JOIN lessons l ON l.id = q.lesson_id WHERE l.stage_id = s.id) AS question_count
     FROM stages s WHERE s.id = ? LIMIT 1`,
    [stageId],
  );
  return rows[0];
}

export async function getLessonRow(lessonId: number): Promise<AdminLessonRow | undefined> {
  const [rows] = await pool.execute<AdminLessonRow[]>(
    `SELECT l.id, l.stage_id, l.code, l.title, l.topic, l.sort_order,
            (SELECT COUNT(*) FROM questions q WHERE q.lesson_id = l.id) AS question_count
     FROM lessons l WHERE l.id = ? LIMIT 1`,
    [lessonId],
  );
  return rows[0];
}

interface CodeRow extends RowDataPacket {
  code: string;
}

export async function listLessonCodes(): Promise<string[]> {
  const [rows] = await pool.execute<CodeRow[]>('SELECT code FROM lessons');
  return rows.map((row) => row.code);
}

interface NumberRow extends RowDataPacket {
  value: number | null;
}

export async function nextLessonSortOrder(stageId: number): Promise<number> {
  const [rows] = await pool.execute<NumberRow[]>(
    'SELECT COALESCE(MAX(sort_order), 0) AS value FROM lessons WHERE stage_id = ?',
    [stageId],
  );
  return Number(rows[0]?.value ?? 0) + 1;
}

export async function nextQuestionSortOrder(lessonId: number): Promise<number> {
  const [rows] = await pool.execute<NumberRow[]>(
    'SELECT COALESCE(MAX(sort_order), 0) AS value FROM questions WHERE lesson_id = ?',
    [lessonId],
  );
  return Number(rows[0]?.value ?? 0) + 1;
}

export async function updateStage(
  stageId: number,
  patch: { title?: string; description?: string | null; themeKey?: string; accentColor?: string },
): Promise<void> {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  if (patch.title !== undefined) { sets.push('title = ?'); params.push(patch.title); }
  if (patch.description !== undefined) { sets.push('description = ?'); params.push(patch.description); }
  if (patch.themeKey !== undefined) { sets.push('theme_key = ?'); params.push(patch.themeKey); }
  if (patch.accentColor !== undefined) { sets.push('accent_color = ?'); params.push(patch.accentColor); }
  if (sets.length === 0) return;
  params.push(stageId);
  await pool.execute(`UPDATE stages SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function countLessonsByStage(stageId: number): Promise<number> {
  const [rows] = await pool.execute<NumberRow[]>(
    'SELECT COUNT(*) AS value FROM lessons WHERE stage_id = ?',
    [stageId],
  );
  return Number(rows[0]?.value ?? 0);
}

export async function deleteStageRow(stageId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM stages WHERE id = ?',
    [stageId],
  );
  return result.affectedRows > 0;
}

export async function insertLesson(input: {
  stageId: number;
  code: string;
  title: string;
  topic: string;
  sortOrder: number;
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO lessons (stage_id, code, title, topic, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [input.stageId, input.code, input.title, input.topic, input.sortOrder],
  );
  return result.insertId;
}

export async function updateLesson(
  lessonId: number,
  patch: { title?: string; topic?: string; stageId?: number; sortOrder?: number },
): Promise<void> {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  if (patch.title !== undefined) { sets.push('title = ?'); params.push(patch.title); }
  if (patch.topic !== undefined) { sets.push('topic = ?'); params.push(patch.topic); }
  if (patch.stageId !== undefined) { sets.push('stage_id = ?'); params.push(patch.stageId); }
  if (patch.sortOrder !== undefined) { sets.push('sort_order = ?'); params.push(patch.sortOrder); }
  if (sets.length === 0) return;
  params.push(lessonId);
  await pool.execute(`UPDATE lessons SET ${sets.join(', ')} WHERE id = ?`, params);
}

// `progress` and `match_answers` have no cascade, so both are cleared in the
// same transaction before the lesson row goes away.
export async function deleteLessonTx(lessonId: number): Promise<boolean> {
  const connection: PoolConnection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE match_answers SET question_id = NULL
        WHERE question_id IN (SELECT id FROM questions WHERE lesson_id = ?)`,
      [lessonId],
    );
    await connection.execute('DELETE FROM progress WHERE lesson_id = ?', [lessonId]);
    await connection.execute('DELETE FROM questions WHERE lesson_id = ?', [lessonId]);
    const [result] = await connection.execute<ResultSetHeader>(
      'DELETE FROM lessons WHERE id = ?',
      [lessonId],
    );
    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getQuestionRows(lessonId: number): Promise<AdminQuestionRow[]> {
  const [rows] = await pool.execute<AdminQuestionRow[]>(
    `SELECT id, lesson_id, question_text, question_type, explanation, audio_url, word_bank,
            difficulty, sort_order
     FROM questions WHERE lesson_id = ? ORDER BY sort_order ASC`,
    [lessonId],
  );
  return rows;
}

export async function getQuestionRow(questionId: number): Promise<AdminQuestionRow | undefined> {
  const [rows] = await pool.execute<AdminQuestionRow[]>(
    `SELECT id, lesson_id, question_text, question_type, explanation, audio_url, word_bank,
            difficulty, sort_order
     FROM questions WHERE id = ? LIMIT 1`,
    [questionId],
  );
  return rows[0];
}

export async function getAnswerRows(questionIds: number[]): Promise<AdminAnswerRow[]> {
  if (questionIds.length === 0) return [];
  const placeholders = questionIds.map(() => '?').join(', ');
  const [rows] = await pool.execute<AdminAnswerRow[]>(
    `SELECT id, question_id, answer_text, is_correct, sort_order
     FROM answers WHERE question_id IN (${placeholders}) ORDER BY question_id, sort_order ASC`,
    questionIds,
  );
  return rows;
}

export async function insertQuestionTx(
  lessonId: number,
  input: {
    questionText: string;
    questionType: string;
    explanation: string | null;
    audioUrl: string | null;
    wordBank: string[];
    difficulty: string;
    sortOrder: number;
    answers: Array<{ answerText: string; isCorrect: boolean }>;
  },
): Promise<number> {
  const connection: PoolConnection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO questions
         (lesson_id, question_text, question_type, explanation, audio_url, word_bank, difficulty, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lessonId,
        input.questionText,
        input.questionType,
        input.explanation,
        input.audioUrl,
        input.wordBank.length > 0 ? JSON.stringify(input.wordBank) : null,
        input.difficulty,
        input.sortOrder,
      ],
    );
    const questionId = result.insertId;
    await insertAnswers(connection, questionId, input.answers);
    await connection.commit();
    return questionId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function insertAnswers(
  connection: PoolConnection,
  questionId: number,
  answers: Array<{ answerText: string; isCorrect: boolean }>,
): Promise<void> {
  for (const [index, answer] of answers.entries()) {
    await connection.execute(
      `INSERT INTO answers (question_id, answer_text, is_correct, sort_order)
       VALUES (?, ?, ?, ?)`,
      [questionId, answer.answerText, answer.isCorrect, index + 1],
    );
  }
}

export async function updateQuestion(
  questionId: number,
  patch: QuestionPatchInput,
): Promise<void> {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  if (patch.questionText !== undefined) { sets.push('question_text = ?'); params.push(patch.questionText); }
  if (patch.questionType !== undefined) { sets.push('question_type = ?'); params.push(patch.questionType); }
  if (patch.explanation !== undefined) { sets.push('explanation = ?'); params.push(patch.explanation); }
  if (patch.audioUrl !== undefined) { sets.push('audio_url = ?'); params.push(patch.audioUrl); }
  if (patch.difficulty !== undefined) { sets.push('difficulty = ?'); params.push(patch.difficulty); }
  if (patch.wordBank !== undefined) {
    sets.push('word_bank = ?');
    params.push(patch.wordBank.length > 0 ? JSON.stringify(patch.wordBank) : null);
  }
  if (sets.length === 0) return;
  params.push(questionId);
  await pool.execute(`UPDATE questions SET ${sets.join(', ')} WHERE id = ?`, params);
}

/** Replacing the answer set drops the old rows, so `match_answers.answer_id` becomes NULL. */
export async function replaceAnswersTx(
  questionId: number,
  answers: Array<{ answerText: string; isCorrect: boolean }>,
): Promise<void> {
  const connection: PoolConnection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM answers WHERE question_id = ?', [questionId]);
    await insertAnswers(connection, questionId, answers);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteQuestionTx(questionId: number): Promise<boolean> {
  const connection: PoolConnection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      'UPDATE match_answers SET question_id = NULL WHERE question_id = ?',
      [questionId],
    );
    const [result] = await connection.execute<ResultSetHeader>(
      'DELETE FROM questions WHERE id = ?',
      [questionId],
    );
    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function countQuestionsByLesson(lessonId: number): Promise<number> {
  const [rows] = await pool.execute<NumberRow[]>(
    'SELECT COUNT(*) AS value FROM questions WHERE lesson_id = ?',
    [lessonId],
  );
  return Number(rows[0]?.value ?? 0);
}

// `stages.sort_order`, `lessons(stage_id, sort_order)` and
// `questions(lesson_id, sort_order)` are unique, so a swap parks one row on a
// free temporary slot instead of colliding mid-update.

interface OrderRow extends RowDataPacket {
  id: number;
  sort_order: number;
}

async function swapOrders(
  connection: PoolConnection,
  table: 'stages' | 'lessons' | 'questions',
  current: OrderRow,
  neighbour: OrderRow,
): Promise<void> {
  const [rows] = await connection.execute<NumberRow[]>(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS value FROM ${table}`,
  );
  const parkingSpot = Number(rows[0]?.value ?? 0) + 1;
  await connection.execute(`UPDATE ${table} SET sort_order = ? WHERE id = ?`, [parkingSpot, current.id]);
  await connection.execute(`UPDATE ${table} SET sort_order = ? WHERE id = ?`, [current.sort_order, neighbour.id]);
  await connection.execute(`UPDATE ${table} SET sort_order = ? WHERE id = ?`, [neighbour.sort_order, current.id]);
}

async function moveRow(
  table: 'stages' | 'lessons' | 'questions',
  id: number,
  direction: MoveDirection,
  scope?: { column: 'stage_id' | 'lesson_id'; value: number },
): Promise<boolean> {
  const connection: PoolConnection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const scopeSql = scope ? ` AND ${scope.column} = ?` : '';
    const scopeParams = scope ? [scope.value] : [];
    const [currentRows] = await connection.execute<OrderRow[]>(
      `SELECT id, sort_order FROM ${table} WHERE id = ?${scopeSql} LIMIT 1 FOR UPDATE`,
      [id, ...scopeParams],
    );
    const current = currentRows[0];
    if (!current) {
      await connection.rollback();
      return false;
    }
    const comparison = direction === 'up' ? '<' : '>';
    const order = direction === 'up' ? 'DESC' : 'ASC';
    const [neighbourRows] = await connection.execute<OrderRow[]>(
      `SELECT id, sort_order FROM ${table}
        WHERE sort_order ${comparison} ?${scopeSql}
        ORDER BY sort_order ${order} LIMIT 1 FOR UPDATE`,
      [current.sort_order, ...scopeParams],
    );
    const neighbour = neighbourRows[0];
    if (!neighbour) {
      await connection.rollback();
      return true; // already at the edge of its list
    }
    await swapOrders(connection, table, current, neighbour);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export const moveStage = (stageId: number, direction: MoveDirection): Promise<boolean> =>
  moveRow('stages', stageId, direction);

export async function moveLesson(
  lessonId: number,
  direction: MoveDirection,
): Promise<boolean> {
  const lesson = await getLessonRow(lessonId);
  if (!lesson) return false;
  return moveRow('lessons', lessonId, direction, { column: 'stage_id', value: lesson.stage_id });
}

export async function moveQuestion(
  questionId: number,
  direction: MoveDirection,
): Promise<boolean> {
  const question = await getQuestionRow(questionId);
  if (!question) return false;
  return moveRow('questions', questionId, direction, { column: 'lesson_id', value: question.lesson_id });
}

const SHARED_VIDEO_COLUMNS = `v.id, v.code, v.title, v.description, v.topic, v.cefr_level, v.provider,
  v.video_url, v.thumbnail_url, v.duration_seconds, v.xp_reward, v.sort_order, v.created_at,
  (SELECT COUNT(*) FROM video_segments s WHERE s.video_id = v.id) AS segment_count`;

export async function getSharedVideoRows(): Promise<AdminSharedVideoRow[]> {
  const [rows] = await pool.execute<AdminSharedVideoRow[]>(
    `SELECT ${SHARED_VIDEO_COLUMNS} FROM video_lessons v
      WHERE v.owner_user_id IS NULL
      ORDER BY v.sort_order ASC, v.created_at ASC`,
  );
  return rows;
}

export async function getSharedVideoRow(videoId: number): Promise<AdminSharedVideoRow | undefined> {
  const [rows] = await pool.execute<AdminSharedVideoRow[]>(
    `SELECT ${SHARED_VIDEO_COLUMNS} FROM video_lessons v
      WHERE v.id = ? AND v.owner_user_id IS NULL LIMIT 1`,
    [videoId],
  );
  return rows[0];
}

export async function updateSharedVideo(
  videoId: number,
  patch: {
    title?: string;
    description?: string | null;
    topic?: string;
    cefrLevel?: string;
    xpReward?: number;
  },
): Promise<void> {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  if (patch.title !== undefined) { sets.push('title = ?'); params.push(patch.title); }
  if (patch.description !== undefined) { sets.push('description = ?'); params.push(patch.description); }
  if (patch.topic !== undefined) { sets.push('topic = ?'); params.push(patch.topic); }
  if (patch.cefrLevel !== undefined) { sets.push('cefr_level = ?'); params.push(patch.cefrLevel); }
  if (patch.xpReward !== undefined) { sets.push('xp_reward = ?'); params.push(patch.xpReward); }
  if (sets.length === 0) return;
  params.push(videoId);
  await pool.execute(
    `UPDATE video_lessons SET ${sets.join(', ')} WHERE id = ? AND owner_user_id IS NULL`,
    params,
  );
}

/** Progress rows and segments cascade from the video row. */
export async function deleteSharedVideoRow(videoId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM video_lessons WHERE id = ? AND owner_user_id IS NULL',
    [videoId],
  );
  return result.affectedRows > 0;
}

export async function moveSharedVideo(
  videoId: number,
  direction: MoveDirection,
): Promise<boolean> {
  const connection: PoolConnection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [currentRows] = await connection.execute<OrderRow[]>(
      `SELECT id, sort_order FROM video_lessons
        WHERE id = ? AND owner_user_id IS NULL LIMIT 1 FOR UPDATE`,
      [videoId],
    );
    const current = currentRows[0];
    if (!current) {
      await connection.rollback();
      return false;
    }
    const comparison = direction === 'up' ? '<' : '>';
    const order = direction === 'up' ? 'DESC' : 'ASC';
    const [neighbourRows] = await connection.execute<OrderRow[]>(
      `SELECT id, sort_order FROM video_lessons
        WHERE owner_user_id IS NULL AND sort_order ${comparison} ?
        ORDER BY sort_order ${order} LIMIT 1 FOR UPDATE`,
      [current.sort_order],
    );
    const neighbour = neighbourRows[0];
    if (!neighbour) {
      await connection.rollback();
      return true;
    }
    // Video sort_order has no unique key, so the values can be exchanged directly.
    await connection.execute(
      'UPDATE video_lessons SET sort_order = ? WHERE id = ?',
      [neighbour.sort_order, current.id],
    );
    await connection.execute(
      'UPDATE video_lessons SET sort_order = ? WHERE id = ?',
      [current.sort_order, neighbour.id],
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// The UNION in admin.activity is the single source of truth for "active learner
// on day X"; keep it in one helper so overview / trend / inactive agree.

export interface NumberValueRow extends RowDataPacket {
  value: number | null;
}

type DbValue = string | number | null | Date | Buffer;

async function scalar(sql: string, params: DbValue[] = []): Promise<number> {
  const [rows] = await pool.execute<NumberValueRow[]>(sql, [...params] as never[]);
  return Number(rows[0]?.value ?? 0);
}

function activeUnion(dateExpr: string): string {
  return activeUserIds(dateExpr.replaceAll('__TS__', 'ts'));
}

export async function countLearners(): Promise<number> {
  return scalar("SELECT COUNT(*) AS value FROM users WHERE role = 'learner'");
}

export async function countAdmins(): Promise<number> {
  return scalar("SELECT COUNT(*) AS value FROM users WHERE role = 'admin'");
}

export async function countNewUsers(range: 'today' | 'yesterday' | 'week' | 'month'): Promise<number> {
  const expr =
    range === 'today'
      ? 'DATE(created_at) = CURDATE()'
      : range === 'yesterday'
        ? 'DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)'
        : range === 'week'
          ? 'created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)'
          : 'created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
  return scalar(`SELECT COUNT(*) AS value FROM users WHERE role = 'learner' AND ${expr}`);
}

export async function countActiveOnDate(offsetDays: number): Promise<number> {
  const when =
    offsetDays === 0
      ? 'DATE(__TS__) = CURDATE()'
      : `DATE(__TS__) = DATE_SUB(CURDATE(), INTERVAL ${offsetDays} DAY)`;
  return scalar(
    `SELECT COUNT(DISTINCT s.uid) AS value FROM ${activeUnion(when)} s
     JOIN users u ON u.id = s.uid AND u.role = 'learner'`,
  );
}

export async function countActiveWithin(days: number): Promise<number> {
  const when = `__TS__ >= DATE_SUB(NOW(), INTERVAL ${days} DAY)`;
  return scalar(
    `SELECT COUNT(DISTINCT s.uid) AS value FROM ${activeUnion(when)} s
     JOIN users u ON u.id = s.uid AND u.role = 'learner'`,
  );
}

export async function countReturningToday(): Promise<number> {
  return scalar(
    `SELECT COUNT(DISTINCT s.uid) AS value FROM ${activeUnion('DATE(__TS__) = CURDATE()')} s
     JOIN users u ON u.id = s.uid AND u.role = 'learner' AND DATE(u.created_at) < CURDATE()`,
  );
}

export async function countNeverActive(): Promise<number> {
  return scalar(
    `SELECT COUNT(*) AS value FROM users u WHERE u.role = 'learner'
     AND NOT EXISTS (SELECT 1 FROM ${activityEventRows()} ev WHERE ev.user_id = u.id)`,
  );
}

export async function getUserAggregates(): Promise<{
  avgXp: number;
  totalXp: number;
  avgStreak: number;
  maxStreak: number;
}> {
  const [rows] = await pool.execute<
    Array<RowDataPacket & { avg_xp: number | null; total_xp: number | null; avg_streak: number | null; max_streak: number | null }>
  >(
    `SELECT AVG(xp) AS avg_xp, COALESCE(SUM(xp), 0) AS total_xp,
            AVG(streak) AS avg_streak, COALESCE(MAX(streak), 0) AS max_streak
     FROM users WHERE role = 'learner'`,
  );
  const row = rows[0];
  return {
    avgXp: Number(row?.avg_xp ?? 0),
    totalXp: Number(row?.total_xp ?? 0),
    avgStreak: Number(row?.avg_streak ?? 0),
    maxStreak: Number(row?.max_streak ?? 0),
  };
}

export async function getLessonAggregates(): Promise<{
  completed: number;
  inProgress: number;
  totalProgressRows: number;
}> {
  const [rows] = await pool.execute<
    Array<RowDataPacket & { completed: number; in_progress: number; total_rows: number }>
  >(
    `SELECT
       (SELECT COUNT(*) FROM progress WHERE status = 'completed') AS completed,
       (SELECT COUNT(*) FROM progress WHERE status = 'in_progress') AS in_progress,
       (SELECT COUNT(*) FROM progress) AS total_rows`,
  );
  const row = rows[0];
  return {
    completed: Number(row?.completed ?? 0),
    inProgress: Number(row?.in_progress ?? 0),
    totalProgressRows: Number(row?.total_rows ?? 0),
  };
}

export async function getVideoAggregates(): Promise<{ shared: number; completed: number; total: number }> {
  const [rows] = await pool.execute<
    Array<RowDataPacket & { shared: number; completed: number; total: number }>
  >(
    `SELECT
       (SELECT COUNT(*) FROM video_lessons WHERE owner_user_id IS NULL) AS shared,
       (SELECT COUNT(*) FROM video_progress WHERE completed = 1) AS completed,
       (SELECT COUNT(*) FROM video_progress) AS total`,
  );
  const row = rows[0];
  return {
    shared: Number(row?.shared ?? 0),
    completed: Number(row?.completed ?? 0),
    total: Number(row?.total ?? 0),
  };
}

export async function getEngagementAggregates(): Promise<{
  matchesTotal: number;
  matchesToday: number;
  translationsTotal: number;
  answersTotal: number;
  answersCorrect: number;
  savedWordsTotal: number;
}> {
  const [rows] = await pool.execute<
    Array<
      RowDataPacket & {
        matches_total: number;
        matches_today: number;
        translations_total: number;
        answers_total: number;
        answers_correct: number;
        saved_words_total: number;
      }
    >
  >(
    `SELECT
       (SELECT COUNT(*) FROM matches) AS matches_total,
       (SELECT COUNT(*) FROM matches WHERE DATE(created_at) = CURDATE()) AS matches_today,
       (SELECT COUNT(*) FROM translations) AS translations_total,
       (SELECT COUNT(*) FROM learning_answer_attempts) AS answers_total,
       (SELECT COUNT(*) FROM learning_answer_attempts WHERE is_correct = 1) AS answers_correct,
       (SELECT COUNT(*) FROM saved_words) AS saved_words_total`,
  );
  const row = rows[0];
  return {
    matchesTotal: Number(row?.matches_total ?? 0),
    matchesToday: Number(row?.matches_today ?? 0),
    translationsTotal: Number(row?.translations_total ?? 0),
    answersTotal: Number(row?.answers_total ?? 0),
    answersCorrect: Number(row?.answers_correct ?? 0),
    savedWordsTotal: Number(row?.saved_words_total ?? 0),
  };
}

export async function getDayCounts(offsetDays: number): Promise<{
  newUsers: number;
  lessonsCompleted: number;
  lessonsStarted: number;
  videosCompleted: number;
  attempts: number;
  matchesStarted: number;
  translations: number;
}> {
  const day = offsetDays === 0 ? 'CURDATE()' : `DATE_SUB(CURDATE(), INTERVAL ${offsetDays} DAY)`;
  const [rows] = await pool.execute<
    Array<
      RowDataPacket & {
        new_users: number;
        lessons_completed: number;
        lessons_started: number;
        videos_completed: number;
        attempts: number;
        matches_started: number;
        translations: number;
      }
    >
  >(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE role = 'learner' AND DATE(created_at) = ${day}) AS new_users,
       (SELECT COUNT(*) FROM progress WHERE status = 'completed' AND DATE(completed_at) = ${day}) AS lessons_completed,
       (SELECT COUNT(*) FROM progress WHERE DATE(started_at) = ${day}) AS lessons_started,
       (SELECT COUNT(*) FROM video_progress WHERE completed = 1 AND DATE(completed_at) = ${day}) AS videos_completed,
       (SELECT COUNT(*) FROM learning_answer_attempts WHERE DATE(created_at) = ${day}) AS attempts,
       (SELECT COUNT(*) FROM matches WHERE DATE(created_at) = ${day}) AS matches_started,
       (SELECT COUNT(*) FROM translations WHERE DATE(created_at) = ${day}) AS translations`,
  );
  const row = rows[0];
  return {
    newUsers: Number(row?.new_users ?? 0),
    lessonsCompleted: Number(row?.lessons_completed ?? 0),
    lessonsStarted: Number(row?.lessons_started ?? 0),
    videosCompleted: Number(row?.videos_completed ?? 0),
    attempts: Number(row?.attempts ?? 0),
    matchesStarted: Number(row?.matches_started ?? 0),
    translations: Number(row?.translations ?? 0),
  };
}

export interface DayLabelRow extends RowDataPacket {
  day: string;
}

export async function getDayLabels(days: number): Promise<string[]> {
  const [rows] = await pool.execute<DayLabelRow[]>(
    `SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL n DAY), '%Y-%m-%d') AS day
     FROM (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
           UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
           UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13
           UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18
           UNION ALL SELECT 19 UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23
           UNION ALL SELECT 24 UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28
           UNION ALL SELECT 29) t WHERE n < ? ORDER BY n DESC`,
    [days],
  );
  return rows.map((row) => String(row.day));
}

export interface StageStatRow extends RowDataPacket {
  stage_id: number;
  stage_title: string;
  sort_order: number;
  lesson_count: number;
  learners_started: number;
  completions: number;
  avg_score: number | null;
}

export async function getStageStats(): Promise<StageStatRow[]> {
  const [rows] = await pool.execute<StageStatRow[]>(
    `SELECT s.id AS stage_id, s.title AS stage_title, s.sort_order,
            (SELECT COUNT(*) FROM lessons l WHERE l.stage_id = s.id) AS lesson_count,
            (SELECT COUNT(DISTINCT p.user_id) FROM progress p JOIN lessons l ON l.id = p.lesson_id WHERE l.stage_id = s.id) AS learners_started,
            (SELECT COUNT(*) FROM progress p JOIN lessons l ON l.id = p.lesson_id WHERE l.stage_id = s.id AND p.status = 'completed') AS completions,
            (SELECT AVG(p.score) FROM progress p JOIN lessons l ON l.id = p.lesson_id WHERE l.stage_id = s.id AND p.score IS NOT NULL) AS avg_score
     FROM stages s ORDER BY s.sort_order ASC`,
  );
  return rows;
}

export interface LessonStatRow extends RowDataPacket {
  lesson_id: number;
  stage_id: number;
  stage_title: string;
  title: string;
  topic: string;
  question_count: number;
  learners_started: number;
  completions: number;
  avg_score: number | null;
}

export async function getLessonStats(): Promise<LessonStatRow[]> {
  const [rows] = await pool.execute<LessonStatRow[]>(
    `SELECT l.id AS lesson_id, l.stage_id, s.title AS stage_title,
            l.title, l.topic,
            (SELECT COUNT(*) FROM questions q WHERE q.lesson_id = l.id) AS question_count,
            (SELECT COUNT(DISTINCT p.user_id) FROM progress p WHERE p.lesson_id = l.id) AS learners_started,
            (SELECT COUNT(*) FROM progress p WHERE p.lesson_id = l.id AND p.status = 'completed') AS completions,
            (SELECT AVG(p.score) FROM progress p WHERE p.lesson_id = l.id AND p.score IS NOT NULL) AS avg_score
     FROM lessons l JOIN stages s ON s.id = l.stage_id
     ORDER BY s.sort_order ASC, l.sort_order ASC`,
  );
  return rows;
}

export async function getContentCounts(): Promise<{
  stages: number;
  lessons: number;
  questions: number;
  answers: number;
  sharedVideos: number;
  videoSegments: number;
  personalVideos: number;
  battleWords: number;
  badges: number;
  translationsTotal: number;
  chatsTotal: number;
}> {
  const [rows] = await pool.execute<
    Array<
      RowDataPacket & {
        stages: number;
        lessons: number;
        questions: number;
        answers: number;
        shared_videos: number;
        video_segments: number;
        personal_videos: number;
        battle_words: number;
        badges: number;
        translations_total: number;
        chats_total: number;
      }
    >
  >(
    `SELECT
       (SELECT COUNT(*) FROM stages) AS stages,
       (SELECT COUNT(*) FROM lessons) AS lessons,
       (SELECT COUNT(*) FROM questions) AS questions,
       (SELECT COUNT(*) FROM answers) AS answers,
       (SELECT COUNT(*) FROM video_lessons WHERE owner_user_id IS NULL) AS shared_videos,
       (SELECT COUNT(*) FROM video_segments) AS video_segments,
       (SELECT COUNT(*) FROM video_lessons WHERE owner_user_id IS NOT NULL) AS personal_videos,
       (SELECT COUNT(*) FROM battle_words) AS battle_words,
       (SELECT COUNT(*) FROM badges) AS badges,
       (SELECT COUNT(*) FROM translations) AS translations_total,
       (SELECT COUNT(*) FROM chats) AS chats_total`,
  );
  const row = rows[0];
  return {
    stages: Number(row?.stages ?? 0),
    lessons: Number(row?.lessons ?? 0),
    questions: Number(row?.questions ?? 0),
    answers: Number(row?.answers ?? 0),
    sharedVideos: Number(row?.shared_videos ?? 0),
    videoSegments: Number(row?.video_segments ?? 0),
    personalVideos: Number(row?.personal_videos ?? 0),
    battleWords: Number(row?.battle_words ?? 0),
    badges: Number(row?.badges ?? 0),
    translationsTotal: Number(row?.translations_total ?? 0),
    chatsTotal: Number(row?.chats_total ?? 0),
  };
}

export interface InactiveUserDbRow extends RowDataPacket {
  id: number;
  display_name: string;
  email: string;
  xp: number;
  streak: number;
  created_at: Date;
  last_activity_at: Date | null;
  lessons_completed: number;
}

export async function listInactiveUsers(minDays: number, limit: number): Promise<InactiveUserDbRow[]> {
  const [rows] = await pool.execute<InactiveUserDbRow[]>(
    `SELECT u.id, u.display_name, u.email, u.xp, u.streak, u.created_at,
            activity.last_activity_at,
            (SELECT COUNT(*) FROM progress p WHERE p.user_id = u.id AND p.status = 'completed') AS lessons_completed
     FROM users u
     ${LAST_ACTIVITY_JOIN}
     WHERE u.role = 'learner'
       AND (
         activity.last_activity_at IS NULL
         OR activity.last_activity_at < DATE_SUB(NOW(), INTERVAL ? DAY)
       )
     ORDER BY COALESCE(activity.last_activity_at, u.created_at) ASC
     LIMIT ?`,
    [minDays, limit],
  );
  return rows;
}
