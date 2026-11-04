import { requestApi } from './apiClient'
import type { EarnedBadge, RankingBoard } from '../types/community'

export async function getRankingApi(): Promise<RankingBoard> {
  return requestApi<RankingBoard>('/api/ranking')
}

export async function getMyBadgesApi(): Promise<EarnedBadge[]> {
  const data = await requestApi<{ badges: EarnedBadge[] }>('/api/badges/me')
  return data.badges
}
