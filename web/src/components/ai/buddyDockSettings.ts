export interface BuddyDockPosition {
  x: number
  y: number
}

export const BUDDY_DOCK_STORAGE_KEY = 'engorace_buddy_dock'

export function readBuddyDockSettings(): { enabled: boolean; position: BuddyDockPosition | null } {
  try {
    const saved = JSON.parse(localStorage.getItem(BUDDY_DOCK_STORAGE_KEY) ?? 'null')
    const x = saved?.position?.x
    const y = saved?.position?.y
    return {
      enabled: saved?.enabled !== false,
      position: typeof x === 'number' && typeof y === 'number' && x >= 0 && x <= 1 && y >= 0 && y <= 1
        ? { x, y }
        : null,
    }
  } catch {
    return { enabled: true, position: null }
  }
}
