import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { getProgressApi } from '../services/learningService'
import { buildRoadmap } from '../roadmap'
import type { RoadmapStage } from '../roadmap'
import type { UserProgress } from '../types/learning'

interface LearningContextValue {
  progress: UserProgress | null
  stages: RoadmapStage[]
  loading: boolean
  error: string | null
  refresh: () => void
}

const LearningContext = createContext<LearningContextValue | undefined>(undefined)

function LearningProviderInner({ token, children }: { token: string | null; children: ReactNode }) {
  const { refreshUser } = useAuth()
  const [progress, setProgress] = useState<UserProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const lastSilentRefresh = useRef(0)

  useEffect(() => {
    if (!token) return

    let cancelled = false
    getProgressApi()
      .then((data) => {
        if (cancelled) return
        setProgress(data)
        setLoading(false)
        setError(null)
        void refreshUser()
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoading(false)
        setError(err instanceof Error ? err.message : 'Không tải được lộ trình học.')
      })

    return () => {
      cancelled = true
    }
  }, [token, reloadKey, refreshUser])

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    setReloadKey((key) => key + 1)
  }, [])

  const refreshSilent = useCallback(() => {
    const now = Date.now()
    if (now - lastSilentRefresh.current < 1500) return
    lastSilentRefresh.current = now
    setReloadKey((key) => key + 1)
  }, [])

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') refreshSilent()
    }

    window.addEventListener('focus', refreshSilent)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', refreshSilent)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [refreshSilent])

  const stages = useMemo(() => (progress ? buildRoadmap(progress.stages) : []), [progress])

  const value = useMemo<LearningContextValue>(
    () => ({ progress, stages, loading, error, refresh }),
    [progress, stages, loading, error, refresh],
  )

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>
}

export function LearningProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()

  return (
    <LearningProviderInner key={token ?? 'anonymous'} token={token}>
      {children}
    </LearningProviderInner>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLearning(): LearningContextValue {
  const context = useContext(LearningContext)
  if (!context) {
    throw new Error('useLearning must be used within a LearningProvider')
  }
  return context
}
