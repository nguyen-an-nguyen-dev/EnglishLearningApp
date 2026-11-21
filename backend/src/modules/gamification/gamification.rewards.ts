// Reward economy in one place. Kept separate from gamification.service so other
// modules (learning, video, battle) can read the numbers without importing the
// service, which would create an import cycle.
export const REWARDS = {
  /** Paid once per lesson, keyed by lesson id. */
  lessonXp: 20,
  lessonRc: 15,
  /** Paid once per stage, keyed by stage id. */
  stageRc: 40,
  stageXp: 40,
  /** Bonus RC per newly earned badge, keyed by badge code. */
  badgeRc: 25,
  /** Duel: winners earn more, but every settled match pays something. */
  duelWinRc: 20,
  duelWinXp: 15,
  duelLossRc: 8,
  duelLossXp: 5,
  /** Video completion, keyed by video id (XP comes from the video row). */
  videoRc: 10,
  videoXp: 10,
  /** Race Points per source, feeding the weekly league. */
  rpLesson: 10,
  rpVideo: 8,
  rpDuelWin: 25,
  rpQuest: 15,
  rpDailyLogin: 5,
  /** Rated duels per day; further duels still count for quests, not for RC. */
  duelDailyCap: 5,
} as const;

export type BoosterKind = 'streak_shield' | 'xp_multiplier' | 'rc_multiplier';

// Consumable specs, keyed by `shop_items.code`. `charges` is how many uses one
// purchase grants; `durationMs` makes the effect timed instead of charge-based.
// The numbers live here (not in the DB) so tuning the economy needs no migration.
export const BOOSTER_SPECS: Record<
  string,
  { kind: BoosterKind; charges: number; durationMs: number }
> = {
  booster_streak_shield: { kind: 'streak_shield', charges: 1, durationMs: 0 },
  booster_xp2: { kind: 'xp_multiplier', charges: 0, durationMs: 30 * 60 * 1000 },
  booster_rc2: { kind: 'rc_multiplier', charges: 1, durationMs: 0 },
  // The starter bundle is three shields plus one XP card; the XP card is added
  // by the purchase path, so a combo cannot silently drop half the card.
  booster_starter: { kind: 'streak_shield', charges: 3, durationMs: 0 },
} as const;

/** The bundle's second half, applied on top of its shield grant. */
export const BOOSTER_BONUS: Record<string, { xpCardMs: number }> = {
  booster_starter: { xpCardMs: 30 * 60 * 1000 },
};
