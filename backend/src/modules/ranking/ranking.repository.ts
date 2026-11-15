import type { RowDataPacket } from 'mysql2';
import { pool } from '../../db/pool';
import { ensureCurrentSeason } from '../gamification/gamification.repository';
import type { RankingEntry, RankingResponse } from './ranking.types';

interface CareerRow extends RowDataPacket {
  rank: number;
  userId: number;
  name: string;
  xp: number;
  frame_key: string | null;
  nameplate_key: string | null;
}

interface LeagueRow extends RowDataPacket {
  rank: number;
  userId: number;
  name: string;
  race_points: number;
  tier: string;
  frame_key: string | null;
  nameplate_key: string | null;
}

/** All-time career board, ordered by total XP. */
export async function getCareerBoard(): Promise<RankingEntry[]> {
  const [rows] = await pool.execute<CareerRow[]>(
    `SELECT ROW_NUMBER() OVER (ORDER BY u.xp DESC, u.id ASC) AS \`rank\`,
            u.id AS userId, u.display_name AS name, u.xp,
            f.visual_key AS frame_key, n.visual_key AS nameplate_key
     FROM users u
     LEFT JOIN user_equipment ef ON ef.user_id = u.id AND ef.slot = 'frame'
     LEFT JOIN shop_items f ON f.id = ef.item_id
     LEFT JOIN user_equipment en ON en.user_id = u.id AND en.slot = 'nameplate'
     LEFT JOIN shop_items n ON n.id = en.item_id
     ORDER BY u.xp DESC, u.id ASC`,
  );
  return rows.map((row) => ({
    rank: Number(row.rank),
    userId: Number(row.userId),
    name: row.name,
    avatar: null,
    xp: Number(row.xp),
    race_points: null,
    tier: null,
    frame_key: row.frame_key ?? null,
    nameplate_key: row.nameplate_key ?? null,
  }));
}

/** This week's league board, ordered by Race Points earned in the active season. */
export async function getLeagueBoard(): Promise<RankingEntry[]> {
  const seasonId = await ensureCurrentSeason();
  const [rows] = await pool.execute<LeagueRow[]>(
    `SELECT ROW_NUMBER() OVER (ORDER BY st.race_points DESC, st.user_id ASC) AS \`rank\`,
            st.user_id AS userId, u.display_name AS name, st.race_points, st.tier,
            f.visual_key AS frame_key, n.visual_key AS nameplate_key
     FROM season_standings st
     JOIN users u ON u.id = st.user_id
     LEFT JOIN user_equipment ef ON ef.user_id = st.user_id AND ef.slot = 'frame'
     LEFT JOIN shop_items f ON f.id = ef.item_id
     LEFT JOIN user_equipment en ON en.user_id = st.user_id AND en.slot = 'nameplate'
     LEFT JOIN shop_items n ON n.id = en.item_id
     WHERE st.season_id = ? AND st.race_points > 0
     ORDER BY st.race_points DESC, st.user_id ASC`,
    [seasonId],
  );
  return rows.map((row) => ({
    rank: Number(row.rank),
    userId: Number(row.userId),
    name: row.name,
    avatar: null,
    xp: 0,
    race_points: Number(row.race_points),
    tier: String(row.tier),
    frame_key: row.frame_key ?? null,
    nameplate_key: row.nameplate_key ?? null,
  }));
}

/**
 * Both boards in one payload. `leaderboard` stays the career board so the
 * existing client keeps working; the weekly league board rides alongside it.
 */
export async function getRanking(currentUserId: number): Promise<RankingResponse> {
  const [career, league] = await Promise.all([getCareerBoard(), getLeagueBoard()]);
  const currentUser = career.find((entry) => entry.userId === currentUserId);
  const currentLeague = league.find((entry) => entry.userId === currentUserId);

  return {
    leaderboard: career,
    current_user_rank: currentUser?.rank ?? null,
    league,
    current_user_league_rank: currentLeague?.rank ?? null,
  };
}
