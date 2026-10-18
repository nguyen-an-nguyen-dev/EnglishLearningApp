import { request } from './api';

export const AI_TOPICS = [
  { id: 'DAILY_CONVERSATION', label: 'Daily Conversation', icon: '💬' },
  { id: 'TRAVEL', label: 'Travel', icon: '✈️' },
  { id: 'FOOD', label: 'Food', icon: '🍜' },
  { id: 'SHOPPING', label: 'Shopping', icon: '🛍️' },
  { id: 'SCHOOL', label: 'School', icon: '📚' },
  { id: 'FAMILY', label: 'Family', icon: '👨‍👩‍👧' },
  { id: 'HOBBIES', label: 'Hobbies', icon: '🎨' },
  { id: 'JOB_INTERVIEW', label: 'Job Interview', icon: '💼' },
] as const;

export type AiTopic = (typeof AI_TOPICS)[number]['id'];
export type FeedbackType = 'GRAMMAR' | 'VOCABULARY' | 'TENSE' | 'WORD_ORDER' | 'OTHER';

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

export async function sendAiMessage(chatId: number, message: string): Promise<{
  userMessage: AiMessage;
  aiMessage: AiMessage;
  feedback: AiFeedback[];
}> {
  return request(`/ai/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function getAiFeedback(chatId: number): Promise<AiFeedback[]> {
  const data = await request<{ feedback: AiFeedback[] }>(`/ai/chats/${chatId}/feedback`);
  return data.feedback;
}
