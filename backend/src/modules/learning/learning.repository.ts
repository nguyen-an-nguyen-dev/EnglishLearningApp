import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../db/pool';
import { awardEligibleBadges } from '../badges/badges.repository';
import type { Badge } from '../badges/badges.types';
import type {
  AnswerRow,
  LessonRow,
  ProgressRow,
  QuestionRow,
  StageRow,
} from './learning.types';

// ─── Stages ───────────────────────────────────────────────────────────────────

export async function getAllStages(): Promise<StageRow[]> {
  const [rows] = await pool.execute<StageRow[]>(
    'SELECT id, code, title, description, sort_order FROM stages ORDER BY sort_order ASC',
  );
  return rows;
}

export async function getStageById(stageId: number): Promise<StageRow | undefined> {
  const [rows] = await pool.execute<StageRow[]>(
    'SELECT id, code, title, description, sort_order FROM stages WHERE id = ? LIMIT 1',
    [stageId],
  );
  return rows[0];
}

// ─── Lessons ──────────────────────────────────────────────────────────────────

export async function getLessonsByStage(stageId: number): Promise<LessonRow[]> {
  const [rows] = await pool.execute<LessonRow[]>(
    'SELECT id, stage_id, code, title, topic, sort_order FROM lessons WHERE stage_id = ? ORDER BY sort_order ASC',
    [stageId],
  );
  return rows;
}

export async function getLessonById(lessonId: number): Promise<LessonRow | undefined> {
  const [rows] = await pool.execute<LessonRow[]>(
    'SELECT id, stage_id, code, title, topic, sort_order FROM lessons WHERE id = ? LIMIT 1',
    [lessonId],
  );
  return rows[0];
}

export async function getLessonByIdWithStage(lessonId: number): Promise<
  (LessonRow & { stage_sort_order: number }) | undefined
> {
  interface Row extends LessonRow {
    stage_sort_order: number;
  }
  const [rows] = await pool.execute<Row[]>(
    `SELECT l.id, l.stage_id, l.code, l.title, l.topic, l.sort_order,
            s.sort_order AS stage_sort_order
     FROM lessons l
     JOIN stages s ON s.id = l.stage_id
     WHERE l.id = ? LIMIT 1`,
    [lessonId],
  );
  return rows[0];
}

// First lesson of the first stage (sort_order = 1 in each dimension)
export async function getFirstLesson(): Promise<LessonRow | undefined> {
  const [rows] = await pool.execute<LessonRow[]>(
    `SELECT l.id, l.stage_id, l.code, l.title, l.topic, l.sort_order
     FROM lessons l
     JOIN stages s ON s.id = l.stage_id
     ORDER BY s.sort_order ASC, l.sort_order ASC
     LIMIT 1`,
  );
  return rows[0];
}

// Previous lesson within the same stage (sort_order - 1), or last lesson of previous stage
export async function getPreviousLesson(lessonId: number): Promise<LessonRow | undefined> {
  interface Row extends LessonRow {
    stage_sort_order: number;
  }
  const [currentRows] = await pool.execute<Row[]>(
    `SELECT l.id, l.stage_id, l.code, l.title, l.topic, l.sort_order,
            s.sort_order AS stage_sort_order
     FROM lessons l JOIN stages s ON s.id = l.stage_id
     WHERE l.id = ? LIMIT 1`,
    [lessonId],
  );
  const current = currentRows[0];
  if (!current) return undefined;

  // Try same-stage previous
  const [sameStagePrev] = await pool.execute<LessonRow[]>(
    `SELECT id, stage_id, code, title, topic, sort_order
     FROM lessons
     WHERE stage_id = ? AND sort_order < ?
     ORDER BY sort_order DESC LIMIT 1`,
    [current.stage_id, current.sort_order],
  );
  if (sameStagePrev[0]) return sameStagePrev[0];

  // Try previous stage last lesson
  const [prevStageRows] = await pool.execute<StageRow[]>(
    `SELECT id FROM stages WHERE sort_order < ? ORDER BY sort_order DESC LIMIT 1`,
    [current.stage_sort_order],
  );
  if (!prevStageRows[0]) return undefined; // This is the very first lesson

  const prevStageId = prevStageRows[0].id;
  const [prevStageLast] = await pool.execute<LessonRow[]>(
    `SELECT id, stage_id, code, title, topic, sort_order
     FROM lessons WHERE stage_id = ? ORDER BY sort_order DESC LIMIT 1`,
    [prevStageId],
  );
  return prevStageLast[0];
}

// Next lesson within the same stage, or first lesson of next stage
export async function getNextLesson(lessonId: number): Promise<LessonRow | undefined> {
  interface Row extends LessonRow {
    stage_sort_order: number;
  }
  const [currentRows] = await pool.execute<Row[]>(
    `SELECT l.id, l.stage_id, l.code, l.title, l.topic, l.sort_order,
            s.sort_order AS stage_sort_order
     FROM lessons l JOIN stages s ON s.id = l.stage_id
     WHERE l.id = ? LIMIT 1`,
    [lessonId],
  );
  const current = currentRows[0];
  if (!current) return undefined;

  // Try same-stage next
  const [sameStageNext] = await pool.execute<LessonRow[]>(
    `SELECT id, stage_id, code, title, topic, sort_order
     FROM lessons WHERE stage_id = ? AND sort_order > ? ORDER BY sort_order ASC LIMIT 1`,
    [current.stage_id, current.sort_order],
  );
  if (sameStageNext[0]) return sameStageNext[0];

  // Try next stage first lesson
  const [nextStageRows] = await pool.execute<StageRow[]>(
    `SELECT id FROM stages WHERE sort_order > ? ORDER BY sort_order ASC LIMIT 1`,
    [current.stage_sort_order],
  );
  if (!nextStageRows[0]) return undefined;

  const nextStageId = nextStageRows[0].id;
  const [nextStageFirst] = await pool.execute<LessonRow[]>(
    `SELECT id, stage_id, code, title, topic, sort_order
     FROM lessons WHERE stage_id = ? ORDER BY sort_order ASC LIMIT 1`,
    [nextStageId],
  );
  return nextStageFirst[0];
}

// ─── Questions & Answers ──────────────────────────────────────────────────────

export async function getQuestionsByLesson(lessonId: number): Promise<QuestionRow[]> {
  const [rows] = await pool.execute<QuestionRow[]>(
    `SELECT id, lesson_id, question_text, question_type, explanation, difficulty, sort_order
     FROM questions WHERE lesson_id = ? ORDER BY sort_order ASC`,
    [lessonId],
  );
  return rows;
}

export async function getAnswersByQuestions(questionIds: number[]): Promise<AnswerRow[]> {
  if (questionIds.length === 0) return [];
  const placeholders = questionIds.map(() => '?').join(', ');
  const [rows] = await pool.execute<AnswerRow[]>(
    `SELECT id, question_id, answer_text, is_correct, sort_order
     FROM answers WHERE question_id IN (${placeholders}) ORDER BY question_id, sort_order ASC`,
    questionIds,
  );
  return rows;
}

export async function countQuestionsByLesson(lessonId: number): Promise<number> {
  interface CountRow extends RowDataPacket {
    cnt: number;
  }
  const [rows] = await pool.execute<CountRow[]>(
    'SELECT COUNT(*) AS cnt FROM questions WHERE lesson_id = ?',
    [lessonId],
  );
  return rows[0]?.cnt ?? 0;
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export async function getUserProgress(userId: number): Promise<ProgressRow[]> {
  const [rows] = await pool.execute<ProgressRow[]>(
    `SELECT id, user_id, lesson_id, status, score, started_at, completed_at, updated_at
     FROM progress WHERE user_id = ?`,
    [userId],
  );
  return rows;
}

export async function getProgressForLesson(
  userId: number,
  lessonId: number,
): Promise<ProgressRow | undefined> {
  const [rows] = await pool.execute<ProgressRow[]>(
    `SELECT id, user_id, lesson_id, status, score, started_at, completed_at, updated_at
     FROM progress WHERE user_id = ? AND lesson_id = ? LIMIT 1`,
    [userId, lessonId],
  );
  return rows[0];
}

// ─── Completion Transaction ───────────────────────────────────────────────────

export interface CompletionData {
  correctAnswers: number;
  totalQuestions: number;
  score: number;
  xpEarned: number;
  isFirstCompletion: boolean;
  badgesAwarded: Badge[];
}

export async function completeLesson(
  userId: number,
  lessonId: number,
  correctAnswers: number,
  totalQuestions: number,
  score: number,
): Promise<CompletionData> {
  const XP_PER_COMPLETION = 20;
  const connection: PoolConnection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Serialize a user's completions so XP and badge milestones cannot race.
    interface UserXpRow extends RowDataPacket {
      xp: number;
    }
    const [userRows] = await connection.execute<UserXpRow[]>(
      'SELECT xp FROM users WHERE id = ? FOR UPDATE',
      [userId],
    );
    if (!userRows[0]) throw new Error('User not found while completing lesson.');

    // 1. Check existing progress
    const [progressRows] = await connection.execute<ProgressRow[]>(
      `SELECT id, status FROM progress WHERE user_id = ? AND lesson_id = ? LIMIT 1 FOR UPDATE`,
      [userId, lessonId],
    );
    const existing = progressRows[0];
    const isFirstCompletion = !existing || existing.status !== 'completed';

    const now = new Date();

    if (existing) {
      // Update existing row
      await connection.execute(
        `UPDATE progress
         SET status = 'completed', score = ?, completed_at = ?, updated_at = ?
         WHERE user_id = ? AND lesson_id = ?`,
        [score, now, now, userId, lessonId],
      );
    } else {
      // Insert new progress row
      await connection.execute<ResultSetHeader>(
        `INSERT INTO progress (user_id, lesson_id, status, score, started_at, completed_at, updated_at)
         VALUES (?, ?, 'completed', ?, ?, ?, ?)`,
        [userId, lessonId, score, now, now, now],
      );
    }

    // 2. Award XP only on first completion
    const xpEarned = isFirstCompletion ? XP_PER_COMPLETION : 0;
    if (xpEarned > 0) {
      await connection.execute(
        `UPDATE users SET xp = xp + ? WHERE id = ?`,
        [xpEarned, userId],
      );
    }

    interface CompletedCountRow extends RowDataPacket {
      completed_count: number;
    }
    const [completedRows] = await connection.execute<CompletedCountRow[]>(
      `SELECT COUNT(*) AS completed_count
       FROM progress WHERE user_id = ? AND status = 'completed' AND score = 100`,
      [userId],
    );
    const totalXp = Number(userRows[0].xp) + xpEarned;
    const badgesAwarded = await awardEligibleBadges(
      connection,
      userId,
      Number(completedRows[0]?.completed_count ?? 0),
      totalXp,
    );

    await connection.commit();

    return { correctAnswers, totalQuestions, score, xpEarned, isFirstCompletion, badgesAwarded };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
