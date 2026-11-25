import type { BuddyTarget } from '../../types/buddy'

export function buddyLessonToOpen(target: BuddyTarget): number | undefined {
  return target.mode === 'open' ? target.lessonId : undefined
}
