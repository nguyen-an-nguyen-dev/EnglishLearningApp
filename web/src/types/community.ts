export interface RankingEntry {
  rank: number
  userId: number
  name: string
  avatar: string | null
  xp: number
  /** League board only: Race Points earned this season. */
  race_points?: number | null
  tier?: string | null
  frame_key?: string | null
  frame_style?: Record<string, string | null> | null
  nameplate_key?: string | null
  nameplate_style?: Record<string, string | null> | null
}

export interface LeagueRules {
  promotion_slots: number
  demotion_slots: number
}

export interface RankingBoard {
  leaderboard: RankingEntry[]
  current_user_rank: number | null
  /** This week's league board for the learner's tier, ordered by Race Points. */
  league: RankingEntry[]
  current_user_league_rank: number | null
  /** The tier whose board was returned. */
  league_tier?: string
  /** Server-owned zone sizes, so the UI cannot drift from settlement. */
  league_rules?: LeagueRules
}

export interface EarnedBadge {
  code: string
  name: string
  description: string
  icon: string | null
  awarded_at: string
}
