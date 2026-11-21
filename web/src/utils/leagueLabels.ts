import type { Dict } from '../i18n'
import { asLeagueTier } from './league'

export function tierLabel(t: Dict, tier: string | null | undefined): string {
  switch (asLeagueTier(tier)) {
    case 'silver':
      return t.tierSilver
    case 'gold':
      return t.tierGold
    case 'diamond':
      return t.tierDiamond
    default:
      return t.tierBronze
  }
}

export function tierTagline(t: Dict, tier: string | null | undefined): string {
  switch (asLeagueTier(tier)) {
    case 'silver':
      return t.leagueTaglineSilver
    case 'gold':
      return t.leagueTaglineGold
    case 'diamond':
      return t.leagueTaglineDiamond
    default:
      return t.leagueTaglineBronze
  }
}
