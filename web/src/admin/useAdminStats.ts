import { useCallback, useEffect, useState } from 'react'
import {
  getAdminContentStatsApi,
  getAdminStatsOverviewApi,
  getAdminStatsTrendApi,
  getAdminLessonStatsApi,
  listAdminInactiveUsersApi,
} from '../services/adminService'
import type {
  AdminContentStats,
  AdminDayTrend,
  AdminInactiveUser,
  AdminLessonStat,
  AdminStageStat,
  AdminStatsOverview,
} from '../types/admin'

interface StatsState {
  overview: AdminStatsOverview | null
  trend: AdminDayTrend[]
  stageStats: AdminStageStat[]
  lessonStats: AdminLessonStat[]
  content: AdminContentStats | null
  loading: boolean
  error: string | null
}

export function useAdminOverview() {
  const [state, setState] = useState<StatsState>({
    overview: null,
    trend: [],
    stageStats: [],
    lessonStats: [],
    content: null,
    loading: true,
    error: null,
  })
  const [reloadKey, setReloadKey] = useState(0)

  const refresh = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    setReloadKey((key) => key + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getAdminStatsOverviewApi(),
      getAdminStatsTrendApi(14),
      getAdminLessonStatsApi(),
      getAdminContentStatsApi(),
    ])
      .then(([overview, trend, lessonData, content]) => {
        if (cancelled) return
        setState({
          overview,
          trend,
          stageStats: lessonData.stages,
          lessonStats: lessonData.lessons,
          content,
          loading: false,
          error: null,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Không tải được số liệu thống kê.',
        }))
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return { ...state, refresh }
}

export function useInactiveUsers(days: number) {
  const [users, setUsers] = useState<AdminInactiveUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const refresh = useCallback(() => {
    setLoading(true)
    setReloadKey((key) => key + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    listAdminInactiveUsersApi(days, 50)
      .then((loaded) => {
        if (cancelled) return
        setUsers(loaded)
        setLoading(false)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Không tải được danh sách.')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [days, reloadKey])

  return { users, loading, error, refresh }
}
