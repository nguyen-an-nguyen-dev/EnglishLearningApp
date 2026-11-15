import { requestApi } from './apiClient'
import type {
  LeagueView,
  RewardCenter,
  ShopItem,
  ShopResponse,
  Wallet,
} from '../types/gamification'

export async function getWalletApi(): Promise<Wallet> {
  const data = await requestApi<{ wallet: Wallet }>('/api/wallet')
  return data.wallet
}

export async function getShopApi(): Promise<ShopResponse> {
  return requestApi<ShopResponse>('/api/shop')
}

export async function purchaseItemApi(itemId: number): Promise<{ item: ShopItem; coins: number }> {
  return requestApi<{ item: ShopItem; coins: number }>(
    `/api/shop/items/${itemId}/purchase`,
    { method: 'POST' },
  )
}

export async function equipItemApi(itemId: number): Promise<ShopItem> {
  const data = await requestApi<{ item: ShopItem }>(
    `/api/shop/items/${itemId}/equip`,
    { method: 'POST' },
  )
  return data.item
}

export async function unequipSlotApi(slot: string): Promise<ShopItem> {
  const data = await requestApi<{ item: ShopItem }>(
    `/api/shop/slots/${slot}/unequip`,
    { method: 'POST' },
  )
  return data.item
}

export async function getRewardsApi(): Promise<RewardCenter> {
  return requestApi<RewardCenter>('/api/rewards')
}

export async function claimQuestApi(code: string): Promise<{ quest: RewardCenter['daily'][number]; coins: number }> {
  return requestApi<{ quest: RewardCenter['daily'][number]; coins: number }>(
    `/api/rewards/quests/${encodeURIComponent(code)}/claim`,
    { method: 'POST' },
  )
}

export async function getLeagueApi(): Promise<LeagueView> {
  const data = await requestApi<{ league: LeagueView }>('/api/league')
  return data.league
}
