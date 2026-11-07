import { request } from './api';

export const AI_TOPICS = [
  { id: 'DAILY_CONVERSATION', label: 'Daily Conversation' },
  { id: 'TRAVEL', label: 'Travel' },
  { id: 'FOOD', label: 'Food' },
  { id: 'SHOPPING', label: 'Shopping' },
  { id: 'SCHOOL', label: 'School' },
  { id: 'FAMILY', label: 'Family' },
  { id: 'HOBBIES', label: 'Hobbies' },
  { id: 'JOB_INTERVIEW', label: 'Job Interview' },
] as const;

export type AiTopic = (typeof AI_TOPICS)[number]['id'] | 'STUDY_COACH';
export type FeedbackType = 'GRAMMAR' | 'VOCABULARY' | 'TENSE' | 'WORD_ORDER' | 'OTHER';
export type ChatIntent = 'chat' | 'plan' | 'explain' | 'how' | 'practice';
export type ChatTab = 'study' | 'videos' | 'translate' | 'compete' | 'rankings' | 'profile';

export interface ChatContext {
  tab: ChatTab;
  focus?: string;
  detail?: string;
}

export interface StudyStep {
  id: string;
  kind: 'lesson' | 'review' | 'vocab' | 'video' | 'arena' | 'translate';
  title: string;
  reason: string;
  minutes: number;
  target: {
    tab: ChatTab;
    lessonId?: number;
    lessonTitle?: string;
    videoId?: number;
  };
}

export interface StudyPlan {
  snapshot: {
    level: 'beginner' | 'intermediate' | 'advanced';
    xp: number;
    streak: number;
    completedLessons: number;
    totalLessons: number;
    weakTopics: Array<{ topic: string; mistakes: number }>;
    recentMistakes: Array<{ topic: string; prompt: string; answer: string }>;
    nextLesson: { id: number; title: string; topic: string } | null;
    videosCompleted: number;
    videosTotal: number;
    nextVideo: { id: number; title: string } | null;
    savedWords: number;
    translations: number;
    battlesPlayed: number;
    battleWins: number;
    badges: number;
  };
  steps: StudyStep[];
  aiNote: string | null;
  generatedAt: string;
}

export interface AiChat {
  id: number;
  topic: AiTopic;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message: string | null;
}

export interface AiMessage {
  id: number;
  chat_id: number;
  role: 'USER' | 'AI';
  content: string;
  created_at: string;
}

export interface AiFeedback {
  id?: number;
  message_id: number;
  type: FeedbackType;
  original_text: string;
  corrected_text: string;
  explanation: string;
}

export interface AiChatDetails {
  chat: AiChat;
  messages: AiMessage[];
}

export async function listAiChats(): Promise<AiChat[]> {
  const data = await request<{ chats: AiChat[] }>('/ai/chats');
  return data.chats;
}

export async function createAiChat(topic: AiTopic): Promise<AiChat> {
  const data = await request<{ chat: AiChat }>('/ai/chats', {
    method: 'POST',
    body: JSON.stringify({ topic }),
  });
  return data.chat;
}

export async function getAiChat(chatId: number): Promise<AiChatDetails> {
  return request<AiChatDetails>(`/ai/chats/${chatId}`);
}

export async function deleteAiChat(chatId: number): Promise<void> {
  await request<{ chat_id: number; deleted: boolean }>(`/ai/chats/${chatId}`, { method: 'DELETE' });
}

export async function sendAiMessage(
  chatId: number,
  message: string,
  intent: ChatIntent = 'chat',
  context: ChatContext | null = null,
): Promise<{
  userMessage: AiMessage;
  aiMessage: AiMessage;
  feedback: AiFeedback[];
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);
  try {
    return await request(`/ai/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message, intent, context }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Mình suy nghĩ hơi lâu rồi. Thử lại nha.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getStudyPlan(): Promise<StudyPlan> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    return await request<StudyPlan>('/ai/study-plan', { signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Kế hoạch mất quá lâu để tải. Thử lại nha.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAiFeedback(chatId: number): Promise<AiFeedback[]> {
  const data = await request<{ feedback: AiFeedback[] }>(`/ai/chats/${chatId}/feedback`);
  return data.feedback;
}
