import type { Dict } from '../i18n'
import type { LeagueTier } from '../types/gamification'
import { asLeagueTier } from './league'

const LABEL_KEY: Record<LeagueTier, keyof Dict> = {
  coal: 'tierCoal',
  copper: 'tierCopper',
  iron: 'tierIron',
  gold: 'tierGold',
  redstone: 'tierRedstone',
  diamond: 'tierDiamond',
}

export function tierLabel(t: Dict, tier: string | null | undefined): string {
  return t[LABEL_KEY[asLeagueTier(tier)]] as string
}
