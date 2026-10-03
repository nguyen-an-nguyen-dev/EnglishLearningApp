import { pool } from '../../db/pool';
import type { RankingRow } from './ranking.types';

export async function getLeaderboard(): Promise<RankingRow[]> {
  const [rows] = await pool.execute<RankingRow[]>(
    `SELECT ROW_NUMBER() OVER (ORDER BY xp DESC, id ASC) AS \`rank\`,
            id AS userId, display_name AS name, NULL AS avatar, xp
     FROM users
     ORDER BY xp DESC, id ASC`,
  );
  return rows;
}