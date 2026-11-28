import { ApiError, requestApi } from './apiClient'
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
  onDraft?: (text: string) => void,
): Promise<BuddyAnswer> {
  const contentType = 'application/x-ndjson'
  return requestApi<BuddyAnswer>('/api/buddy/ask', {
    method: 'POST',
    body: JSON.stringify({ question, context, intent }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(40_000)]) : AbortSignal.timeout(40_000),
    headers: onDraft ? { Accept: contentType } : undefined,
  }, undefined, onDraft && { contentType, read: (response) => readBuddyStream(response, onDraft) })
}

async function readBuddyStream(response: Response, onDraft: (text: string) => void): Promise<BuddyAnswer> {
  const reader = response.body?.getReader()
  const failed = () => new ApiError('Không tải được câu trả lời của Bác Turbo.', 502)
  if (!reader) throw failed()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const lines = buffer.split('\n')
      buffer = done ? '' : (lines.pop() ?? '')
      if (buffer.length > 64_000) throw failed()
      for (const line of lines) {
        if (!line.trim()) continue
        const event = JSON.parse(line) as { type?: string; text?: unknown; data?: BuddyAnswer }
        if (event?.type === 'draft' && typeof event.text === 'string') onDraft(event.text)
        if (event?.type === 'answer' && typeof event.data?.reply === 'string') return event.data
        if (event?.type === 'error') throw failed()
      }
      if (done) throw failed()
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
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
