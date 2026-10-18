import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../db/pool';

export interface BattleQuestion {
  id: number;
  prompt: string;
  answer: string;
}

interface BattleQuestionRow extends RowDataPacket {
  id: number;
  prompt_vi: string;
  answer_en: string;
}

interface PlayerRow extends RowDataPacket {
  display_name: string;
}

export async function getPlayerName(userId: number): Promise<string | undefined> {
  const [rows] = await pool.execute<PlayerRow[]>(
    'SELECT display_name FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  return rows[0]?.display_name;
}

export async function getQuestions(): Promise<BattleQuestion[]> {
  const [rows] = await pool.execute<BattleQuestionRow[]>(
    'SELECT id, prompt_vi, answer_en FROM battle_questions ORDER BY RAND() LIMIT 20',
  );
  return rows.map((row) => ({ id: row.id, prompt: row.prompt_vi, answer: row.answer_en }));
}

export async function createMatch(playerOneId: number, playerTwoId: number): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO matches (player_one_id, player_two_id, status, started_at)
     VALUES (?, ?, 'active', CURRENT_TIMESTAMP)`,
    [playerOneId, playerTwoId],
  );
  return result.insertId;
}

export async function recordAnswer(
  matchId: number,
  userId: number,
  round: number,
  answer: string,
  isCorrect: boolean,
  responseTimeMs: number,
): Promise<void> {
  await pool.execute(
    `INSERT INTO match_answers
       (match_id, user_id, question_id, round, answer_text, is_correct, response_time_ms)
     VALUES (?, ?, NULL, ?, ?, ?, ?)`,
    [matchId, userId, round, answer, isCorrect, responseTimeMs],
  );
}

export async function finishMatch(
  matchId: number,
  status: 'completed' | 'cancelled',
  winnerUserId: number | null,
): Promise<void> {
  await pool.execute(
    `UPDATE matches
     SET status = ?, winner_user_id = ?, finished_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'active'`,
    [status, winnerUserId, matchId],
  );
}
