import type { BuddyAnswer } from '../../types/buddy'

export type BuddyIntent = 'chat' | 'plan' | 'explain' | 'how' | 'practice'

/**
 * The backend decision model already picked the route. Older backends only send
 * an `action`, so keep a narrow fallback instead of forcing a chat panel open.
 */
export function isNavigationAnswer(answer: BuddyAnswer, intent: BuddyIntent): boolean {
  if (answer.route === 'navigate') return true
  if (answer.route === 'open_prompt') return false
  return intent !== 'chat' && answer.action !== null
}

/** Short, self-closing confirmation used for a direct navigation. */
export function navigationToast(answer: BuddyAnswer, fallback: string): string {
  const text = answer.reply.trim()
  return text.length > 0 && text.length <= 120 ? text : fallback
}
