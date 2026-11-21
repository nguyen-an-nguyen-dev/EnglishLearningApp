import type { RowDataPacket } from 'mysql2';

export type LeagueTierKey = 'coal' | 'copper' | 'iron' | 'gold' | 'redstone' | 'lapis' | 'diamond';

export interface RankingEntry {
  rank: number;
  userId: number;
  name: string;
  avatar: string | null;
  /** Career total; 0 on the weekly league board where Race Points matter. */
  xp: number;
  /** Present on the league board, null on the career board. */
  race_points?: number | null;
  tier?: string | null;
  /** Equipped cosmetics, shown next to the name on both boards. */
  frame_key?: string | null;
  frame_style?: Record<string, string | null> | null;
  nameplate_key?: string | null;
  nameplate_style?: Record<string, string | null> | null;
}

export interface RankingRow extends RowDataPacket, RankingEntry {}

/** Shared promotion/demotion rules so the board can label its own zones. */
export interface LeagueRules {
  promotion_slots: number;
  demotion_slots: number;
}

export interface RankingResponse {
  /** All-time career XP board (kept under the old key for the existing client). */
  leaderboard: RankingEntry[];
  current_user_rank: number | null;
  /** This week's league board for the learner's tier, ordered by Race Points. */
  league: RankingEntry[];
  current_user_league_rank: number | null;
  /** The tier whose board was returned, so the client cannot show the wrong league. */
  league_tier: LeagueTierKey;
  league_rules: LeagueRules;
}
