import { requestApi } from './apiClient'

export type AiChatTopic =
  | 'DAILY_CONVERSATION'
  | 'TRAVEL'
  | 'FOOD'
  | 'SHOPPING'
  | 'SCHOOL'
  | 'FAMILY'
  | 'HOBBIES'
  | 'JOB_INTERVIEW'
  | 'STUDY_COACH'

export type ChatIntent = 'chat' | 'plan' | 'explain' | 'how' | 'practice'
export type ChatTab = 'study' | 'videos' | 'translate' | 'compete' | 'rankings' | 'profile'

export interface ChatContext {
  tab: ChatTab
  focus?: string
  detail?: string
}

export interface AiChat {
  id: number
  topic: AiChatTopic
  title: string | null
  created_at: string
  updated_at: string
  last_message: string | null
}

export interface AiMessage {
  id: number
  chat_id: number
  role: 'USER' | 'AI'
  content: string
  created_at: string
}

export interface AiFeedback {
  id?: number
  message_id: number
  type: 'GRAMMAR' | 'VOCABULARY' | 'TENSE' | 'WORD_ORDER' | 'OTHER'
  original_text: string
  corrected_text: string
  explanation: string
  created_at?: string
}

export interface SendMessageResult {
  userMessage: AiMessage
  aiMessage: AiMessage
  feedback: AiFeedback[]
}

export interface StudySnapshot {
  level: 'beginner' | 'intermediate' | 'advanced'
  xp: number
  streak: number
  completedLessons: number
  totalLessons: number
  weakTopics: Array<{ topic: string; mistakes: number }>
  recentMistakes: Array<{ topic: string; prompt: string; answer: string }>
  nextLesson: { id: number; title: string; topic: string } | null
  videosCompleted: number
  videosTotal: number
  nextVideo: { id: number; title: string } | null
  savedWords: number
  translations: number
  battlesPlayed: number
  battleWins: number
  badges: number
}

export interface StudyStep {
  id: string
  kind: 'lesson' | 'review' | 'vocab' | 'video' | 'arena' | 'translate'
  title: string
  reason: string
  minutes: number
  target: {
    tab: ChatTab
    lessonId?: number
    lessonTitle?: string
    videoId?: number
  }
}

export interface StudyPlan {
  snapshot: StudySnapshot
  steps: StudyStep[]
  aiNote: string | null
  generatedAt: string
}

const CHAT_TIMEOUT_MS = 35_000
const PLAN_TIMEOUT_MS = 25_000

export async function listAiChatsApi(): Promise<AiChat[]> {
  const data = await requestApi<{ chats: AiChat[] }>('/api/ai/chats')
  return data.chats
}

export async function createAiChatApi(topic: AiChatTopic = 'STUDY_COACH'): Promise<AiChat> {
  const data = await requestApi<{ chat: AiChat }>('/api/ai/chats', {
    method: 'POST',
    body: JSON.stringify({ topic }),
  })
  return data.chat
}

export async function getAiChatApi(chatId: number): Promise<{ chat: AiChat; messages: AiMessage[] }> {
  return requestApi<{ chat: AiChat; messages: AiMessage[] }>(`/api/ai/chats/${chatId}`)
}

export async function deleteAiChatApi(chatId: number): Promise<void> {
  await requestApi(`/api/ai/chats/${chatId}`, { method: 'DELETE' })
}

export async function sendAiMessageApi(
  chatId: number,
  message: string,
  intent: ChatIntent = 'chat',
  context: ChatContext | null = null,
): Promise<SendMessageResult> {
  return requestApi<SendMessageResult>(`/api/ai/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message, intent, context }),
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
  })
}

export async function getStudyPlanApi(): Promise<StudyPlan> {
  return requestApi<StudyPlan>('/api/ai/study-plan', {
    signal: AbortSignal.timeout(PLAN_TIMEOUT_MS),
  })
}
