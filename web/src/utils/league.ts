import type { LeagueTier } from '../types/gamification'

/** Ladder order, lowest first — the Minecraft-ore league. */
export const LEAGUE_TIERS = ['coal', 'copper', 'iron', 'gold', 'redstone', 'diamond'] as const

export type LeagueZone = 'promote' | 'stay' | 'demote'

export interface LeagueRules {
  promotion_slots: number
  demotion_slots: number
}

/** Fallback used before the ranking payload arrives; the API owns the real values. */
export const DEFAULT_LEAGUE_RULES: LeagueRules = {
  promotion_slots: 3,
  demotion_slots: 3,
}

export function asLeagueTier(value: string | null | undefined): LeagueTier {
  if (value === 'lapis') return 'redstone'
  return (LEAGUE_TIERS as readonly string[]).includes(value ?? '') ? (value as LeagueTier) : 'coal'
}

export function tierIndex(tier: string | null | undefined): number {
  const index = LEAGUE_TIERS.indexOf(asLeagueTier(tier))
  return index < 0 ? 0 : index
}

export function nextTier(tier: string | null | undefined): LeagueTier | null {
  const index = tierIndex(tier)
  return index < LEAGUE_TIERS.length - 1 ? LEAGUE_TIERS[index + 1] : null
}

export function previousTier(tier: string | null | undefined): LeagueTier | null {
  const index = tierIndex(tier)
  return index > 0 ? LEAGUE_TIERS[index - 1] : null
}

/** Raw promotion block size before the diamond cap; the target for the "gap to promotion" stat. */
export function promotionEnd(total: number, rules: LeagueRules = DEFAULT_LEAGUE_RULES): number {
  return Math.min(rules.promotion_slots, total)
}

/** Diamond is the top of the ladder, so its leaders defend their spot instead of moving up. */
export function promotionCount(
  total: number,
  tier: string | null | undefined,
  rules: LeagueRules = DEFAULT_LEAGUE_RULES,
): number {
  return asLeagueTier(tier) === 'diamond' ? 0 : promotionEnd(total, rules)
}

/**
 * Demotion slots after the promotion block claims overlapping ranks. Coal is the
 * bottom, so nobody drops out. The leader is never demoted: on a short diamond
 * board the bottom-three rule would otherwise send the week's winner down too.
 */
export function demotionCount(
  total: number,
  tier: string | null | undefined,
  rules: LeagueRules = DEFAULT_LEAGUE_RULES,
): number {
  if (asLeagueTier(tier) === 'coal') return 0
  const promote = promotionCount(total, tier, rules)
  const demote = Math.max(0, total - Math.max(promote, total - rules.demotion_slots))
  return Math.min(demote, Math.max(0, total - 1))
}

export function stayCount(
  total: number,
  tier: string | null | undefined,
  rules: LeagueRules = DEFAULT_LEAGUE_RULES,
): number {
  return Math.max(0, total - promotionCount(total, tier, rules) - demotionCount(total, tier, rules))
}

/**
 * Mirrors backend settlement: top slots promote (except diamond), bottom slots
 * demote (except coal), everyone else stays; promotion wins when zones overlap.
 */
export function leagueZone(
  rank: number,
  total: number,
  tier: string | null | undefined,
  rules: LeagueRules = DEFAULT_LEAGUE_RULES,
): LeagueZone {
  const promote = promotionCount(total, tier, rules)
  const demote = demotionCount(total, tier, rules)
  if (rank <= promote) return 'promote'
  if (rank > total - demote) return 'demote'
  return 'stay'
}
