export type CosmeticSlot = 'car' | 'frame' | 'nameplate'
/** Shop slots add consumables on top of the three cosmetic slots. */
export type ShopSlot = CosmeticSlot | 'booster'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type UnlockType = 'default' | 'level' | 'stage' | 'league' | 'achievement'
export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'diamond'
export type QuestKind = 'daily' | 'weekly'
export type QuestMetric = 'lesson' | 'video' | 'duel_win' | 'duel_play' | 'answers' | 'saved_word' | 'login'

export interface ShopItem {
  id: number
  code: string
  name: string
  description: string
  slot: ShopSlot
  rarity: Rarity
  price: number
  unlock_type: UnlockType
  unlock_value: string | null
  visual_key: string
  /** Palette/art parameters, resolved against `cosmetics.ts` by visual_key. */
  style: Record<string, string | null> | null
  owned: boolean
  equipped: boolean
  unlocked: boolean
  unlock_label: string
  /** Boosters only: charges held (shields, RC cards). */
  charges: number
  /** Boosters only: ISO deadline of a running timed effect. */
  active_until: string | null
}

export interface Equipment {
  car: ShopItem | null
  frame: ShopItem | null
  nameplate: ShopItem | null
}

export interface LevelProgress {
  level: number
  xp: number
  xp_into_level: number
  xp_for_level: number
  xp_to_next_level: number | null
  progress_ratio: number
}

export interface Wallet {
  coins: number
  xp: number
  level: number
  level_progress: LevelProgress
  streak: number
  race_points: number
  tier: LeagueTier
  season_code: string | null
  equipment: Equipment
  owned_count: number
  boosters: BoosterStock
}

/** Consumables the learner currently holds, shown in the Gara header. */
export interface BoosterStock {
  streak_shields: number
  rc_multipliers: number
  xp_multiplier_until: string | null
  xp_multiplier_ms_left: number
}

export interface ShopResponse {
  items: ShopItem[]
  coins: number
  level: number
  boosters: BoosterStock
}

export interface Quest {
  code: string
  kind: QuestKind
  title: string
  description: string
  metric: QuestMetric
  target: number
  progress: number
  rc_reward: number
  xp_reward: number
  rp_reward: number
  claimable: boolean
  claimed: boolean
}

export interface RewardCenter {
  streak: number
  daily: Quest[]
  weekly: Quest[]
}

export interface LeagueStanding {
  rank: number
  userId: number
  name: string
  race_points: number
  tier: LeagueTier
  frame_key: string | null
  nameplate_key: string | null
  is_me: boolean
}

export interface LeagueView {
  season: { code: string; starts_at: string; ends_at: string; ends_in_ms: number } | null
  tier: LeagueTier
  race_points: number
  standings: LeagueStanding[]
  my_rank: number | null
  last_payout: {
    season_code: string
    tier: LeagueTier
    rank: number
    rc_awarded: number
    xp_awarded: number
  } | null
}

/** Reward line attached to a finished duel (`game:finish`). */
export interface DuelReward {
  rc: number
  xp: number
  rp: number
  counted: boolean
  won: boolean
  level_before: number
  level_after: number
}
