export function isAdminRoute(): boolean {
  if (typeof window === 'undefined') return false
  const path = window.location.pathname ?? ''
  const hash = window.location.hash ?? ''
  return path.startsWith('/admin') || hash.startsWith('#/admin') || hash === '#admin'
}
