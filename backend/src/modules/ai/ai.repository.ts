import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../db/pool';
import { HttpError } from '../../middleware/error-handler';
import type {
  AiFeedbackInput,
  AiTopic,
  ChatRow,
  FeedbackRow,
  LearnerContext,
  MessageRow,
} from './ai.types';

interface ChatDbRow extends ChatRow, RowDataPacket {}
interface MessageDbRow extends MessageRow, RowDataPacket {}
interface FeedbackDbRow extends FeedbackRow, RowDataPacket {}

export interface VideoCatalogEntry {
  id: number;
  title: string;
  topic: string;
  level: string;
}

export interface StudyStats {
  totalLessons: number;
  completedLessons: number;
  completedLessonIds: number[];
  lessons: Array<{ id: number; title: string; topic: string; stageTitle: string }>;
  /** Every video in the catalogue, so the buddy can deep-link to a real one. */
  videoCatalog: VideoCatalogEntry[];
  videosTotal: number;
  videosCompleted: number;
  nextVideo: { id: number; title: string } | null;
  savedWords: number;
  translations: number;
  battlesPlayed: number;
  battleWins: number;
  badges: number;
  xp: number;
  streak: number;
  /** Videos the learner imported themselves (owner_user_id), not the shared library. */
  ownedVideos: number;
  ownedVideoTitles: string[];
}

interface CountDbRow extends RowDataPacket {
  total_lessons: number;
  completed_lessons: number;
  videos_total: number;
  videos_completed: number;
  saved_words: number;
  translations: number;
  battles_played: number;
  battle_wins: number;
  badges: number;
  xp: number;
  streak: number;
}
interface LessonDbRow extends RowDataPacket {
  id: number;
  title: string;
  topic: string;
  stage_title: string;
}
interface IdDbRow extends RowDataPacket { id: number; }
interface VideoDbRow extends RowDataPacket { id: number; title: string; }
interface VideoCatalogDbRow extends RowDataPacket { id: number; title: string; topic: string; level: string; }
interface CountOnlyRow extends RowDataPacket { n: number; }

/** Everything the study plan needs, in four round trips. */
export async function getStudyStats(userId: number): Promise<StudyStats> {
  const [countRows, lessonRows, completedRows, videoRows, ownedCountRows, ownedRows, catalogRows] = await Promise.all([
    pool.execute<CountDbRow[]>(
      `SELECT
         (SELECT COUNT(*) FROM lessons) AS total_lessons,
         (SELECT COUNT(*) FROM progress WHERE user_id = ? AND status = 'completed' AND score = 100) AS completed_lessons,
         (SELECT COUNT(*) FROM video_lessons) AS videos_total,
         (SELECT COUNT(*) FROM video_progress WHERE user_id = ? AND completed = 1) AS videos_completed,
         (SELECT COUNT(*) FROM saved_words WHERE user_id = ?) AS saved_words,
         (SELECT COUNT(*) FROM translations WHERE user_id = ?) AS translations,
         (SELECT COUNT(*) FROM matches WHERE status = 'completed' AND (player_one_id = ? OR player_two_id = ?)) AS battles_played,
         (SELECT COUNT(*) FROM matches WHERE status = 'completed' AND winner_user_id = ?) AS battle_wins,
         (SELECT COUNT(*) FROM user_badges WHERE user_id = ?) AS badges,
         (SELECT xp FROM users WHERE id = ?) AS xp,
         (SELECT streak FROM users WHERE id = ?) AS streak`,
      [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId],
    ),
    pool.execute<LessonDbRow[]>(
      `SELECT l.id, l.title, l.topic, s.title AS stage_title
       FROM lessons l JOIN stages s ON s.id = l.stage_id
       ORDER BY s.sort_order, l.sort_order, l.id`,
    ),
    pool.execute<IdDbRow[]>(
      "SELECT lesson_id AS id FROM progress WHERE user_id = ? AND status = 'completed' AND score = 100",
      [userId],
    ),
    pool.execute<VideoDbRow[]>(
      `SELECT v.id, v.title FROM video_lessons v
       WHERE v.id NOT IN (SELECT video_id FROM video_progress WHERE user_id = ? AND completed = 1)
       ORDER BY v.sort_order, v.id LIMIT 1`,
      [userId],
    ),
    pool.execute<CountOnlyRow[]>(
      'SELECT COUNT(*) AS n FROM video_lessons WHERE owner_user_id = ?',
      [userId],
    ),
    pool.execute<VideoDbRow[]>(
      'SELECT id, title FROM video_lessons WHERE owner_user_id = ? ORDER BY created_at DESC, id DESC LIMIT 6',
      [userId],
    ),
    pool.execute<VideoCatalogDbRow[]>(
      'SELECT id, title, topic, cefr_level AS level FROM video_lessons ORDER BY sort_order, id',
    ),
  ]);

  const counts: CountDbRow | undefined = countRows[0][0];
  const lessonList = lessonRows[0];
  const completedList = completedRows[0];
  const videoList = videoRows[0];
  const ownedList = ownedRows[0];
  const catalogList = catalogRows[0];
  const num = (value: unknown): number => Number(value ?? 0);
  return {
    totalLessons: num(counts?.total_lessons),
    completedLessons: num(counts?.completed_lessons),
    completedLessonIds: completedList.map((row) => row.id),
    videoCatalog: catalogList.map((row) => ({
      id: row.id,
      title: row.title,
      topic: row.topic,
      level: row.level,
    })),
    lessons: lessonList.map((row) => ({
      id: row.id,
      title: row.title,
      topic: row.topic,
      stageTitle: row.stage_title,
    })),
    videosTotal: num(counts?.videos_total),
    videosCompleted: num(counts?.videos_completed),
    nextVideo: videoList[0] ? { id: videoList[0].id, title: videoList[0].title } : null,
    savedWords: num(counts?.saved_words),
    translations: num(counts?.translations),
    battlesPlayed: num(counts?.battles_played),
    battleWins: num(counts?.battle_wins),
    badges: num(counts?.badges),
    xp: num(counts?.xp),
    streak: num(counts?.streak),
    ownedVideos: num(ownedCountRows[0][0]?.n),
    ownedVideoTitles: ownedList.map((row) => row.title),
  };
}

export async function listChats(userId: number): Promise<ChatRow[]> {
  const [rows] = await pool.execute<ChatDbRow[]>(
    `SELECT c.id, c.topic, c.title, c.created_at, c.updated_at,
            (SELECT m.content FROM messages m WHERE m.chat_id = c.id
             ORDER BY m.id DESC LIMIT 1) AS last_message
     FROM chats c
     WHERE c.user_id = ?
     ORDER BY c.updated_at DESC, c.id DESC`,
    [userId],
  );
  return rows;
}

export async function createChat(userId: number, topic: AiTopic): Promise<ChatRow> {
  const initialTitle = topic === 'STUDY_COACH' ? 'En Buddy' : topic;
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO chats (user_id, topic, title) VALUES (?, ?, ?)',
    [userId, topic, initialTitle],
  );
  const [rows] = await pool.execute<ChatDbRow[]>(
    `SELECT id, topic, title, created_at, updated_at, NULL AS last_message
     FROM chats WHERE id = ? AND user_id = ? LIMIT 1`,
    [result.insertId, userId],
  );
  if (!rows[0]) throw new Error('Created AI chat could not be loaded.');
  return rows[0];
}

export async function getChat(userId: number, chatId: number): Promise<ChatRow | undefined> {
  const [rows] = await pool.execute<ChatDbRow[]>(
    `SELECT c.id, c.topic, c.title, c.created_at, c.updated_at,
            (SELECT m.content FROM messages m WHERE m.chat_id = c.id
             ORDER BY m.id DESC LIMIT 1) AS last_message
     FROM chats c WHERE c.id = ? AND c.user_id = ? LIMIT 1`,
    [chatId, userId],
  );
  return rows[0];
}

/**
 * The companion UI has no visible chat thread, but every question is still
 * stored so the buddy remembers what was already asked. One long-lived
 * STUDY_COACH chat per learner keeps that history in one place.
 */
export async function ensureCoachChat(userId: number): Promise<number> {
  const [rows] = await pool.execute<IdDbRow[]>(
    `SELECT id FROM chats WHERE user_id = ? AND topic = 'STUDY_COACH' ORDER BY id ASC LIMIT 1`,
    [userId],
  );
  if (rows[0]) return rows[0].id;

  try {
    const chat = await createChat(userId, 'STUDY_COACH');
    return chat.id;
  } catch (error) {
    // A parallel first question can win the race; reuse whatever exists then.
    const [again] = await pool.execute<IdDbRow[]>(
      `SELECT id FROM chats WHERE user_id = ? AND topic = 'STUDY_COACH' ORDER BY id ASC LIMIT 1`,
      [userId],
    );
    if (again[0]) return again[0].id;
    throw error;
  }
}

export async function deleteChat(userId: number, chatId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM chats WHERE id = ? AND user_id = ?',
    [chatId, userId],
  );
  return result.affectedRows > 0;
}

export async function getMessages(chatId: number): Promise<MessageRow[]> {
  const [rows] = await pool.execute<MessageDbRow[]>(
    `SELECT id, chat_id, role, content, created_at
     FROM messages WHERE chat_id = ? AND role <> 'SYSTEM' ORDER BY id ASC`,
    [chatId],
  );
  return rows;
}

export async function getConversationHistory(chatId: number, limit = 20): Promise<MessageRow[]> {
  const [rows] = await pool.execute<MessageDbRow[]>(
    `SELECT id, chat_id, role, content, created_at
     FROM messages WHERE chat_id = ? AND role <> 'SYSTEM' ORDER BY id DESC LIMIT ?`,
    [chatId, limit],
  );
  return rows.reverse();
}

export async function getFeedback(userId: number, chatId: number): Promise<FeedbackRow[]> {
  const [rows] = await pool.execute<FeedbackDbRow[]>(
    `SELECT f.id, f.message_id, f.type, f.original_text, f.corrected_text,
            f.explanation, f.created_at
     FROM ai_feedback f
     JOIN messages m ON m.id = f.message_id
     JOIN chats c ON c.id = m.chat_id
     WHERE c.id = ? AND c.user_id = ? AND m.role = 'USER'
     ORDER BY f.id ASC`,
    [chatId, userId],
  );
  return rows;
}

export async function getLearnerContext(userId: number): Promise<LearnerContext> {
  interface TopicRow extends RowDataPacket { topic: string; }
  interface WeakTopicRow extends RowDataPacket { topic: string; mistakes: number; }
  interface MistakeRow extends RowDataPacket { topic: string; prompt: string; answer: string; }
  interface LevelRow extends RowDataPacket { level: LearnerContext['level'] | null; }

  const [completedRows] = await pool.execute<TopicRow[]>(
    `SELECT DISTINCT l.topic
     FROM progress p JOIN lessons l ON l.id = p.lesson_id
     WHERE p.user_id = ? AND p.status = 'completed'
     ORDER BY l.topic LIMIT 12`,
    [userId],
  );
  const [weakRows] = await pool.execute<WeakTopicRow[]>(
    `SELECT l.topic, COUNT(*) AS mistakes
     FROM learning_answer_attempts a
     JOIN questions q ON q.id = a.question_id
     JOIN lessons l ON l.id = q.lesson_id
     WHERE a.user_id = ? AND a.is_correct = FALSE
     GROUP BY l.topic ORDER BY mistakes DESC, l.topic LIMIT 5`,
    [userId],
  );
  const [mistakeRows] = await pool.execute<MistakeRow[]>(
    `SELECT l.topic, q.question_text AS prompt, a.submitted_answer AS answer
     FROM learning_answer_attempts a
     JOIN questions q ON q.id = a.question_id
     JOIN lessons l ON l.id = q.lesson_id
     WHERE a.user_id = ? AND a.is_correct = FALSE
     ORDER BY a.created_at DESC LIMIT 8`,
    [userId],
  );
  const [levelRows] = await pool.execute<LevelRow[]>(
    `SELECT CASE MAX(CASE q.difficulty
                       WHEN 'advanced' THEN 3 WHEN 'intermediate' THEN 2 ELSE 1 END)
              WHEN 3 THEN 'advanced' WHEN 2 THEN 'intermediate' ELSE 'beginner'
            END AS level
     FROM progress p
     JOIN lessons l ON l.id = p.lesson_id
     JOIN questions q ON q.lesson_id = l.id
     WHERE p.user_id = ? AND p.status = 'completed'`,
    [userId],
  );
  const [feedbackRows] = await pool.execute<FeedbackDbRow[]>(
    `SELECT f.id, f.message_id, f.type, f.original_text, f.corrected_text,
            f.explanation, f.created_at
     FROM ai_feedback f
     JOIN messages m ON m.id = f.message_id
     JOIN chats c ON c.id = m.chat_id
     WHERE c.user_id = ? AND m.role = 'USER'
     ORDER BY f.id DESC LIMIT 5`,
    [userId],
  );

  interface ReviewRow extends RowDataPacket { title: string; practice_seconds: number | null; attempts: number; }
  const [reviewRows] = await pool.execute<ReviewRow[]>(
    `SELECT l.title, p.practice_seconds, p.attempts
     FROM progress p JOIN lessons l ON l.id = p.lesson_id
     WHERE p.user_id = ? AND p.status = 'completed'
       AND (p.attempts > 1 OR p.practice_seconds >= 300)
     ORDER BY p.attempts DESC, p.practice_seconds DESC LIMIT 5`,
    [userId],
  );

  return {
    level: levelRows[0]?.level ?? 'beginner',
    completedTopics: completedRows.map((row) => row.topic),
    weakTopics: weakRows.map((row) => ({ topic: row.topic, mistakes: Number(row.mistakes) })),
    recentMistakes: mistakeRows,
    previousFeedback: feedbackRows.map(({ type, original_text, corrected_text, explanation }) => ({
      type,
      original_text,
      corrected_text,
      explanation,
    })).reverse(),
    reviewLessons: reviewRows.map((row) => ({
      title: row.title,
      practiceSeconds: Number(row.practice_seconds ?? 0),
      attempts: Number(row.attempts ?? 1),
    })),
  };
}

export async function saveConversation(
  userId: number,
  chatId: number,
  userText: string,
  aiText: string,
  feedback: AiFeedbackInput[],
): Promise<{ userMessage: MessageRow; aiMessage: MessageRow }> {
  const connection: PoolConnection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [chatRows] = await connection.execute<ChatDbRow[]>(
      'SELECT id, topic, title, created_at, updated_at, NULL AS last_message FROM chats WHERE id = ? AND user_id = ? FOR UPDATE',
      [chatId, userId],
    );
    const chat = chatRows[0];
    if (!chat) throw new HttpError(404, 'Chat not found.');

    const [userResult] = await connection.execute<ResultSetHeader>(
      "INSERT INTO messages (chat_id, role, content) VALUES (?, 'USER', ?)",
      [chatId, userText],
    );
    const [aiResult] = await connection.execute<ResultSetHeader>(
      "INSERT INTO messages (chat_id, role, content) VALUES (?, 'AI', ?)",
      [chatId, aiText],
    );
    for (const item of feedback) {
      await connection.execute(
        `INSERT INTO ai_feedback (message_id, type, original_text, corrected_text, explanation)
         VALUES (?, ?, ?, ?, ?)`,
        [userResult.insertId, item.type, item.original_text, item.corrected_text, item.explanation],
      );
    }

    const title = userText.length > 60 ? `${userText.slice(0, 57)}...` : userText;
    const initialTitle = chat.topic === 'STUDY_COACH' ? 'En Buddy' : chat.topic;
    await connection.execute(
      `UPDATE chats SET title = CASE WHEN title = ? THEN ? ELSE title END, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [initialTitle, title, chatId, userId],
    );
    await connection.commit();
    const now = new Date();
    return {
      userMessage: { id: userResult.insertId, chat_id: chatId, role: 'USER', content: userText, created_at: now },
      aiMessage: { id: aiResult.insertId, chat_id: chatId, role: 'AI', content: aiText, created_at: now },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
