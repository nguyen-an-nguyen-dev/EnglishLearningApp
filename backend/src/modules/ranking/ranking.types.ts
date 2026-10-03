import type { RowDataPacket } from 'mysql2';

export interface RankingEntry {
  rank: number;
  userId: number;
  name: string;
  avatar: string | null;
  xp: number;
}

export interface RankingRow extends RowDataPacket, RankingEntry {}

export interface RankingResponse {
  leaderboard: RankingEntry[];
  current_user_rank: number | null;
}