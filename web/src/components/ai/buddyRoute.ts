import type { BuddyAnswer } from '../../types/buddy'

/**
 * A single destination opens immediately. Compound turns stay in chat so the
 * learner can choose each destination and confirm any reminder.
 */
export function isNavigationAnswer(answer: BuddyAnswer): boolean {
  return answer.action !== null && !answer.actions?.length && !answer.suggestion
}

/** Short, self-closing confirmation used for a direct navigation. */
export function navigationToast(answer: BuddyAnswer, fallback: string): string {
  const text = answer.reply.trim()
  const action = answer.action
  const showDetails = action?.kind === 'show_shop_item' || action?.kind === 'spotlight' || action?.kind === 'open_video' || action?.mode === 'reveal'
  return text && (showDetails || text.length <= 120) ? text : fallback
}
