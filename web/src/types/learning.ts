export type LessonStatus = 'locked' | 'unlocked' | 'completed'

export interface LessonState {
  status: LessonStatus
  score: number | null
}

export interface Lesson {
  id: number
  stage_id: number
  code: string
  title: string
  topic: string
  sort_order: number
  state: LessonState
  total_questions: number
}

export interface Stage {
  id: number
  code: string
  title: string
  description: string | null
  theme_key: string
  accent_color: string
  sort_order: number
  lesson_count?: number
  question_count?: number
  lessons: Lesson[]
}

export interface UserProgress {
  completed_lesson_ids: number[]
  total_xp: number
  stages: Stage[]
}

export interface AnswerOption {
  id: number
  answer_text: string
  sort_order: number
}

export interface Question {
  id: number
  question_text: string
  question_type: string
  explanation: string | null
  audio_url: string | null
  word_bank: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  sort_order: number
  answers: AnswerOption[]
}

export interface CheckAnswerFeedback {
  is_correct: boolean
  correct_answer: string
  meaning_vi: string | null
}

export interface SubmittedAnswer {
  questionId: number
  answer: string
}

export interface LessonBadge {
  code: string
  name: string
  description: string
  icon: string | null
}

export interface CompleteLessonResult {
  score: number
  correct_answers: number
  total_questions: number
  xp_earned: number
  lesson_status: 'completed' | 'retry'
  stage_completed: boolean
  badges_awarded: LessonBadge[]
}
