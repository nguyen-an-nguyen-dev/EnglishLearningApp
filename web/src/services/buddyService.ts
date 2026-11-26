import { requestApi } from './apiClient'
import type {
  BuddyAnswer,
  BuddyIntent,
  BuddyFeed,
  BuddyTarget,
  ReminderSuggestion,
  StudyReminder,
} from '../types/buddy'

export async function getBuddyFeedApi(): Promise<BuddyFeed> {
  return requestApi<BuddyFeed>('/api/buddy/nudges')
}

export function startBuddyVoiceSession(signal: AbortSignal): Promise<{ token: string | null }> {
  return requestApi('/api/buddy/voice/session', { method: 'POST', signal })
}

export async function askBuddyApi(
  question: string,
  context: { tab: string; focus?: string; detail?: string } | null,
  intent: BuddyIntent = 'chat',
  signal?: AbortSignal,
): Promise<BuddyAnswer> {
  return requestApi<BuddyAnswer>('/api/buddy/ask', {
    method: 'POST',
    body: JSON.stringify({ question, context, intent }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(40_000)]) : AbortSignal.timeout(40_000),
  })
}

export async function listRemindersApi(): Promise<StudyReminder[]> {
  const data = await requestApi<{ reminders: StudyReminder[] }>('/api/reminders')
  return data.reminders
}

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
