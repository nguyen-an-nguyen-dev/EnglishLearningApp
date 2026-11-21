import type { RowDataPacket } from 'mysql2';
import { pool } from '../../db/pool';
import type {
  BehaviorStats,
  CompetitionStats,
  ContentFlag,
  ExerciseStat,
  LessonStat,
  QuestionStat,
  Totals,
  VocabularyStat,
} from './analytics.types';

const DAY_WINDOW = 30;

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ratio(correct: number, attempts: number): number | null {
  return attempts > 0 ? correct / attempts : null;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function lastDays(count: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    days.push(dayKey(date));
  }
  return days;
}

// ─── Behaviour ────────────────────────────────────────────────────────────────

interface DailyAnswerRow extends RowDataPacket {
  day: string;
  answers: number;
  correct: number;
}

interface DailySecondsRow extends RowDataPacket {
  day: string;
  seconds: number;
}

interface StreakRow extends RowDataPacket {
  streak: number;
  active_days: number;
}

interface WindowAccuracyRow extends RowDataPacket {
  attempts: number;
  correct: number;
}

/**
 * Daily activity, accuracy trend and study time. `minutes` combines lesson
 * practice seconds with watched video seconds; both are cumulative per lesson
 * or video, so they are attributed to the day the row last changed. That is an
 * approximation, but it is the only per-day signal the schema stores.
 */
export async function getBehavior(userId: number): Promise<BehaviorStats> {
  const [streakRows] = await pool.execute<StreakRow[]>(
    `SELECT u.streak,
            (SELECT COUNT(DISTINCT d) FROM (
               SELECT DATE(created_at) AS d FROM activity_events
                WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL ${DAY_WINDOW - 1} DAY)
               UNION
               SELECT DATE(created_at) FROM learning_answer_attempts
                WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL ${DAY_WINDOW - 1} DAY)
               UNION
               SELECT DATE(updated_at) FROM video_progress
                WHERE user_id = ? AND updated_at >= DATE_SUB(CURDATE(), INTERVAL ${DAY_WINDOW - 1} DAY)
             ) active) AS active_days
       FROM users u WHERE u.id = ? LIMIT 1`,
    [userId, userId, userId, userId],
  );

  const [answerRows] = await pool.execute<DailyAnswerRow[]>(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day,
            COUNT(*) AS answers,
            COALESCE(SUM(is_correct = 1), 0) AS correct
       FROM learning_answer_attempts
      WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL ${DAY_WINDOW - 1} DAY)
      GROUP BY day`,
    [userId],
  );

  const [lessonSeconds] = await pool.execute<DailySecondsRow[]>(
    `SELECT DATE_FORMAT(completed_at, '%Y-%m-%d') AS day,
            COALESCE(SUM(practice_seconds), 0) AS seconds
       FROM progress
      WHERE user_id = ? AND completed_at IS NOT NULL
        AND completed_at >= DATE_SUB(CURDATE(), INTERVAL ${DAY_WINDOW - 1} DAY)
      GROUP BY day`,
    [userId],
  );

  const [videoSeconds] = await pool.execute<DailySecondsRow[]>(
    `SELECT DATE_FORMAT(updated_at, '%Y-%m-%d') AS day,
            COALESCE(SUM(watched_seconds), 0) AS seconds
       FROM video_progress
      WHERE user_id = ? AND updated_at >= DATE_SUB(CURDATE(), INTERVAL ${DAY_WINDOW - 1} DAY)
      GROUP BY day`,
    [userId],
  );

  const [currentWindow] = await pool.execute<WindowAccuracyRow[]>(
    `SELECT COUNT(*) AS attempts, COALESCE(SUM(is_correct = 1), 0) AS correct
       FROM learning_answer_attempts
      WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL ${DAY_WINDOW - 1} DAY)`,
    [userId],
  );

  // The window before the current one, so a trend is a real comparison rather
  // than a single snapshot dressed up as progress.
  const [previousWindow] = await pool.execute<WindowAccuracyRow[]>(
    `SELECT COUNT(*) AS attempts, COALESCE(SUM(is_correct = 1), 0) AS correct
       FROM learning_answer_attempts
      WHERE user_id = ?
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL ${DAY_WINDOW * 2 - 1} DAY)
        AND created_at < DATE_SUB(CURDATE(), INTERVAL ${DAY_WINDOW - 1} DAY)`,
    [userId],
  );

  const answersByDay = new Map(answerRows.map((row) => [row.day, row]));
  const secondsByDay = new Map<string, number>();
  for (const row of [...lessonSeconds, ...videoSeconds]) {
    secondsByDay.set(row.day, (secondsByDay.get(row.day) ?? 0) + num(row.seconds));
  }

  const daily = lastDays(DAY_WINDOW).map((date) => {
    const answers = answersByDay.get(date);
    return {
      date,
      answers: num(answers?.answers),
      correct: num(answers?.correct),
      minutes: Math.round((secondsByDay.get(date) ?? 0) / 60),
    };
  });

  const attempts = num(currentWindow[0]?.attempts);
  const correct = num(currentWindow[0]?.correct);
  const previousAttempts = num(previousWindow[0]?.attempts);
  const previousCorrect = num(previousWindow[0]?.correct);

  return {
    streak: num(streakRows[0]?.streak),
    active_days_30: num(streakRows[0]?.active_days),
    answers_30: attempts,
    accuracy_30: ratio(correct, attempts),
    accuracy_prev_30: ratio(previousCorrect, previousAttempts),
    study_minutes_30: daily.reduce((total, entry) => total + entry.minutes, 0),
    daily,
  };
}

// ─── Totals ───────────────────────────────────────────────────────────────────

interface TotalsRow extends RowDataPacket {
  lessons_completed: number;
  lessons_started: number;
  videos_completed: number;
  duels_played: number;
  duels_won: number;
  saved_words: number;
  answers_total: number;
}

export async function getTotals(userId: number): Promise<Totals> {
  const [rows] = await pool.execute<TotalsRow[]>(
    `SELECT
       (SELECT COUNT(*) FROM progress WHERE user_id = ? AND status = 'completed' AND score = 100) AS lessons_completed,
       (SELECT COUNT(*) FROM progress WHERE user_id = ?) AS lessons_started,
       (SELECT COUNT(*) FROM video_progress WHERE user_id = ? AND completed = 1) AS videos_completed,
       (SELECT COUNT(*) FROM matches WHERE (player_one_id = ? OR player_two_id = ?) AND status = 'completed') AS duels_played,
       (SELECT COUNT(*) FROM matches WHERE winner_user_id = ?) AS duels_won,
       (SELECT COUNT(*) FROM saved_words WHERE user_id = ?) AS saved_words,
       (SELECT COUNT(*) FROM learning_answer_attempts WHERE user_id = ?) AS answers_total`,
    [userId, userId, userId, userId, userId, userId, userId, userId],
  );
  const row = rows[0];
  return {
    lessons_completed: num(row?.lessons_completed),
    lessons_started: num(row?.lessons_started),
    videos_completed: num(row?.videos_completed),
    duels_played: num(row?.duels_played),
    duels_won: num(row?.duels_won),
    saved_words: num(row?.saved_words),
    answers_total: num(row?.answers_total),
  };
}

// ─── Vocabulary (Word Battle) ─────────────────────────────────────────────────

interface VocabularyRow extends RowDataPacket {
  word_id: number;
  word: string;
  translation: string;
  ipa: string | null;
  part_of_speech: string;
  cefr_level: string;
  attempts: number;
  correct: number;
  avg_response_ms: number | null;
  last_seen: string | null;
  saved: number;
  review_due_at: string | null;
  review_repetitions: number | null;
}

/**
 * A word only becomes measurable once something links an answer to
 * `battle_words`. Word Battle now stores that link; before it existed only the
 * typed text survived, so history starts at the first match after the upgrade.
 */
export async function getVocabulary(userId: number, limit = 40): Promise<VocabularyStat[]> {
  const safeLimit = Math.max(1, Math.trunc(limit));
  // MySQL will not accept an aggregate alias in ORDER BY at the same level, so
  // the grouped result is wrapped and sorted outside.
  const [rows] = await pool.execute<VocabularyRow[]>(
    `SELECT * FROM (
       SELECT bw.id AS word_id, bw.word_en AS word, bw.translation_vi AS translation,
              MAX(sw.ipa) AS ipa,
              bw.part_of_speech, bw.cefr_level,
              COUNT(ma.id) AS attempts,
              COALESCE(SUM(ma.is_correct = 1), 0) AS correct,
              AVG(ma.response_time_ms) AS avg_response_ms,
              MAX(ma.answered_at) AS last_seen,
              MAX(sw.id IS NOT NULL) AS saved,
              MAX(ri.due_at) AS review_due_at,
              MAX(ri.repetitions) AS review_repetitions
         FROM battle_words bw
         LEFT JOIN match_answers ma ON ma.word_id = bw.id AND ma.user_id = ?
         LEFT JOIN saved_words sw ON sw.user_id = ? AND sw.word = bw.word_en
         LEFT JOIN review_items ri ON ri.user_id = ? AND ri.kind = 'word' AND ri.ref_id = bw.id
        GROUP BY bw.id, bw.word_en, bw.translation_vi, bw.part_of_speech, bw.cefr_level
       HAVING attempts > 0 OR saved = 1 OR review_due_at IS NOT NULL
     ) ranked
      ORDER BY (attempts = 0) ASC, (correct / NULLIF(attempts, 0)) ASC, attempts DESC
      LIMIT ${safeLimit}`,
    [userId, userId, userId],
  );

  return rows.map((row) => {
    const attempts = num(row.attempts);
    const correct = num(row.correct);
    return {
      word_id: num(row.word_id),
      word: row.word,
      translation: row.translation,
      ipa: row.ipa ?? null,
      part_of_speech: row.part_of_speech,
      cefr_level: row.cefr_level,
      attempts,
      correct,
      accuracy: ratio(correct, attempts) ?? 0,
      avg_response_ms: row.avg_response_ms === null ? null : Math.round(num(row.avg_response_ms)),
      last_seen: toIso(row.last_seen),
      saved: num(row.saved) === 1,
      review_due_at: toIso(row.review_due_at),
      review_repetitions: row.review_repetitions === null ? null : num(row.review_repetitions),
    };
  });
}

// ─── Questions ────────────────────────────────────────────────────────────────

interface QuestionRow extends RowDataPacket {
  question_id: number;
  prompt: string;
  question_type: string;
  difficulty: string;
  lesson_id: number;
  lesson_title: string;
  topic: string;
  attempts: number;
  correct: number;
  avg_response_ms: number | null;
}

interface DistractorRow extends RowDataPacket {
  question_id: number;
  answer: string;
  times: number;
}

export async function getQuestionStats(userId: number, limit = 20): Promise<QuestionStat[]> {
  const safeLimit = Math.max(1, Math.trunc(limit));
  const [rows] = await pool.execute<QuestionRow[]>(
    `SELECT q.id AS question_id, q.question_text AS prompt, q.question_type, q.difficulty,
            q.lesson_id, l.title AS lesson_title, l.topic,
            COUNT(a.id) AS attempts,
            COALESCE(SUM(a.is_correct = 1), 0) AS correct,
            AVG(a.response_time_ms) AS avg_response_ms
       FROM learning_answer_attempts a
       JOIN questions q ON q.id = a.question_id
       JOIN lessons l ON l.id = q.lesson_id
      WHERE a.user_id = ?
      GROUP BY q.id, q.question_text, q.question_type, q.difficulty, q.lesson_id, l.title, l.topic
      ORDER BY (SUM(a.is_correct = 1) / COUNT(a.id)) ASC, COUNT(a.id) DESC
      LIMIT ${safeLimit}`,
    [userId],
  );

  if (rows.length === 0) return [];

  const ids = rows.map((row) => num(row.question_id));
  const placeholders = ids.map(() => '?').join(', ');
  // MCQ answers are stored as the option id, so the distractor text has to be
  // resolved through `answers`; typed answers are already readable.
  const [distractors] = await pool.execute<DistractorRow[]>(
    `SELECT a.question_id,
            COALESCE(ans.answer_text, a.submitted_answer) AS answer,
            COUNT(*) AS times
       FROM learning_answer_attempts a
       LEFT JOIN answers ans
         ON ans.question_id = a.question_id
        AND ans.id = CAST(a.submitted_answer AS UNSIGNED)
      WHERE a.user_id = ? AND a.is_correct = 0 AND a.question_id IN (${placeholders})
      GROUP BY a.question_id, answer
      ORDER BY times DESC`,
    [userId, ...ids],
  );

  const byQuestion = new Map<number, Array<{ answer: string; times: number }>>();
  for (const row of distractors) {
    const key = num(row.question_id);
    const list = byQuestion.get(key) ?? [];
    if (list.length < 3 && row.answer.trim().length > 0) {
      list.push({ answer: row.answer, times: num(row.times) });
    }
    byQuestion.set(key, list);
  }

  return rows.map((row) => {
    const attempts = num(row.attempts);
    const correct = num(row.correct);
    return {
      question_id: num(row.question_id),
      prompt: row.prompt,
      question_type: row.question_type,
      difficulty: row.difficulty,
      lesson_id: num(row.lesson_id),
      lesson_title: row.lesson_title,
      topic: row.topic,
      attempts,
      correct,
      accuracy: ratio(correct, attempts) ?? 0,
      avg_response_ms: row.avg_response_ms === null ? null : Math.round(num(row.avg_response_ms)),
      wrong_answers: byQuestion.get(num(row.question_id)) ?? [],
    };
  });
}

// ─── Exercises ────────────────────────────────────────────────────────────────

interface ExerciseRow extends RowDataPacket {
  question_type: string;
  attempts: number;
  correct: number;
  avg_response_ms: number | null;
}

export async function getExerciseStats(userId: number): Promise<ExerciseStat[]> {
  const [rows] = await pool.execute<ExerciseRow[]>(
    `SELECT q.question_type,
            COUNT(a.id) AS attempts,
            COALESCE(SUM(a.is_correct = 1), 0) AS correct,
            AVG(a.response_time_ms) AS avg_response_ms
       FROM learning_answer_attempts a
       JOIN questions q ON q.id = a.question_id
      WHERE a.user_id = ?
      GROUP BY q.question_type
      ORDER BY attempts DESC`,
    [userId],
  );

  return rows.map((row) => {
    const attempts = num(row.attempts);
    const correct = num(row.correct);
    return {
      question_type: row.question_type,
      attempts,
      correct,
      accuracy: ratio(correct, attempts) ?? 0,
      avg_response_ms: row.avg_response_ms === null ? null : Math.round(num(row.avg_response_ms)),
    };
  });
}

// ─── Lessons ──────────────────────────────────────────────────────────────────

interface LessonRow extends RowDataPacket {
  lesson_id: number;
  title: string;
  topic: string;
  stage_title: string;
  total_questions: number;
  answered_questions: number;
  status: string | null;
  score: number | null;
  attempts: number | null;
  practice_seconds: number | null;
  answers: number;
  correct: number;
}

export async function getLessonStats(userId: number): Promise<LessonStat[]> {
  const [rows] = await pool.execute<LessonRow[]>(
    `SELECT l.id AS lesson_id, l.title, l.topic, s.title AS stage_title,
            (SELECT COUNT(*) FROM questions q WHERE q.lesson_id = l.id) AS total_questions,
            (SELECT COUNT(DISTINCT a.question_id)
               FROM learning_answer_attempts a
               JOIN questions q2 ON q2.id = a.question_id
              WHERE q2.lesson_id = l.id AND a.user_id = ?) AS answered_questions,
            p.status, p.score, p.attempts, p.practice_seconds,
            (SELECT COUNT(*)
               FROM learning_answer_attempts a2
               JOIN questions q3 ON q3.id = a2.question_id
              WHERE q3.lesson_id = l.id AND a2.user_id = ?) AS answers,
            (SELECT COALESCE(SUM(a3.is_correct = 1), 0)
               FROM learning_answer_attempts a3
               JOIN questions q4 ON q4.id = a3.question_id
              WHERE q4.lesson_id = l.id AND a3.user_id = ?) AS correct
       FROM lessons l
       JOIN stages s ON s.id = l.stage_id
       LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = ?
      ORDER BY s.sort_order ASC, l.sort_order ASC`,
    [userId, userId, userId, userId],
  );

  return rows.map((row) => {
    const answers = num(row.answers);
    const correct = num(row.correct);
    const status = (row.status ?? 'not_started') as LessonStat['status'];
    return {
      lesson_id: num(row.lesson_id),
      title: row.title,
      topic: row.topic,
      stage_title: row.stage_title,
      total_questions: num(row.total_questions),
      answered_questions: num(row.answered_questions),
      status,
      score: row.score === null ? null : num(row.score),
      attempts: num(row.attempts),
      practice_seconds: row.practice_seconds === null ? null : num(row.practice_seconds),
      accuracy: ratio(correct, answers),
      // Opened and answered, but never finished: the lesson was abandoned, not
      // merely untouched.
      abandoned: status !== 'completed' && num(row.answered_questions) > 0,
    };
  });
}

// ─── Competition ──────────────────────────────────────────────────────────────

interface CompetitionRow extends RowDataPacket {
  matches: number;
  wins: number;
  answers: number;
  correct: number;
  avg_response_ms: number | null;
}

export async function getCompetition(userId: number): Promise<CompetitionStats> {
  const [rows] = await pool.execute<CompetitionRow[]>(
    `SELECT
       (SELECT COUNT(*) FROM matches
         WHERE (player_one_id = ? OR player_two_id = ?) AND status = 'completed') AS matches,
       (SELECT COUNT(*) FROM matches WHERE winner_user_id = ?) AS wins,
       COUNT(ma.id) AS answers,
       COALESCE(SUM(ma.is_correct = 1), 0) AS correct,
       AVG(ma.response_time_ms) AS avg_response_ms
       FROM match_answers ma
      WHERE ma.user_id = ?`,
    [userId, userId, userId, userId],
  );
  const row = rows[0];
  const answers = num(row?.answers);
  const correct = num(row?.correct);
  return {
    matches: num(row?.matches),
    wins: num(row?.wins),
    answers,
    correct,
    accuracy: ratio(correct, answers),
    avg_response_ms: row?.avg_response_ms === null || row?.avg_response_ms === undefined
      ? null
      : Math.round(num(row.avg_response_ms)),
  };
}

// ─── Content health ───────────────────────────────────────────────────────────

interface ContentRow extends RowDataPacket {
  question_id: number;
  prompt: string;
  lesson_title: string;
  correct_answers: number;
  answer_count: number;
  attempts: number;
  correct: number;
}

/**
 * Questions that look broken rather than hard. These are separated from learner
 * mistakes on purpose: a question with no correct option, two correct options,
 * or a near-zero accuracy across many learners is a content bug, not a gap in
 * one learner's knowledge.
 */
export async function getContentFlags(limit = 12): Promise<ContentFlag[]> {
  const safeLimit = Math.max(1, Math.trunc(limit));
  const [rows] = await pool.execute<ContentRow[]>(
    `SELECT q.id AS question_id, q.question_text AS prompt, l.title AS lesson_title,
            (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id AND a.is_correct = 1) AS correct_answers,
            (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id) AS answer_count,
            (SELECT COUNT(*) FROM learning_answer_attempts x WHERE x.question_id = q.id) AS attempts,
            (SELECT COUNT(*) FROM learning_answer_attempts x
              WHERE x.question_id = q.id AND x.is_correct = 1) AS correct
       FROM questions q
       JOIN lessons l ON l.id = q.lesson_id
      WHERE (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id AND a.is_correct = 1) <> 1
         OR (SELECT COUNT(*) FROM learning_answer_attempts x WHERE x.question_id = q.id) >= 10
      ORDER BY attempts DESC
      LIMIT ${safeLimit}`,
    [],
  );

  const flags: ContentFlag[] = [];
  for (const row of rows) {
    const attempts = num(row.attempts);
    const correct = num(row.correct);
    const correctAnswers = num(row.correct_answers);
    let kind: ContentFlag['kind'] | null = null;
    if (correctAnswers === 0) kind = 'no_correct_answer';
    else if (correctAnswers > 1) kind = 'multiple_correct_answers';
    else if (attempts >= 10 && correct / attempts <= 0.2) kind = 'too_many_learners_wrong';
    if (!kind) continue;
    flags.push({
      question_id: num(row.question_id),
      prompt: row.prompt,
      lesson_title: row.lesson_title,
      kind,
      attempts,
      correct,
      accuracy: ratio(correct, attempts),
    });
  }
  return flags;
}
