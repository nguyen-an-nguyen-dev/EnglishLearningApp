export const ADMIN_VIEWS = ['overview', 'content', 'videos', 'shop', 'arena', 'users', 'stats'] as const
export type AdminViewId = typeof ADMIN_VIEWS[number]

export function adminPath(view: AdminViewId): string {
  return `/admin/${view}`
}

export function adminViewForLocation(pathname: string, hash: string): AdminViewId | undefined {
  const path = pathname.replace(/\/+$/, '') || '/'
  const legacy = hash.replace(/^#/, '').replace(/\/+$/, '')
  const isAdmin = path === '/admin' || path.startsWith('/admin/')
  const isLegacyAdmin = (path === '/' || path === '/admin')
    && (legacy === 'admin' || legacy === '/admin' || legacy.startsWith('/admin/'))
  if (!isAdmin && !isLegacyAdmin) return undefined
  const target = isLegacyAdmin ? legacy : path
  return ADMIN_VIEWS.find((view) => adminPath(view) === target) ?? 'overview'
}
