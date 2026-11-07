import type { RowDataPacket } from 'mysql2';
import type { VideoAnalysisModel } from '../video/video.types';

export const STAGE_THEME_KEYS = ['forest', 'river', 'autumn', 'alpine', 'coast', 'sakura'] as const;
export type StageThemeKey = (typeof STAGE_THEME_KEYS)[number];

/** Mirrors FALLBACK_ACCENTS in web/src/roadmap.ts so an admin-created stage paints correctly. */
export const THEME_ACCENTS: Record<StageThemeKey, string> = {
  forest: '#3E9B5F',
  river: '#2E9CC4',
  autumn: '#D97706',
  alpine: '#2E7DA8',
  coast: '#2A9D8F',
  sakura: '#D65A86',
};

export const QUESTION_TYPES = [
  'multiple_choice',
  'fill_choice',
  'listen_choice',
  'word_order',
  'listening',
] as const;
export type AdminQuestionType = (typeof QUESTION_TYPES)[number];

export const CHOICE_QUESTION_TYPES: readonly AdminQuestionType[] = [
  'multiple_choice',
  'fill_choice',
  'listen_choice',
];
export const AUDIO_QUESTION_TYPES: readonly AdminQuestionType[] = ['listening', 'listen_choice'];

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export type AdminDifficulty = (typeof DIFFICULTIES)[number];

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export type MoveDirection = 'up' | 'down';

// ─── Rows ────────────────────────────────────────────────────────────────────

export interface AdminStageRow extends RowDataPacket {
  id: number;
  code: string;
  title: string;
  description: string | null;
  theme_key: string;
  accent_color: string;
  sort_order: number;
  lesson_count: number;
  question_count: number;
}

export interface AdminLessonRow extends RowDataPacket {
  id: number;
  stage_id: number;
  code: string;
  title: string;
  topic: string;
  sort_order: number;
  question_count: number;
}

export interface AdminQuestionRow extends RowDataPacket {
  id: number;
  lesson_id: number;
  question_text: string;
  question_type: string;
  explanation: string | null;
  audio_url: string | null;
  word_bank: string[] | string | null;
  difficulty: string;
  sort_order: number;
}

export interface AdminAnswerRow extends RowDataPacket {
  id: number;
  question_id: number;
  answer_text: string;
  is_correct: boolean | 0 | 1;
  sort_order: number;
}

export interface AdminSharedVideoRow extends RowDataPacket {
  id: number;
  code: string;
  title: string;
  description: string | null;
  topic: string;
  cefr_level: string;
  provider: 'youtube' | 'file';
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  xp_reward: number;
  sort_order: number;
  segment_count: number;
  created_at: Date;
}

// ─── API shapes ──────────────────────────────────────────────────────────────

export interface AdminLessonSummary {
  id: number;
  stage_id: number;
  code: string;
  title: string;
  topic: string;
  sort_order: number;
  question_count: number;
}

export interface AdminStage {
  id: number;
  code: string;
  title: string;
  description: string | null;
  theme_key: string;
  accent_color: string;
  sort_order: number;
  lesson_count: number;
  question_count: number;
  lessons: AdminLessonSummary[];
}

export interface AdminAnswer {
  id: number;
  answer_text: string;
  is_correct: boolean;
  sort_order: number;
}

export interface AdminQuestion {
  id: number;
  lesson_id: number;
  question_text: string;
  question_type: string;
  explanation: string | null;
  audio_url: string | null;
  word_bank: string[];
  difficulty: string;
  sort_order: number;
  answers: AdminAnswer[];
}

export interface AdminSharedVideo {
  id: number;
  code: string;
  title: string;
  description: string | null;
  topic: string;
  cefr_level: string;
  provider: 'youtube' | 'file';
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  xp_reward: number;
  sort_order: number;
  segment_count: number;
  created_at: string;
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

export interface StageInput {
  title: string;
  description: string | null;
  themeKey?: StageThemeKey;
}

export interface StagePatch {
  title?: string;
  description?: string | null;
  themeKey?: StageThemeKey;
}

export interface LessonInput {
  stageId: number;
  title: string;
  topic: string;
}

export interface LessonPatch {
  title?: string;
  topic?: string;
  stageId?: number;
}

export interface AnswerInput {
  answerText: string;
  isCorrect: boolean;
}

export interface QuestionInput {
  questionText: string;
  questionType: AdminQuestionType;
  explanation: string | null;
  audioUrl: string | null;
  wordBank: string[];
  difficulty: AdminDifficulty;
  answers: AnswerInput[];
}

export interface SharedVideoImportInput {
  url: string;
  model: VideoAnalysisModel;
}

export interface SharedVideoPatch {
  title?: string;
  description?: string | null;
  topic?: string;
  cefrLevel?: CefrLevel;
  xpReward?: number;
}
