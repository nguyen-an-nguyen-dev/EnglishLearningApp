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
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO chats (user_id, topic, title) VALUES (?, ?, ?)',
    [userId, topic, topic],
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
    await connection.execute(
      `UPDATE chats SET title = CASE WHEN title = topic THEN ? ELSE title END, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [title, chatId, userId],
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
