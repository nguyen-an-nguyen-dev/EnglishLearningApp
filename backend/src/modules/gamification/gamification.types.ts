import type { RowDataPacket } from 'mysql2';

export type CosmeticSlot = 'car' | 'frame' | 'nameplate';
/** Shop slots add consumables on top of the three cosmetic slots. */
export type ShopSlot = CosmeticSlot | 'booster';
/**
 * Consumable kinds. `streak_shield` and `rc_multiplier` are held as charges,
 * `xp_multiplier` as a deadline: each has a different lifetime model.
 */
export type BoosterKind = 'streak_shield' | 'xp_multiplier' | 'rc_multiplier';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type UnlockType = 'default' | 'level' | 'stage' | 'league' | 'achievement';
export type Currency = 'rc' | 'xp' | 'rp';
/** League order, lowest first. */
export const LEAGUE_TIERS = ['coal', 'copper', 'iron', 'gold', 'redstone', 'diamond'] as const;
export type LeagueTier = (typeof LEAGUE_TIERS)[number];

export function normalizeLeagueTier(value: string | null | undefined): LeagueTier {
  if (value === 'lapis') return 'redstone';
  return LEAGUE_TIERS.find((tier) => tier === value) ?? 'coal';
}

/** Include legacy Lapis rows in Redstone during a rolling deployment. */
export function leagueTierQueryValues(tier: LeagueTier): [LeagueTier, string] {
  return [tier, tier === 'redstone' ? 'lapis' : tier];
}
export type ActivityKind = 'lesson' | 'video' | 'duel_win' | 'duel_play' | 'answers' | 'saved_word' | 'login';
export type QuestMetric = ActivityKind;
export type QuestKind = 'daily' | 'weekly';

/** A single idempotent grant. Re-granting the same key is a no-op by design. */
export interface LedgerEntry {
  currency: Currency;
  amount: number;
  sourceType: string;
  sourceId: string;
}

export interface GrantOutcome {
  /** Entries that were actually written (a repeat of the same key is skipped). */
  granted: LedgerEntry[];
  /** Total RC added by this call. */
  rcEarned: number;
  /** Total XP added by this call. */
  xpEarned: number;
  /** Total RP added by this call. */
  rpEarned: number;
}

export interface ShopItemRow extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  description: string;
  slot: ShopSlot;
  rarity: Rarity;
  price: number;
  unlock_type: UnlockType;
  unlock_value: string | null;
  visual_key: string;
  /** MariaDB returns this JSON column already parsed; other drivers as a string. */
  style_json: string | Record<string, unknown> | null;
  /** Consumable behaviour; NULL on a non-booster row. */
  booster_kind: BoosterKind | null;
  booster_charges: number;
  booster_duration_minutes: number;
  sort_order: number;
}

export interface ShopItem {
  id: number;
  code: string;
  name: string;
  description: string;
  slot: ShopSlot;
  rarity: Rarity;
  price: number;
  unlock_type: UnlockType;
  unlock_value: string | null;
  visual_key: string;
  style: Record<string, string | null> | null;
  /** Consumable effect; null for permanent cosmetics. */
  booster_kind: BoosterKind | null;
  owned: boolean;
  equipped: boolean;
  unlocked: boolean;
  unlock_label: string;
  /** Boosters only: charges held (shields, RC cards) or ms left (XP card). */
  charges: number;
  /** Boosters only: when the timed effect lapses, ISO string or null. */
  active_until: string | null;
}

export interface EquipmentView {
  car: ShopItem | null;
  frame: ShopItem | null;
  nameplate: ShopItem | null;
}

/** What the learner currently holds in consumables, for the Gara header. */
export interface BoosterStock {
  streak_shields: number;
  rc_multipliers: number;
  xp_multiplier_until: string | null;
  /** Countdown in ms, 0 when the XP card is not running. */
  xp_multiplier_ms_left: number;
}

export interface Wallet {
  coins: number;
  xp: number;
  level: number;
  level_progress: {
    level: number;
    xp: number;
    xp_into_level: number;
    xp_for_level: number;
    xp_to_next_level: number | null;
    progress_ratio: number;
  };
  streak: number;
  /** Most recent broken streak, for the loss notice. */
  streak_lost: number;
  streak_lost_at: string | null;
  /** True when the break happened in the last 7 days. */
  streak_lost_recent: boolean;
  /** Days since the last active day (0 = today, null = never active). */
  last_activity_days_ago: number | null;
  race_points: number;
  tier: LeagueTier;
  season_code: string | null;
  equipment: EquipmentView;
  owned_count: number;
  boosters: BoosterStock;
}

export interface QuestRow extends RowDataPacket {
  id: number;
  code: string;
  kind: QuestKind;
  title: string;
  description: string;
  metric: QuestMetric;
  target: number;
  rc_reward: number;
  xp_reward: number;
  rp_reward: number;
  sort_order: number;
}

export interface QuestView {
  code: string;
  kind: QuestKind;
  title: string;
  description: string;
  metric: QuestMetric;
  target: number;
  progress: number;
  rc_reward: number;
  xp_reward: number;
  rp_reward: number;
  claimable: boolean;
  claimed: boolean;
}

export interface LeagueStanding {
  rank: number;
  userId: number;
  name: string;
  race_points: number;
  tier: LeagueTier;
  frame_key: string | null;
  nameplate_key: string | null;
  is_me: boolean;
}

export interface LeagueView {
  season: { code: string; starts_at: string; ends_at: string; ends_in_ms: number } | null;
  tier: LeagueTier;
  race_points: number;
  standings: LeagueStanding[];
  my_rank: number | null;
  last_payout: {
    season_code: string;
    tier: LeagueTier;
    rank: number;
    rc_awarded: number;
    xp_awarded: number;
  } | null;
}
