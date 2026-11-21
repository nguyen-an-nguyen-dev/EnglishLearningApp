import type { ReactNode } from 'react'
import { ArrowClockwise } from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import { AdminSkeleton } from './AdminSkeleton'

interface AdminAsyncStateProps {
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  empty?: boolean
  emptyIcon?: ReactNode
  emptyText?: string
  emptyAction?: ReactNode
  rows?: number
  thumb?: boolean
  children: ReactNode
}

/** Shared loading / error / empty / content switch for admin lists. */
export function AdminAsyncState({
  loading = false,
  error = null,
  onRetry,
  empty = false,
  emptyIcon,
  emptyText,
  emptyAction,
  rows = 5,
  thumb = false,
  children,
}: AdminAsyncStateProps) {
  const { t } = useI18n()
  if (loading) return <AdminSkeleton rows={rows} thumb={thumb} />
  if (error) {
    return (
      <div className="video-state-card">
        <p>{error}</p>
        {onRetry && (
          <button type="button" className="video-ghost-btn" onClick={onRetry}>
            <ArrowClockwise size={16} />
            <span>{t.retry}</span>
          </button>
        )}
      </div>
    )
  }
  if (empty) {
    return (
      <div className="admin-empty">
        {emptyIcon}
        <p className="admin-empty-hint">{emptyText}</p>
        {emptyAction}
      </div>
    )
  }
  return <>{children}</>
}
