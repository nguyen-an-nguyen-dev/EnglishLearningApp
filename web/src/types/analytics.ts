/** Types for the learner review queue. */

export type ReviewKind = 'word' | 'question'
export type ReviewSource = 'mistake' | 'battle' | 'saved' | 'manual'
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy'

export interface ReviewWordPayload {
  word: string
  translation: string
  ipa: string | null
  part_of_speech: string
  cefr_level: string
  explanation: string
  example_en: string
  example_vi: string
}

export interface ReviewQuestionPayload {
  prompt: string
  question_type: string
  difficulty: string
  explanation: string | null
  lesson_title: string
  answers: Array<{ id: number; answer_text: string; sort_order: number }>
}

export interface ReviewItem {
  id: number
  kind: ReviewKind
  ref_id: number
  source: ReviewSource
  ease: number
  interval_days: number
  repetitions: number
  lapses: number
  mistake_count: number
  due_at: string
  last_reviewed_at: string | null
  last_grade: ReviewGrade | null
  word: ReviewWordPayload | null
  question: ReviewQuestionPayload | null
}

export interface ReviewQueue {
  due: ReviewItem[]
  upcoming: ReviewItem[]
  counts: { due: number; words: number; questions: number; total: number }
}

export interface ReviewAnswerResult {
  is_correct: boolean
  correct_answer: string
  explanation: string | null
  grade: ReviewGrade
  next_due_at: string
  interval_days: number
  repetitions: number
  ease: number
}
