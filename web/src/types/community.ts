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
  nameplate_key?: string | null
}

export interface RankingBoard {
  leaderboard: RankingEntry[]
  current_user_rank: number | null
  /** This week's league board, ordered by Race Points. */
  league: RankingEntry[]
  current_user_league_rank: number | null
}

export interface EarnedBadge {
  code: string
  name: string
  description: string
  icon: string | null
  awarded_at: string
}
