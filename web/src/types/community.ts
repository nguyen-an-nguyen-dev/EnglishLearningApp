export interface RankingEntry {
  rank: number
  userId: number
  name: string
  avatar: string | null
  xp: number
}

export interface RankingBoard {
  leaderboard: RankingEntry[]
  current_user_rank: number | null
}

export interface EarnedBadge {
  code: string
  name: string
  description: string
  icon: string | null
  awarded_at: string
}
