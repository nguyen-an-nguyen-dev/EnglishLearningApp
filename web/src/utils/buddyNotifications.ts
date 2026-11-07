import type { StudyReminder } from '../types/buddy'

export type NotificationPermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

export function notificationState(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission as NotificationPermissionState
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission
  }
  try {
    return await Notification.requestPermission() as NotificationPermissionState
  } catch {
    return 'denied'
  }
}

/**
 * Shows the reminder as an OS notification. Only ever called while the tab is
 * open (a browser notification cannot be scheduled for later), so the caller
 * also renders it in-app — whichever one the learner sees first wins.
 */
export function showReminderNotification(reminder: StudyReminder): boolean {
  if (notificationState() !== 'granted') return false
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    // The in-app card is already on screen; don't buzz twice.
    return false
  }
  try {
    const notification = new Notification('En Buddy', {
      body: `${reminder.title}${reminder.body ? ` · ${reminder.body}` : ''}`,
      tag: `engorace-reminder-${reminder.id}`,
      icon: '/logo.png',
      badge: '/logo.png',
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
    return true
  } catch {
    return false
  }
}

export function formatReminderTime(iso: string): string {
  const due = new Date(iso)
  const now = new Date()
  const sameDay = due.toDateString() === now.toDateString()
  const time = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`
  if (sameDay) return `Hôm nay ${time}`
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (due.toDateString() === tomorrow.toDateString()) return `Mai ${time}`
  return `${due.getDate()}/${due.getMonth() + 1} ${time}`
}

export function minutesUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000)
}
