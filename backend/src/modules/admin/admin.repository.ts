import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../db/pool';
import type {
  AdminAnswerRow,
  AdminLessonRow,
  AdminQuestionRow,
  AdminSharedVideoRow,
  AdminStageRow,
  MoveDirection,
} from './admin.types';
import type { QuestionPatchInput } from './admin.validation';

// --- Content tree ---

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

export async function listStageCodes(): Promise<string[]> {
  const [rows] = await pool.execute<CodeRow[]>('SELECT code FROM stages');
  return rows.map((row) => row.code);
}

export async function listLessonCodes(): Promise<string[]> {
  const [rows] = await pool.execute<CodeRow[]>('SELECT code FROM lessons');
  return rows.map((row) => row.code);
}

interface NumberRow extends RowDataPacket {
  value: number | null;
}

export async function nextStageSortOrder(): Promise<number> {
  const [rows] = await pool.execute<NumberRow[]>(
    'SELECT COALESCE(MAX(sort_order), 0) AS value FROM stages',
  );
  return Number(rows[0]?.value ?? 0) + 1;
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

// --- Stages ---

export async function insertStage(input: {
  code: string;
  title: string;
  description: string | null;
  themeKey: string;
  accentColor: string;
  sortOrder: number;
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO stages (code, title, description, theme_key, accent_color, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.code, input.title, input.description, input.themeKey, input.accentColor, input.sortOrder],
  );
  return result.insertId;
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

// --- Lessons ---

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

/**
 * Learners' rows hang off `progress` (no cascade) and `match_answers` references
 * `questions` (no cascade), so both are cleared inside the same transaction
 * before the lesson row itself goes away.
 */
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

// --- Questions & answers ---

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

// --- Reordering ---
//
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

// --- Shared video library ---

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
