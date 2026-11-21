export type StreakDayState = 'done' | 'pending' | 'missed' | 'upcoming'

export interface StreakWeekDay {
  label: string
  state: StreakDayState
  isToday: boolean
}

interface BuildStreakWeekInput {
  streak: number
  /** Days since the last active day: 0 = today, null/undefined = never active or older payload. */
  lastActivityDaysAgo?: number | null
  today: Date
  /** Monday-first labels, one per day. */
  labels: readonly string[]
}

/**
 * Maps the running streak onto the current Monday-first week. The chain ends on
 * the last active day, not on "today", so a learner who has not studied yet
 * still sees the days they actually kept; today stays pending until they do.
 */
export function buildStreakWeek({
  streak,
  lastActivityDaysAgo,
  today,
  labels,
}: BuildStreakWeekInput): StreakWeekDay[] {
  const todayIndex = (today.getDay() + 6) % 7
  const activeDays = Math.max(0, Math.floor(streak))
  // Older API payloads have no activity field; assume today so the known chain
  // still renders instead of an empty week. A clock skew can put the last
  // activity in the future, which is clamped so tomorrow never paints as done.
  const lastActive = lastActivityDaysAgo == null
    ? (activeDays > 0 ? 0 : null)
    : Math.max(0, lastActivityDaysAgo)

  return labels.map((label, index) => {
    const back = todayIndex - index
    const done = lastActive !== null && activeDays > 0
      && back >= lastActive && back < lastActive + activeDays
    return {
      label,
      isToday: back === 0,
      state: done ? 'done' : back === 0 ? 'pending' : back > 0 ? 'missed' : 'upcoming',
    }
  })
}
