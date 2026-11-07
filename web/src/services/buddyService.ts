import { requestApi } from './apiClient'
import type {
  BuddyAnswer,
  BuddyFeed,
  BuddyTarget,
  ReminderSuggestion,
  StudyReminder,
} from '../types/buddy'

/** Everything the companion says before being asked. */
export async function getBuddyFeedApi(): Promise<BuddyFeed> {
  return requestApi<BuddyFeed>('/api/buddy/nudges')
}

/** One question, one answer: no thread to load or render. */
export async function askBuddyApi(
  question: string,
  context: { tab: string; focus?: string; detail?: string } | null,
  intent: 'chat' | 'plan' | 'explain' | 'how' | 'practice' = 'chat',
): Promise<BuddyAnswer> {
  return requestApi<BuddyAnswer>('/api/buddy/ask', {
    method: 'POST',
    body: JSON.stringify({ question, context, intent }),
    signal: AbortSignal.timeout(40_000),
  })
}

export async function listRemindersApi(): Promise<StudyReminder[]> {
  const data = await requestApi<{ reminders: StudyReminder[] }>('/api/reminders')
  return data.reminders
}

export async function createReminderApi(payload: {
  title: string
  body?: string
  in_minutes?: number
  at_time?: string
  target?: BuddyTarget | null
}): Promise<StudyReminder> {
  const data = await requestApi<{ reminder: StudyReminder }>('/api/reminders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.reminder
}

/** Accepts the reminder the buddy offered in an answer. */
export async function acceptReminderSuggestionApi(
  suggestion: ReminderSuggestion,
  target: BuddyTarget | null,
): Promise<StudyReminder> {
  const data = await requestApi<{ reminder: StudyReminder }>('/api/buddy/reminder-suggestion', {
    method: 'POST',
    body: JSON.stringify({ suggestion, target }),
  })
  return data.reminder
}

export async function dismissReminderApi(reminderId: number): Promise<void> {
  await requestApi(`/api/reminders/${reminderId}`, { method: 'DELETE' })
}

/** Called once a reminder has actually been shown, so it never fires twice. */
export async function acknowledgeReminderApi(reminderId: number): Promise<void> {
  await requestApi(`/api/reminders/${reminderId}/acknowledge`, { method: 'POST' })
}
