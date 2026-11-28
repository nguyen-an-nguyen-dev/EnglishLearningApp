export const LEARNER_PATHS = {
  study: '/study',
  videos: '/videolearning',
  translate: '/translate',
  compete: '/arena',
  rankings: '/rankings',
  shop: '/gara',
  profile: '/profile',
} as const

export type DashboardTab = keyof typeof LEARNER_PATHS

export const DASHBOARD_TABS = Object.keys(LEARNER_PATHS) as DashboardTab[]

export function learnerTabForPath(pathname: string): DashboardTab | undefined {
  const path = pathname.replace(/\/+$/, '')
  return DASHBOARD_TABS.find((tab) => LEARNER_PATHS[tab] === path)
}
