import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../db/pool';
import {
  bumpStandingCounter,
  consumeBoosterInTx,
  grantInTx,
  recordActivityInTx,
} from '../gamification/gamification.repository';
import { levelForXp } from '../gamification/gamification.levels';
import { REWARDS } from '../gamification/gamification.rewards';
import type { LedgerEntry } from '../gamification/gamification.types';
import { enqueueBattleMistakes } from '../analytics/review.repository';

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
  wordId: number | null = null,
): Promise<void> {
  await pool.execute(
    `INSERT INTO match_answers
       (match_id, user_id, question_id, word_id, round, answer_text, is_correct, response_time_ms)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
    [matchId, userId, wordId, round, answer, isCorrect, responseTimeMs],
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

// Missed words become review items. Kept in the repository so the socket only
// ever talks to one seam and a test double never reaches the real database.
export async function enqueueReviewMistakes(
  entries: Array<{ userId: number; wordId: number; isCorrect: boolean }>,
): Promise<void> {
  await enqueueBattleMistakes(entries);
}

export interface BattleParticipant {
  userId: number;
  /** Rounds this player won; the evaluator compares the two to find the winner. */
  score: number;
}

export interface BattleRewardLine {
  rc: number;
  xp: number;
  rp: number;
  /** False when this was a forfeit/no-show, which pays nothing. */
  counted: boolean;
}

export interface BattleSettlement {
  rewards: Record<number, BattleRewardLine>;
  levelBefore: Record<number, number>;
  levelAfter: Record<number, number>;
  duelCountedToday: boolean;
}

// Pay out a finished duel for both players. The Arena is not a coin farm:
//  - a forfeit/disconnect (`rated === false`) pays nothing;
//  - past the daily rated-duel cap, further wins only satisfy quests and the
//    league floor, not the win bonus;
//  - every entry is keyed by `match:<id>`, so a replayed finish is a no-op.
export async function settleMatch(
  matchId: number,
  status: 'completed' | 'cancelled',
  winnerUserId: number | null,
  participants: BattleParticipant[],
  rated: boolean,
): Promise<BattleSettlement> {
  const rewards: Record<number, BattleRewardLine> = {};
  const levelBefore: Record<number, number> = {};
  const levelAfter: Record<number, number> = {};
  let duelCountedToday = false;

  if (status !== 'completed' || participants.length === 0) {
    for (const player of participants) {
      rewards[player.userId] = { rc: 0, xp: 0, rp: 0, counted: false };
    }
    return { rewards, levelBefore, levelAfter, duelCountedToday };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const player of participants) {
      const [userRows] = await connection.execute<Array<RowDataPacket & { xp: number }>>(
        'SELECT xp FROM users WHERE id = ? FOR UPDATE',
        [player.userId],
      );
      const xpBefore = Number(userRows[0]?.xp ?? 0);
      levelBefore[player.userId] = levelForXp(xpBefore);

      // Quests and the daily "you played" tick always count; only the currency
      // is gated, so a learner past the cap still progresses their missions.
      await recordActivityInTx(connection, player.userId, 'duel_play', String(matchId));

      const [ratedRows] = await connection.execute<Array<RowDataPacket & { total: number }>>(
        `SELECT COUNT(*) AS total FROM activity_events
         WHERE user_id = ? AND kind = 'duel_play' AND DATE(created_at) = CURDATE()`,
        [player.userId],
      );
      const underCap = Number(ratedRows[0]?.total ?? 0) <= REWARDS.duelDailyCap;

      if (!rated) {
        rewards[player.userId] = { rc: 0, xp: 0, rp: 0, counted: false };
        levelAfter[player.userId] = levelForXp(xpBefore);
        continue;
      }
      duelCountedToday = true;

      const won = winnerUserId === player.userId;
      const entries: LedgerEntry[] = [];
      if (won) {
        await recordActivityInTx(connection, player.userId, 'duel_win', String(matchId));
        await bumpStandingCounter(connection, player.userId, 'duel_wins');
      }
      if (underCap) {
        const baseRc = won ? REWARDS.duelWinRc : REWARDS.duelLossRc;
        // The RC card is "next duel" only, so it is spent here and doubled here.
        const rcDoubled = await consumeBoosterInTx(connection, player.userId, 'rc_multiplier');
        entries.push(
          { currency: 'rc', amount: rcDoubled ? baseRc * 2 : baseRc, sourceType: 'duel', sourceId: String(matchId) },
          { currency: 'xp', amount: won ? REWARDS.duelWinXp : REWARDS.duelLossXp, sourceType: 'duel', sourceId: String(matchId) },
        );
        if (won) {
          entries.push({ currency: 'rp', amount: REWARDS.rpDuelWin, sourceType: 'duel', sourceId: String(matchId) });
        }
      }

      const outcome = await grantInTx(connection, player.userId, entries);
      rewards[player.userId] = {
        rc: outcome.rcEarned,
        xp: outcome.xpEarned,
        rp: outcome.rpEarned,
        counted: underCap,
      };
      levelAfter[player.userId] = levelForXp(xpBefore + outcome.xpEarned);
    }

    await connection.commit();
    return { rewards, levelBefore, levelAfter, duelCountedToday };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

interface AggregateRow extends RowDataPacket {
  played: number;
  wins: number;
}

interface RecentMatchRow extends RowDataPacket {
  winner_user_id: number | null;
  finished_at: Date | null;
}

interface RecentFormRow extends RowDataPacket {
  id: number;
  winner_user_id: number | null;
  finished_at: Date | null;
  opponent_name: string;
}

export interface RecentMatchResult {
  matchId: number;
  won: boolean;
  opponentName: string;
  playedAt: Date;
}

export interface MatchSummaryRow {
  played: number;
  wins: number;
  winStreak: number;
  lastPlayedAt: Date | null;
  recent: RecentMatchResult[];
}

const RECENT_FORM_LIMIT = 5;

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

  // The last few results with the rival's name, for the result-screen strip.
  const [formRows] = await pool.execute<RecentFormRow[]>(
    `SELECT m.id,
            m.winner_user_id,
            COALESCE(m.finished_at, m.completed_at, m.created_at) AS finished_at,
            COALESCE(NULLIF(u.display_name, ''), 'Đối thủ') AS opponent_name
     FROM matches m
     JOIN users u ON u.id = IF(m.player_one_id = ?, m.player_two_id, m.player_one_id)
     WHERE m.status = 'completed' AND (m.player_one_id = ? OR m.player_two_id = ?)
     ORDER BY COALESCE(m.finished_at, m.completed_at, m.created_at) DESC
     LIMIT ${RECENT_FORM_LIMIT}`,
    [userId, userId, userId],
  );

  return {
    played: Number(aggregateRows[0]?.played ?? 0),
    wins: Number(aggregateRows[0]?.wins ?? 0),
    winStreak,
    lastPlayedAt: recentRows[0]?.finished_at ? new Date(recentRows[0].finished_at) : null,
    recent: formRows.map((row) => ({
      matchId: Number(row.id),
      won: row.winner_user_id === userId,
      opponentName: String((row as unknown as { opponent_name: string }).opponent_name),
      playedAt: row.finished_at ? new Date(row.finished_at) : new Date(),
    })),
  };
}
