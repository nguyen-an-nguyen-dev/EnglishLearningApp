import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../db/pool';
import type {
  ReviewGrade,
  ReviewItem,
  ReviewKind,
  ReviewQuestionPayload,
  ReviewSource,
  ReviewWordPayload,
} from './analytics.types';
import { REVIEW_SESSION_LIMIT, initialState, schedule, type ReviewState } from './review.scheduler';

// ─── Row types ────────────────────────────────────────────────────────────────

interface ReviewRow extends RowDataPacket {
  id: number;
  user_id: number;
  kind: ReviewKind;
  ref_id: number;
  source: ReviewSource;
  ease: string | number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  mistake_count: number;
  due_at: Date | string;
  last_reviewed_at: Date | string | null;
  last_grade: ReviewGrade | null;
}

interface WordRow extends RowDataPacket {
  id: number;
  word_en: string;
  translation_vi: string;
  part_of_speech: string;
  cefr_level: string;
  explanation_vi: string;
  example_en: string;
  example_vi: string;
}

interface QuestionRow extends RowDataPacket {
  id: number;
  question_text: string;
  question_type: string;
  difficulty: string;
  explanation: string | null;
  lesson_title: string;
}

interface AnswerOptionRow extends RowDataPacket {
  id: number;
  question_id: number;
  answer_text: string;
  sort_order: number;
}

interface CorrectAnswerRow extends RowDataPacket {
  id: number;
  question_id: number;
  answer_text: string;
}

interface SavedIpaRow extends RowDataPacket {
  word: string;
  ipa: string | null;
}

export interface LapsedWord {
  word_id: number;
  word: string;
  lapses: number;
}

function asIso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toState(row: ReviewRow): ReviewState {
  return {
    ease: Number(row.ease),
    intervalDays: Number(row.interval_days),
    repetitions: Number(row.repetitions),
    lapses: Number(row.lapses),
  };
}

// ─── Reads ────────────────────────────────────────────────────────────────────

async function hydrate(userId: number, rows: ReviewRow[]): Promise<ReviewItem[]> {
  if (rows.length === 0) return [];

  const wordIds = rows.filter((row) => row.kind === 'word').map((row) => Number(row.ref_id));
  const questionIds = rows.filter((row) => row.kind === 'question').map((row) => Number(row.ref_id));

  const words = new Map<number, ReviewWordPayload>();
  if (wordIds.length > 0) {
    const placeholders = wordIds.map(() => '?').join(', ');
    const [wordRows] = await pool.execute<WordRow[]>(
      `SELECT id, word_en, translation_vi, part_of_speech, cefr_level,
              explanation_vi, example_en, example_vi
         FROM battle_words WHERE id IN (${placeholders})`,
      wordIds,
    );
    // `battle_words` stores no pronunciation; the IPA the learner saw belongs
    // to the video where they saved the word. It is a nice-to-have on the card,
    // so a missing row just means no phonetics.
    const ipaByWord = new Map<string, string>();
    if (wordRows.length > 0) {
      const names = wordRows.map((row) => row.word_en);
      const namePlaceholders = names.map(() => '?').join(', ');
      const [ipaRows] = await pool.execute<SavedIpaRow[]>(
        `SELECT word, MAX(ipa) AS ipa
           FROM saved_words
          WHERE user_id = ? AND ipa IS NOT NULL AND word IN (${namePlaceholders})
          GROUP BY word`,
        [userId, ...names],
      );
      for (const row of ipaRows) {
        if (row.ipa) ipaByWord.set(row.word, row.ipa);
      }
    }
    for (const row of wordRows) {
      words.set(Number(row.id), {
        word: row.word_en,
        translation: row.translation_vi,
        ipa: ipaByWord.get(row.word_en) ?? null,
        part_of_speech: row.part_of_speech,
        cefr_level: row.cefr_level,
        explanation: row.explanation_vi,
        example_en: row.example_en,
        example_vi: row.example_vi,
      });
    }
  }

  const questions = new Map<number, ReviewQuestionPayload>();
  if (questionIds.length > 0) {
    const placeholders = questionIds.map(() => '?').join(', ');
    const [questionRows] = await pool.execute<QuestionRow[]>(
      `SELECT q.id, q.question_text, q.question_type, q.difficulty, q.explanation,
              l.title AS lesson_title
         FROM questions q JOIN lessons l ON l.id = q.lesson_id
        WHERE q.id IN (${placeholders})`,
      questionIds,
    );
    const [optionRows] = await pool.execute<AnswerOptionRow[]>(
      `SELECT id, question_id, answer_text, sort_order
         FROM answers WHERE question_id IN (${placeholders})
        ORDER BY question_id, sort_order ASC`,
      questionIds,
    );
    for (const row of questionRows) {
      questions.set(Number(row.id), {
        prompt: row.question_text,
        question_type: row.question_type,
        difficulty: row.difficulty,
        explanation: row.explanation,
        lesson_title: row.lesson_title,
        answers: optionRows
          .filter((option) => Number(option.question_id) === Number(row.id))
          .map((option) => ({
            id: Number(option.id),
            answer_text: option.answer_text,
            sort_order: Number(option.sort_order),
          })),
      });
    }
  }

  return rows.flatMap((row) => {
    const kind = row.kind;
    const refId = Number(row.ref_id);
    const word = kind === 'word' ? words.get(refId) ?? null : null;
    const question = kind === 'question' ? questions.get(refId) ?? null : null;
    // A deleted word or question leaves an orphan row; skip it rather than
    // render an empty card the learner cannot act on.
    if (kind === 'word' && !word) return [];
    if (kind === 'question' && !question) return [];
    return [{
      id: Number(row.id),
      kind,
      ref_id: refId,
      source: row.source,
      ease: Number(row.ease),
      interval_days: Number(row.interval_days),
      repetitions: Number(row.repetitions),
      lapses: Number(row.lapses),
      mistake_count: Number(row.mistake_count),
      due_at: asIso(row.due_at) ?? new Date().toISOString(),
      last_reviewed_at: asIso(row.last_reviewed_at),
      last_grade: row.last_grade,
      word,
      question,
    } satisfies ReviewItem];
  });
}

/**
 * The shortlist a learner actually sees. Ordering and the cap both happen in
 * SQL, so a learner with thousands of due items still reads only a handful of
 * rows — the formula mirrors `reviewPriority()` exactly:
 *
 *   overdue days + (lapses × 2 + mistakes) + 1.5 when never recalled
 *
 * The total due count still lives in `getCounts()`, so nothing is lost.
 */
export async function listDueShortlist(
  userId: number,
  limit: number = REVIEW_SESSION_LIMIT,
): Promise<ReviewItem[]> {
  const safeLimit = Math.max(1, Math.trunc(limit));
  const [rows] = await pool.execute<ReviewRow[]>(
    `SELECT *
       FROM review_items
      WHERE user_id = ? AND due_at <= NOW()
      ORDER BY (TIMESTAMPDIFF(SECOND, due_at, NOW()) / 86400)
               + (lapses * 2 + mistake_count)
               + IF(repetitions = 0, 1.5, 0) DESC,
               due_at ASC
      LIMIT ${safeLimit}`,
    [userId],
  );
  return hydrate(userId, rows);
}

export async function listUpcoming(userId: number, limit = 20): Promise<ReviewItem[]> {
  const safeLimit = Math.max(1, Math.trunc(limit));
  const [rows] = await pool.execute<ReviewRow[]>(
    `SELECT * FROM review_items
      WHERE user_id = ? AND due_at > NOW()
      ORDER BY due_at ASC
      LIMIT ${safeLimit}`,
    [userId],
  );
  return hydrate(userId, rows);
}

/** Hydrate an explicit set of ids, used after grading a single item. */
export async function hydrateByIds(userId: number, ids: number[]): Promise<ReviewItem[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(', ');
  const [rows] = await pool.execute<ReviewRow[]>(
    `SELECT * FROM review_items WHERE user_id = ? AND id IN (${placeholders})`,
    [userId, ...ids],
  );
  return hydrate(userId, rows);
}

export async function getCounts(userId: number): Promise<{
  due: number;
  words: number;
  questions: number;
  total: number;
}> {
  interface CountRow extends RowDataPacket {
    due: number;
    words: number;
    questions: number;
    total: number;
  }
  const [rows] = await pool.execute<CountRow[]>(
    `SELECT
       COALESCE(SUM(due_at <= NOW()), 0) AS due,
       COALESCE(SUM(kind = 'word'), 0) AS words,
       COALESCE(SUM(kind = 'question'), 0) AS questions,
       COUNT(*) AS total
     FROM review_items WHERE user_id = ?`,
    [userId],
  );
  const row = rows[0];
  return {
    due: Number(row?.due ?? 0),
    words: Number(row?.words ?? 0),
    questions: Number(row?.questions ?? 0),
    total: Number(row?.total ?? 0),
  };
}

export async function findItem(userId: number, itemId: number): Promise<ReviewRow | null> {
  const [rows] = await pool.execute<ReviewRow[]>(
    'SELECT * FROM review_items WHERE id = ? AND user_id = ? LIMIT 1',
    [itemId, userId],
  );
  return rows[0] ?? null;
}

/** Words that keep slipping: the raw material for the "forgotten" insight. */
export async function listLapsedWords(userId: number, limit = 10): Promise<LapsedWord[]> {
  const safeLimit = Math.max(1, Math.trunc(limit));
  const [rows] = await pool.execute<Array<RowDataPacket & LapsedWord>>(
    `SELECT ri.ref_id AS word_id, bw.word_en AS word, ri.lapses
       FROM review_items ri
       JOIN battle_words bw ON bw.id = ri.ref_id
      WHERE ri.user_id = ? AND ri.kind = 'word' AND ri.lapses > 0
      ORDER BY ri.lapses DESC, ri.mistake_count DESC
      LIMIT ${safeLimit}`,
    [userId],
  );
  return rows.map((row) => ({
    word_id: Number(row.word_id),
    word: row.word,
    lapses: Number(row.lapses),
  }));
}

export async function getCorrectAnswer(questionId: number): Promise<CorrectAnswerRow | null> {
  const [rows] = await pool.execute<CorrectAnswerRow[]>(
    'SELECT id, question_id, answer_text FROM answers WHERE question_id = ? AND is_correct = 1 LIMIT 1',
    [questionId],
  );
  return rows[0] ?? null;
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Add or refresh an item in the queue. Re-adding an existing item does not
 * reset its schedule: a learner who keeps missing the same word should not be
 * sent back to "new" every time, so only the mistake counter grows and the item
 * becomes due immediately.
 */
export async function enqueue(
  userId: number,
  kind: ReviewKind,
  refId: number,
  source: ReviewSource,
): Promise<void> {
  const now = new Date();
  await pool.execute(
    `INSERT INTO review_items
       (user_id, kind, ref_id, source, ease, interval_days, repetitions, lapses,
        mistake_count, due_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, 0, 1, ?)
     ON DUPLICATE KEY UPDATE
       mistake_count = mistake_count + 1,
       due_at = LEAST(due_at, ?),
       source = VALUES(source)`,
    [userId, kind, refId, source, initialState(now).ease, now, now],
  );
}

/** Promote missed Word Battle words, ignoring rounds that were never answered. */
export async function enqueueBattleMistakes(
  entries: Array<{ userId: number; wordId: number; isCorrect: boolean }>,
): Promise<void> {
  const missed = entries.filter((entry) => !entry.isCorrect && entry.wordId > 0);
  if (missed.length === 0) return;
  const now = new Date();
  const ease = initialState(now).ease;
  const values = missed.map(() => '(?, ?, ?, ?, ?, 0, 0, 0, 1, ?)').join(', ');
  const params: Array<string | number | Date> = [];
  for (const entry of missed) {
    params.push(entry.userId, 'word', entry.wordId, 'battle', ease, now);
  }
  await pool.execute(
    `INSERT INTO review_items
       (user_id, kind, ref_id, source, ease, interval_days, repetitions, lapses,
        mistake_count, due_at)
     VALUES ${values}
     ON DUPLICATE KEY UPDATE
       mistake_count = mistake_count + 1,
       due_at = LEAST(due_at, VALUES(due_at))`,
    params,
  );
}

/**
 * Backfill the queue from history that already exists.
 *
 * Without this an existing learner opens the review tab to an empty page even
 * though they have months of mistakes. Both sources are capped: the queue is a
 * practice aid, not an archive, and an unbounded backfill would bury the
 * freshest mistakes under old ones.
 */
export async function syncHistoricalMistakes(userId: number, limit = 40): Promise<number> {
  const safeLimit = Math.max(1, Math.trunc(limit));

  const [questionRows] = await pool.execute<Array<RowDataPacket & { question_id: number; wrong: number }>>(
    `SELECT a.question_id, COUNT(*) AS wrong
       FROM learning_answer_attempts a
      WHERE a.user_id = ? AND a.is_correct = 0
      GROUP BY a.question_id
      ORDER BY wrong DESC, MAX(a.created_at) DESC
      LIMIT ${safeLimit}`,
    [userId],
  );

  const [wordRows] = await pool.execute<Array<RowDataPacket & { word_id: number; wrong: number }>>(
    `SELECT ma.word_id, COUNT(*) AS wrong
       FROM match_answers ma
      WHERE ma.user_id = ? AND ma.is_correct = 0 AND ma.word_id IS NOT NULL
      GROUP BY ma.word_id
      ORDER BY wrong DESC, MAX(ma.answered_at) DESC
      LIMIT ${safeLimit}`,
    [userId],
  );

  const now = new Date();
  const ease = initialState(now).ease;
  const rows: Array<[number, ReviewKind, number, ReviewSource, number, number]> = [
    ...questionRows.map((row): [number, ReviewKind, number, ReviewSource, number, number] => [
      userId, 'question', Number(row.question_id), 'mistake', ease, Number(row.wrong),
    ]),
    ...wordRows.map((row): [number, ReviewKind, number, ReviewSource, number, number] => [
      userId, 'word', Number(row.word_id), 'battle', ease, Number(row.wrong),
    ]),
  ];
  if (rows.length === 0) return 0;

  const values = rows.map(() => '(?, ?, ?, ?, ?, 0, 0, 0, ?, ?)').join(', ');
  const params: Array<string | number | Date> = [];
  for (const [owner, kind, refId, source, baseEase, mistakes] of rows) {
    params.push(owner, kind, refId, source, baseEase, mistakes, now);
  }
  await pool.execute(
    `INSERT INTO review_items
       (user_id, kind, ref_id, source, ease, interval_days, repetitions, lapses,
        mistake_count, due_at)
     VALUES ${values}
     ON DUPLICATE KEY UPDATE
       mistake_count = GREATEST(mistake_count, VALUES(mistake_count)),
       due_at = LEAST(due_at, VALUES(due_at))`,
    params,
  );
  return rows.length;
}

export async function recordGrade(
  itemId: number,
  grade: ReviewGrade,
  responseMs: number | null,
): Promise<ReviewState & { dueAt: Date }> {
  const [rows] = await pool.execute<ReviewRow[]>(
    'SELECT * FROM review_items WHERE id = ? LIMIT 1',
    [itemId],
  );
  const row = rows[0];
  if (!row) throw new Error('Review item not found.');
  const next = schedule(toState(row), grade, new Date());
  await pool.execute<ResultSetHeader>(
    `UPDATE review_items
        SET ease = ?, interval_days = ?, repetitions = ?, lapses = ?,
            due_at = ?, last_reviewed_at = NOW(), last_grade = ?
      WHERE id = ?`,
    [next.ease, next.intervalDays, next.repetitions, next.lapses, next.dueAt, grade, itemId],
  );
  void responseMs;
  return next;
}

/** Keeps the word's IPA in sync when the learner saved it from a video. */
export async function getSavedWordIpa(userId: number, word: string): Promise<string | null> {
  const [rows] = await pool.execute<Array<RowDataPacket & { ipa: string | null }>>(
    'SELECT ipa FROM saved_words WHERE user_id = ? AND word = ? LIMIT 1',
    [userId, word],
  );
  return rows[0]?.ipa ?? null;
}
