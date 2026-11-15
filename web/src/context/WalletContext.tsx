import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import {
  claimQuestApi,
  equipItemApi,
  getLeagueApi,
  getRewardsApi,
  getShopApi,
  getWalletApi,
  purchaseItemApi,
  unequipSlotApi,
} from '../services/gamificationService'
import type { LeagueView, RewardCenter, ShopItem, Wallet } from '../types/gamification'

interface WalletContextValue {
  wallet: Wallet | null
  shop: ShopItem[]
  rewards: RewardCenter | null
  league: LeagueView | null
  loading: boolean
  refresh: () => void
  purchase: (itemId: number) => Promise<void>
  equip: (itemId: number) => Promise<void>
  unequip: (slot: string) => Promise<void>
  claimQuest: (code: string) => Promise<void>
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined)

function WalletProviderInner({ token, children }: { token: string | null; children: ReactNode }) {
  const { refreshUser } = useAuth()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [shop, setShop] = useState<ShopItem[]>([])
  const [rewards, setRewards] = useState<RewardCenter | null>(null)
  const [league, setLeague] = useState<LeagueView | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    Promise.all([
      getWalletApi(),
      getShopApi(),
      getRewardsApi(),
      getLeagueApi(),
    ])
      .then(([walletData, shopData, rewardsData, leagueData]) => {
        if (cancelled) return
        setWallet(walletData)
        setShop(shopData.items)
        setRewards(rewardsData)
        setLeague(leagueData)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        // The economy is an enhancement; a failed load must not blank the app.
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [token, reloadKey])

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1)
  }, [])

  const purchase = useCallback(async (itemId: number) => {
    await purchaseItemApi(itemId)
    void refreshUser()
    setReloadKey((key) => key + 1)
  }, [refreshUser])

  const equip = useCallback(async (itemId: number) => {
    await equipItemApi(itemId)
    setReloadKey((key) => key + 1)
  }, [])

  const unequip = useCallback(async (slot: string) => {
    await unequipSlotApi(slot)
    setReloadKey((key) => key + 1)
  }, [])

  const claimQuest = useCallback(async (code: string) => {
    await claimQuestApi(code)
    void refreshUser()
    setReloadKey((key) => key + 1)
  }, [refreshUser])

  const value = useMemo<WalletContextValue>(
    () => ({ wallet, shop, rewards, league, loading, refresh, purchase, equip, unequip, claimQuest }),
    [wallet, shop, rewards, league, loading, refresh, purchase, equip, unequip, claimQuest],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  return (
    <WalletProviderInner key={token ?? 'anonymous'} token={token}>
      {children}
    </WalletProviderInner>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}
