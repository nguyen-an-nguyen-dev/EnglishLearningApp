import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../db/pool';
import { HttpError } from '../../middleware/error-handler';
import { VISIBLE_TO_USER_SQL } from '../video/video.repository';
import { isRecord } from '../../utils/validation';
import { parseChatAction } from './ai.parsing';
import type {
  CoachLearnerContext,
  AiFeedbackInput,
  AiTopic,
  ChatAction,
  ChatRow,
  CoachMessageRow,
  FeedbackRow,
  LearnerContext,
  MessageRow,
  StudyLearnerContext,
} from './ai.types';

interface ChatDbRow extends ChatRow, RowDataPacket {}
interface MessageDbRow extends MessageRow, RowDataPacket {}
interface CoachMessageDbRow extends Omit<MessageRow, 'role'>, RowDataPacket { role: 'USER' | 'AI' | 'SYSTEM' }
interface FeedbackDbRow extends FeedbackRow, RowDataPacket {}

const COACH_DESTINATIONS = 'engorace:buddy-destinations:v1\n';
const FIRST_COACH_CHAT = "SELECT id FROM chats WHERE user_id = ? AND topic = 'STUDY_COACH' ORDER BY id ASC LIMIT 1";

export interface VideoCatalogEntry {
  id: number;
  code?: string;
  title: string;
  topic: string;
  level: string;
  durationSeconds?: number;
  completed: boolean;
}

export interface StudyStats {
  totalLessons: number;
  completedLessons: number;
  completedLessonIds: number[];
  lessons: Array<{ id: number; title: string; topic: string; stageTitle: string }>;
  videoCatalog: VideoCatalogEntry[];
  ownedVideoCatalog?: VideoCatalogEntry[];
  lessonHistory?: LessonHistoryEntry[];
  daysSinceStudy?: number | null;
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
  reviewDue: number;
  reviewTotal: number;
  reviewWords: number;
  /** Videos the learner imported themselves (owner_user_id), not the shared library. */
  ownedVideos: number;
  ownedVideoTitles: string[];
}

interface LessonHistoryEntry {
  id: number;
  title: string;
  topic: string;
  status: 'in_progress' | 'completed';
  score: number | null;
  attempts: number;
  studiedAt: string;
}

interface CountDbRow extends RowDataPacket {
  days_since_study: number | null;
  total_lessons: number;
  completed_lessons: number;
  saved_words: number;
  translations: number;
  battles_played: number;
  battle_wins: number;
  badges: number;
  xp: number;
  streak: number;
  review_due: number;
  review_total: number;
  review_words: number;
}
interface LessonDbRow extends RowDataPacket {
  id: number;
  title: string;
  topic: string;
  stage_title: string;
}
interface IdDbRow extends RowDataPacket { id: number; }
interface VideoCatalogDbRow extends RowDataPacket {
  id: number; code: string; title: string; topic: string; level: string; duration_seconds: number; completed: number; is_owned: number;
}
interface LessonHistoryDbRow extends RowDataPacket {
  id: number; title: string; topic: string; status: LessonHistoryEntry['status'];
  score: string | null; attempts: number; studied_at: Date;
}

function toVideoEntry({ id, code, title, topic, level, duration_seconds, completed }: VideoCatalogDbRow): VideoCatalogEntry {
  return { id, code, title, topic, level, durationSeconds: duration_seconds, completed: Number(completed) === 1 };
}

async function readVideoCatalog(userId: number, scope: 'all' | 'private' | 'public'): Promise<VideoCatalogDbRow[]> {
  const library = scope === 'private' ? 'AND v.owner_user_id IS NOT NULL'
    : scope === 'public' ? 'AND v.owner_user_id IS NULL' : '';
  const [rows] = await pool.execute<VideoCatalogDbRow[]>(
    `SELECT v.id, v.code, v.title, v.topic, v.cefr_level AS level, v.duration_seconds, COALESCE(vp.completed, 0) AS completed,
            (v.owner_user_id IS NOT NULL) AS is_owned
     FROM video_lessons v
     LEFT JOIN video_progress vp ON vp.video_id = v.id AND vp.user_id = ?
     WHERE ${VISIBLE_TO_USER_SQL} ${library}
     ORDER BY is_owned, CASE WHEN v.owner_user_id IS NULL THEN v.sort_order END,
              CASE WHEN v.owner_user_id IS NOT NULL THEN v.created_at END DESC, v.id`,
    [userId, userId],
  );
  return rows;
}

export async function getBuddyVideoCatalog(userId: number, owned: boolean): Promise<VideoCatalogEntry[]> {
  return (await readVideoCatalog(userId, owned ? 'private' : 'public')).map(toVideoEntry);
}

export async function getVisibleVideoReference(userId: number, videoId: number): Promise<Pick<VideoCatalogEntry, 'id' | 'title'> | undefined> {
  const [rows] = await pool.execute<Array<RowDataPacket & Pick<VideoCatalogEntry, 'id' | 'title'>>>(
    `SELECT id, title FROM video_lessons WHERE id = ? AND ${VISIBLE_TO_USER_SQL} LIMIT 1`,
    [videoId, userId],
  );
  return rows[0];
}

export async function getBuddyVideoLibraries(userId: number) {
  const rows = await readVideoCatalog(userId, 'all');
  return {
    videoCatalog: rows.filter((row) => !Number(row.is_owned)).map(toVideoEntry),
    ownedVideoCatalog: rows.filter((row) => Number(row.is_owned)).map(toVideoEntry),
  };
}

export async function getStudyStats(userId: number, libraries = getBuddyVideoLibraries(userId)): Promise<StudyStats> {
  const [countRows, lessonRows, completedRows, videoLibraries, historyRows] = await Promise.all([
    pool.execute<CountDbRow[]>(
      `SELECT
         (SELECT COUNT(*) FROM lessons) AS total_lessons,
         (SELECT COUNT(*) FROM progress WHERE user_id = ? AND status = 'completed' AND score = 100) AS completed_lessons,
         (SELECT COUNT(*) FROM saved_words WHERE user_id = ?) AS saved_words,
         (SELECT COUNT(*) FROM translations WHERE user_id = ?) AS translations,
         (SELECT COUNT(*) FROM matches WHERE status = 'completed' AND (player_one_id = ? OR player_two_id = ?)) AS battles_played,
         (SELECT COUNT(*) FROM matches WHERE status = 'completed' AND winner_user_id = ?) AS battle_wins,
         (SELECT COUNT(*) FROM user_badges WHERE user_id = ?) AS badges,
         (SELECT xp FROM users WHERE id = ?) AS xp,
         (SELECT streak FROM users WHERE id = ?) AS streak,
         (SELECT COUNT(*) FROM review_items WHERE user_id = ? AND due_at <= NOW()) AS review_due,
         (SELECT COUNT(*) FROM review_items WHERE user_id = ?) AS review_total,
         (SELECT COUNT(*) FROM review_items WHERE user_id = ? AND kind = 'word') AS review_words,
         (SELECT TIMESTAMPDIFF(DAY, MAX(studied_at), NOW()) FROM (
            SELECT MAX(updated_at) AS studied_at FROM progress WHERE user_id = ? AND status <> 'not_started'
            UNION ALL SELECT MAX(created_at) FROM learning_answer_attempts WHERE user_id = ?
            UNION ALL SELECT MAX(updated_at) FROM video_progress WHERE user_id = ?
          ) AS activity) AS days_since_study`,
      [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId],
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
    libraries,
    pool.execute<LessonHistoryDbRow[]>(
      `SELECT l.id, l.title, l.topic, p.status, p.score, p.attempts, p.updated_at AS studied_at
       FROM progress p JOIN lessons l ON l.id = p.lesson_id
       WHERE p.user_id = ? AND p.status <> 'not_started'
       ORDER BY p.updated_at DESC, p.id DESC`,
      [userId],
    ),
  ]);

  const counts: CountDbRow | undefined = countRows[0][0];
  const lessonList = lessonRows[0];
  const completedList = completedRows[0];
  const { videoCatalog, ownedVideoCatalog } = videoLibraries;
  const lessonHistory: LessonHistoryEntry[] = historyRows[0].map((row) => ({
    id: row.id, title: row.title, topic: row.topic, status: row.status,
    score: row.score === null ? null : Number(row.score), attempts: row.attempts,
    studiedAt: row.studied_at.toISOString(),
  }));
  const nextVideo = videoCatalog.find(({ completed }) => !completed);
  const num = (value: unknown): number => Number(value ?? 0);
  return {
    totalLessons: num(counts?.total_lessons),
    completedLessons: num(counts?.completed_lessons),
    completedLessonIds: completedList.map((row) => row.id),
    videoCatalog,
    ownedVideoCatalog,
    lessonHistory,
    daysSinceStudy: counts?.days_since_study == null ? null : Number(counts.days_since_study),
    lessons: lessonList.map((row) => ({
      id: row.id,
      title: row.title,
      topic: row.topic,
      stageTitle: row.stage_title,
    })),
    videosTotal: videoCatalog.length,
    videosCompleted: videoCatalog.filter(({ completed }) => completed).length,
    nextVideo: nextVideo ? { id: nextVideo.id, title: nextVideo.title } : null,
    savedWords: num(counts?.saved_words),
    translations: num(counts?.translations),
    battlesPlayed: num(counts?.battles_played),
    battleWins: num(counts?.battle_wins),
    badges: num(counts?.badges),
    xp: num(counts?.xp),
    streak: num(counts?.streak),
    reviewDue: num(counts?.review_due),
    reviewTotal: num(counts?.review_total),
    reviewWords: num(counts?.review_words),
    ownedVideos: ownedVideoCatalog.length,
    ownedVideoTitles: ownedVideoCatalog.slice(0, 6).map((row) => row.title),
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
 * Every question is stored so the buddy remembers what was already asked. One
 * long-lived STUDY_COACH chat per learner keeps that history in one place.
 */
export async function ensureCoachChat(userId: number): Promise<number> {
  const [rows] = await pool.execute<IdDbRow[]>(FIRST_COACH_CHAT, [userId]);
  if (rows[0]) return rows[0].id;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Only automatic creation takes this lock. Learners can still create
    // additional coach chats explicitly from the chat API.
    const [owners] = await connection.execute<IdDbRow[]>('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!owners[0]) throw new HttpError(401, 'Invalid authentication token.');
    // The owner row serializes this read for one learner and avoids locking
    // gaps in the chat index shared by concurrent learners.
    const [existing] = await connection.execute<IdDbRow[]>(FIRST_COACH_CHAT, [userId]);
    let id = existing[0]?.id;
    if (id === undefined) {
      const [created] = await connection.execute<ResultSetHeader>(
        "INSERT INTO chats (user_id, topic, title) VALUES (?, 'STUDY_COACH', 'En Buddy')", [userId],
      );
      id = created.insertId;
    }
    await connection.commit();
    return id;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
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

function storedDestinations(value: unknown): ChatAction[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).flatMap((entry) => {
    const action = parseChatAction(entry);
    if (!action || !isRecord(entry)) return [];
    for (const key of ['lessonTitle', 'videoTitle', 'itemName'] as const) {
      if (typeof entry[key] === 'string') action[key] = entry[key].trim().slice(0, 255);
    }
    return [action];
  });
}

export async function getCoachConversationHistory(chatId: number, limit?: number): Promise<CoachMessageRow[]> {
  const [rows] = await pool.execute<CoachMessageDbRow[]>(
    `SELECT id, chat_id, role, content, created_at
     FROM messages
     WHERE chat_id = ? AND (role <> 'SYSTEM' OR content LIKE ?)
     ORDER BY id DESC${limit === undefined ? '' : ' LIMIT ?'}`,
    [chatId, `${COACH_DESTINATIONS}%`, ...(limit === undefined ? [] : [Math.ceil(limit * 1.5) + 2])],
  );
  const history: CoachMessageRow[] = [];
  for (const [index, row] of rows.entries()) {
    if (row.role === 'SYSTEM') continue;
    const preceding = rows[index + 1];
    let destinations: ChatAction[] = [];
    let presentedDestinations: ChatAction[] | undefined;
    if (row.role === 'AI' && preceding?.role === 'SYSTEM' && preceding.content.startsWith(COACH_DESTINATIONS)) {
      try {
        const stored: unknown = JSON.parse(preceding.content.slice(COACH_DESTINATIONS.length));
        destinations = storedDestinations(stored);
        const presentation = Array.isArray(stored) ? stored.at(-1) : undefined;
        if (isRecord(presentation) && Array.isArray(presentation.presented)) {
          presentedDestinations = storedDestinations(presentation.presented);
        }
      } catch {
        // A malformed internal record leaves the visible chat usable.
      }
    }
    history.push({
      ...row, role: row.role,
      ...(destinations.length ? { destinations } : {}),
      ...(presentedDestinations ? { presentedDestinations } : {}),
    });
    if (history.length === limit) break;
  }
  return history.reverse();
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

export async function getWeakTopics(userId: number): Promise<LearnerContext['weakTopics']> {
  interface WeakTopicRow extends RowDataPacket { topic: string; mistakes: number; }
  const [rows] = await pool.execute<WeakTopicRow[]>(
    `SELECT l.topic, COUNT(*) AS mistakes
     FROM learning_answer_attempts a
     JOIN questions q ON q.id = a.question_id
     JOIN lessons l ON l.id = q.lesson_id
     WHERE a.user_id = ? AND a.is_correct = FALSE
     GROUP BY l.topic ORDER BY mistakes DESC, l.topic LIMIT 5`,
    [userId],
  );
  return rows.map((row) => ({ topic: row.topic, mistakes: Number(row.mistakes) }));
}

export async function getStudyLearnerContext(userId: number): Promise<StudyLearnerContext> {
  interface MistakeRow extends RowDataPacket { topic: string; prompt: string; answer: string; }
  interface LevelRow extends RowDataPacket { level: LearnerContext['level'] | null; }

  const [weakTopics, [mistakes], [levels]] = await Promise.all([
    getWeakTopics(userId),
    pool.execute<MistakeRow[]>(
      `SELECT l.topic, q.question_text AS prompt, a.submitted_answer AS answer
       FROM learning_answer_attempts a
       JOIN questions q ON q.id = a.question_id
       JOIN lessons l ON l.id = q.lesson_id
       WHERE a.user_id = ? AND a.is_correct = FALSE
       ORDER BY a.created_at DESC LIMIT 8`,
      [userId],
    ),
    pool.execute<LevelRow[]>(
      `SELECT CASE MAX(CASE q.difficulty
                         WHEN 'advanced' THEN 3 WHEN 'intermediate' THEN 2 ELSE 1 END)
                WHEN 3 THEN 'advanced' WHEN 2 THEN 'intermediate' ELSE 'beginner'
              END AS level
       FROM progress p
       JOIN lessons l ON l.id = p.lesson_id
       JOIN questions q ON q.lesson_id = l.id
       WHERE p.user_id = ? AND p.status = 'completed'`,
      [userId],
    ),
  ]);
  return { level: levels[0]?.level ?? 'beginner', weakTopics, recentMistakes: mistakes };
}

export async function getRecentLearnerFeedback(userId: number): Promise<LearnerContext['previousFeedback']> {
  const [rows] = await pool.execute<FeedbackDbRow[]>(
    `SELECT f.id, f.message_id, f.type, f.original_text, f.corrected_text,
            f.explanation, f.created_at
     FROM ai_feedback f
     JOIN messages m ON m.id = f.message_id
     JOIN chats c ON c.id = m.chat_id
     WHERE c.user_id = ? AND m.role = 'USER'
     ORDER BY f.id DESC LIMIT 5`,
    [userId],
  );
  return rows.map(({ type, original_text, corrected_text, explanation }) => ({
    type, original_text, corrected_text, explanation,
  })).reverse();
}

export async function getCoachLearnerContext(userId: number): Promise<CoachLearnerContext> {
  const [study, previousFeedback] = await Promise.all([
    getStudyLearnerContext(userId),
    getRecentLearnerFeedback(userId),
  ]);
  return { ...study, previousFeedback };
}

export async function getLearnerContext(userId: number): Promise<LearnerContext> {
  interface TopicRow extends RowDataPacket { topic: string; }

  const [study, previousFeedback, [completedRows]] = await Promise.all([
    getStudyLearnerContext(userId),
    getRecentLearnerFeedback(userId),
    pool.execute<TopicRow[]>(
      `SELECT DISTINCT l.topic
       FROM progress p JOIN lessons l ON l.id = p.lesson_id
       WHERE p.user_id = ? AND p.status = 'completed'
       ORDER BY l.topic LIMIT 12`,
      [userId],
    ),
  ]);

  return {
    ...study,
    completedTopics: completedRows.map((row) => row.topic),
    previousFeedback,
  };
}

export async function saveConversation(
  userId: number,
  chatId: number,
  userText: string,
  aiText: string,
  feedback: AiFeedbackInput[],
  destinations: readonly ChatAction[] = [],
  presentedDestinations?: readonly ChatAction[],
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
    if (destinations.length) {
      const remembered = destinations.slice(0, 3);
      // Older readers still see the same ordered destinations. The trailing
      // presentation object records which option the assistant actually opened.
      const metadata = presentedDestinations
        ? [...remembered, { presented: presentedDestinations.slice(0, 3) }]
        : remembered;
      await connection.execute(
        "INSERT INTO messages (chat_id, role, content) VALUES (?, 'SYSTEM', ?)",
        [chatId, COACH_DESTINATIONS + JSON.stringify(metadata)],
      );
    }
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
