import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../db/pool';

export interface BattleWord {
  id: number;
  word: string;
  translation: string;
  partOfSpeech: string;
  cefrLevel: string;
  explanation: string;
  exampleEn: string;
  exampleVi: string;
  imageUrl: string | null;
}

interface BattleWordRow extends RowDataPacket {
  id: number;
  word_en: string;
  translation_vi: string;
  part_of_speech: string;
  cefr_level: string;
  explanation_vi: string;
  example_en: string;
  example_vi: string;
  image_url: string | null;
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

// ORDER BY RAND() makes every match draw its own random set, so two matches never share an order.
// `limit` is interpolated because mysql2 prepared statements reject a bound LIMIT placeholder.
export async function getWords(limit: number, levels: string[]): Promise<BattleWord[]> {
  const count = Math.max(1, Math.trunc(limit));
  const placeholders = levels.map(() => '?').join(', ');
  const [rows] = await pool.execute<BattleWordRow[]>(
    `SELECT id, word_en, translation_vi, part_of_speech, cefr_level,
            explanation_vi, example_en, example_vi, image_url
       FROM battle_words
      WHERE cefr_level IN (${placeholders})
      ORDER BY RAND()
      LIMIT ${count}`,
    levels,
  );
  return rows.map((row) => ({
    id: row.id,
    word: row.word_en,
    translation: row.translation_vi,
    partOfSpeech: row.part_of_speech,
    cefrLevel: row.cefr_level,
    explanation: row.explanation_vi,
    exampleEn: row.example_en,
    exampleVi: row.example_vi,
    imageUrl: row.image_url,
  }));
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

interface AggregateRow extends RowDataPacket {
  played: number;
  wins: number;
}

interface RecentMatchRow extends RowDataPacket {
  winner_user_id: number | null;
  finished_at: Date | null;
}

export interface MatchSummaryRow {
  played: number;
  wins: number;
  winStreak: number;
  lastPlayedAt: Date | null;
}

export async function getMatchSummary(userId: number): Promise<MatchSummaryRow> {
  const [aggregateRows] = await pool.execute<AggregateRow[]>(
    `SELECT COUNT(*) AS played,
            COALESCE(SUM(CASE WHEN winner_user_id = ? THEN 1 ELSE 0 END), 0) AS wins
     FROM matches
     WHERE status = 'completed' AND (player_one_id = ? OR player_two_id = ?)`,
    [userId, userId, userId],
  );

  const [recentRows] = await pool.execute<RecentMatchRow[]>(
    `SELECT winner_user_id, COALESCE(finished_at, completed_at, created_at) AS finished_at
     FROM matches
     WHERE status = 'completed' AND (player_one_id = ? OR player_two_id = ?)
     ORDER BY COALESCE(finished_at, completed_at, created_at) DESC
     LIMIT 50`,
    [userId, userId],
  );

  let winStreak = 0;
  for (const row of recentRows) {
    if (row.winner_user_id === userId) winStreak += 1;
    else break;
  }

  return {
    played: Number(aggregateRows[0]?.played ?? 0),
    wins: Number(aggregateRows[0]?.wins ?? 0),
    winStreak,
    lastPlayedAt: recentRows[0]?.finished_at ? new Date(recentRows[0].finished_at) : null,
  };
}
