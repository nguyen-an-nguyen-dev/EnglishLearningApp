export const AI_TOPICS = [
  'DAILY_CONVERSATION',
  'TRAVEL',
  'FOOD',
  'SHOPPING',
  'SCHOOL',
  'FAMILY',
  'HOBBIES',
  'JOB_INTERVIEW',
] as const;

export type AiTopic = (typeof AI_TOPICS)[number];
export type FeedbackType = 'GRAMMAR' | 'VOCABULARY' | 'TENSE' | 'WORD_ORDER' | 'OTHER';

export interface ChatRow {
  id: number;
  topic: AiTopic;
  title: string | null;
  created_at: Date;
  updated_at: Date;
  last_message: string | null;
}

export interface MessageRow {
  id: number;
  chat_id: number;
  role: 'USER' | 'AI';
  content: string;
  created_at: Date;
}

export interface FeedbackRow {
  id: number;
  message_id: number;
  type: FeedbackType;
  original_text: string;
  corrected_text: string;
  explanation: string;
  created_at: Date;
}

export interface AiFeedbackInput {
  type: FeedbackType;
  original_text: string;
  corrected_text: string;
  explanation: string;
}

export interface LearnerContext {
  level: 'beginner' | 'intermediate' | 'advanced';
  completedTopics: string[];
  weakTopics: Array<{ topic: string; mistakes: number }>;
  recentMistakes: Array<{ topic: string; prompt: string; answer: string }>;
  previousFeedback: Array<Pick<FeedbackRow, 'type' | 'original_text' | 'corrected_text' | 'explanation'>>;
}
