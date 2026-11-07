import { useI18n } from '../../i18n'

interface AdminSkeletonProps {
  rows?: number
  /** Thumbnail placeholder for the shared-video list. */
  thumb?: boolean
}

/** Loading placeholder shaped like the real rows, so columns never collapse. */
export function AdminSkeleton({ rows = 3, thumb = false }: AdminSkeletonProps) {
  const { t } = useI18n()

  return (
    <div className="admin-skeleton" role="status" aria-label={t.adminLoading}>
      {Array.from({ length: rows }, (_, index) => (
        <div className="admin-skeleton-row" key={index}>
          {thumb && <span className="admin-skeleton-thumb" aria-hidden="true" />}
          <span className="admin-skeleton-stack">
            <span className="admin-skeleton-bar is-title" />
            <span className="admin-skeleton-bar is-meta" />
          </span>
        </div>
      ))}
    </div>
  )
}
