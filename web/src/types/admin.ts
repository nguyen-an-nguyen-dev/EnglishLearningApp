import type { StageThemeKey } from '../roadmap'
import type { VideoAnalysisModel, VideoLessonDetail } from './video'

export type MoveDirection = 'up' | 'down'

export const QUESTION_TYPES = [
  'multiple_choice',
  'fill_choice',
  'listen_choice',
  'word_order',
  'listening',
] as const
export type AdminQuestionType = (typeof QUESTION_TYPES)[number]

export const CHOICE_QUESTION_TYPES: readonly AdminQuestionType[] = [
  'multiple_choice',
  'fill_choice',
  'listen_choice',
]
export const AUDIO_QUESTION_TYPES: readonly AdminQuestionType[] = ['listening', 'listen_choice']

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
export type AdminDifficulty = (typeof DIFFICULTIES)[number]

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

export const STAGE_THEME_KEYS = ['forest', 'river', 'autumn', 'alpine', 'coast', 'sakura'] as const
export type AdminStageTheme = Extract<StageThemeKey, (typeof STAGE_THEME_KEYS)[number]>

export const MAX_ANSWERS = 8
export const MIN_CHOICE_ANSWERS = 2

// ─── Content tree ────────────────────────────────────────────────────────────

export interface AdminLessonSummary {
  id: number
  stage_id: number
  code: string
  title: string
  topic: string
  sort_order: number
  question_count: number
}

export interface AdminStage {
  id: number
  code: string
  title: string
  description: string | null
  theme_key: string
  accent_color: string
  sort_order: number
  lesson_count: number
  question_count: number
  lessons: AdminLessonSummary[]
}

export interface AdminAnswer {
  id: number
  answer_text: string
  is_correct: boolean
  sort_order: number
}

export interface AdminQuestion {
  id: number
  lesson_id: number
  question_text: string
  question_type: string
  explanation: string | null
  audio_url: string | null
  word_bank: string[]
  difficulty: string
  sort_order: number
  answers: AdminAnswer[]
}

export interface AdminSharedVideo {
  id: number
  code: string
  title: string
  description: string | null
  topic: string
  cefr_level: string
  provider: 'youtube' | 'file'
  video_url: string
  thumbnail_url: string | null
  duration_seconds: number
  xp_reward: number
  sort_order: number
  segment_count: number
  created_at: string
}

// ─── Payloads ────────────────────────────────────────────────────────────────

export interface StagePayload {
  title: string
  description?: string
  theme_key?: AdminStageTheme
}

export interface StagePatchPayload {
  title?: string
  description?: string
  theme_key?: AdminStageTheme
}

export interface LessonPayload {
  stage_id: number
  title: string
  topic: string
}

export interface LessonPatchPayload {
  title?: string
  topic?: string
  stage_id?: number
}

export interface AdminAnswerPayload {
  answer_text: string
  is_correct: boolean
}

export interface QuestionPayload {
  question_text: string
  question_type: AdminQuestionType
  explanation?: string
  audio_url?: string
  word_bank?: string[]
  difficulty?: AdminDifficulty
  answers: AdminAnswerPayload[]
}

export interface QuestionPatchPayload extends Partial<Omit<QuestionPayload, 'answers'>> {
  answers?: AdminAnswerPayload[]
}

export interface SharedVideoPatchPayload {
  title?: string
  description?: string
  topic?: string
  cefr_level?: CefrLevel
  xp_reward?: number
}

export type SharedVideoImportResult = VideoLessonDetail
export type { VideoAnalysisModel }
