export const AI_TOPICS = [
  'DAILY_CONVERSATION',
  'TRAVEL',
  'FOOD',
  'SHOPPING',
  'SCHOOL',
  'FAMILY',
  'HOBBIES',
  'JOB_INTERVIEW',
  'STUDY_COACH',
] as const;

export type AiTopic = (typeof AI_TOPICS)[number];

/** The learner's purpose for a turn. `chat` keeps the original tutor behaviour. */
export const CHAT_INTENTS = ['chat', 'plan', 'explain', 'how', 'practice'] as const;
export type ChatIntent = (typeof CHAT_INTENTS)[number];

export const CHAT_TABS = ['study', 'videos', 'translate', 'compete', 'rankings', 'profile', 'admin'] as const;
export type ChatTab = (typeof CHAT_TABS)[number];

/** Untrusted page context sent by the web. Never interpolated into SQL. */
export interface ChatContext {
  tab: ChatTab;
  focus?: string;
  detail?: string;
}

export interface ChatTurn {
  message: string;
  intent: ChatIntent;
  context: ChatContext | null;
}

/** A deep-link the buddy offers so the learner can jump straight there. */
export const CHAT_ACTION_KINDS = ['open_video', 'open_lesson', 'open_tab', 'open_notebook'] as const;
export type ChatActionKind = (typeof CHAT_ACTION_KINDS)[number];

export interface ChatAction {
  kind: ChatActionKind;
  label: string;
  tab?: ChatTab;
  videoId?: number;
  lessonId?: number;
  lessonTitle?: string;
}

export type StudyStepKind = 'lesson' | 'review' | 'vocab' | 'video' | 'arena' | 'translate';

export interface StudyStepTarget {
  tab: ChatTab;
  lessonId?: number;
  lessonTitle?: string;
  videoId?: number;
}

export interface StudyStep {
  id: string;
  kind: StudyStepKind;
  title: string;
  reason: string;
  minutes: number;
  target: StudyStepTarget;
}

export interface StudySnapshot {
  level: LearnerContext['level'];
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
  ownedVideos: number;
  ownedVideoTitles: string[];
  savedWords: number;
  translations: number;
  battlesPlayed: number;
  battleWins: number;
  badges: number;
}

export interface StudyPlan {
  snapshot: StudySnapshot;
  steps: StudyStep[];
  aiNote: string | null;
  generatedAt: string;
}

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
  reviewLessons: Array<{ title: string; practiceSeconds: number; attempts: number }>;
}
