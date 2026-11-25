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
  const action = answer.action
  const showDetails = action?.kind === 'show_shop_item' || action?.kind === 'spotlight' || action?.mode === 'reveal'
  return text && (showDetails || text.length <= 120) ? text : fallback
}
