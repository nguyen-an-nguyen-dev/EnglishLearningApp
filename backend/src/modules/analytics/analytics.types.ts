// Read-only: analytics derives from existing tables and never writes the learning path.

export type InsightCode =
  | 'weak_topic'
  | 'weak_vocabulary'
  | 'forgotten_vocabulary'
  | 'weak_exercise'
  | 'hard_question'
  | 'slow_question'
  | 'abandoned_lesson'
  | 'retry_lesson'
  | 'repeated_mistake'
  | 'accuracy_drop'
  | 'accuracy_gain'
  | 'duel_accuracy'
  | 'inactive'
  | 'content_error'
  | 'content_missing_answer';

export type InsightSeverity = 'low' | 'medium' | 'high';

export interface Insight {
  code: InsightCode;
  severity: InsightSeverity;
  /** The subject of the insight: a word, a lesson title, a question type… */
  label: string;
  /** 0..1 where a ratio applies, otherwise a count or a millisecond value. */
  value: number;
  ref_id: number | null;
}

export interface BehaviorStats {
  streak: number;
  active_days_30: number;
  answers_30: number;
  accuracy_30: number | null;
  /** Accuracy of the previous 30-day window, to show a real trend. */
  accuracy_prev_30: number | null;
  study_minutes_30: number;
  daily: Array<{ date: string; answers: number; correct: number; minutes: number }>;
}

export interface Totals {
  lessons_completed: number;
  lessons_started: number;
  videos_completed: number;
  duels_played: number;
  duels_won: number;
  saved_words: number;
  answers_total: number;
}

export interface VocabularyStat {
  word_id: number;
  word: string;
  translation: string;
  ipa: string | null;
  part_of_speech: string;
  cefr_level: string;
  attempts: number;
  correct: number;
  accuracy: number;
  avg_response_ms: number | null;
  last_seen: string | null;
  saved: boolean;
  /** Spaced-repetition state, when the word is already in the review queue. */
  review_due_at: string | null;
  review_repetitions: number | null;
}

export interface QuestionStat {
  question_id: number;
  prompt: string;
  question_type: string;
  difficulty: string;
  lesson_id: number;
  lesson_title: string;
  topic: string;
  attempts: number;
  correct: number;
  accuracy: number;
  avg_response_ms: number | null;
  /** The distractor learners typed most often when they were wrong. */
  wrong_answers: Array<{ answer: string; times: number }>;
}

export interface ExerciseStat {
  question_type: string;
  attempts: number;
  correct: number;
  accuracy: number;
  avg_response_ms: number | null;
}

export interface LessonStat {
  lesson_id: number;
  title: string;
  topic: string;
  stage_title: string;
  total_questions: number;
  answered_questions: number;
  status: 'not_started' | 'in_progress' | 'completed';
  score: number | null;
  attempts: number;
  practice_seconds: number | null;
  accuracy: number | null;
  /** Answered at least one question but never finished the lesson. */
  abandoned: boolean;
}

export interface CompetitionStats {
  matches: number;
  wins: number;
  answers: number;
  correct: number;
  accuracy: number | null;
  avg_response_ms: number | null;
}

export interface ContentFlag {
  question_id: number;
  prompt: string;
  lesson_title: string;
  kind: 'no_correct_answer' | 'multiple_correct_answers' | 'too_many_learners_wrong';
  attempts: number;
  correct: number;
  accuracy: number | null;
}

export interface AnalyticsResponse {
  behavior: BehaviorStats;
  totals: Totals;
  vocabulary: VocabularyStat[];
  questions: QuestionStat[];
  exercises: ExerciseStat[];
  lessons: LessonStat[];
  competition: CompetitionStats;
  insights: Insight[];
  content_flags: ContentFlag[];
  generated_at: string;
}

export type ReviewKind = 'word' | 'question';
export type ReviewSource = 'mistake' | 'battle' | 'saved' | 'manual';
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewWordPayload {
  word: string;
  translation: string;
  ipa: string | null;
  part_of_speech: string;
  cefr_level: string;
  explanation: string;
  example_en: string;
  example_vi: string;
}

export interface ReviewQuestionPayload {
  prompt: string;
  question_type: string;
  difficulty: string;
  explanation: string | null;
  lesson_title: string;
  /** Option text only: `is_correct` never leaves the server before grading. */
  answers: Array<{ id: number; answer_text: string; sort_order: number }>;
}

export interface ReviewItem {
  id: number;
  kind: ReviewKind;
  ref_id: number;
  source: ReviewSource;
  ease: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  mistake_count: number;
  due_at: string;
  last_reviewed_at: string | null;
  last_grade: ReviewGrade | null;
  word: ReviewWordPayload | null;
  question: ReviewQuestionPayload | null;
}

export interface ReviewQueue {
  due: ReviewItem[];
  /** Items already scheduled but not due yet, soonest first. */
  upcoming: ReviewItem[];
  counts: { due: number; words: number; questions: number; total: number };
}

export interface ReviewAnswerResult {
  is_correct: boolean;
  correct_answer: string;
  explanation: string | null;
  grade: ReviewGrade;
  next_due_at: string;
  interval_days: number;
  repetitions: number;
  ease: number;
}
