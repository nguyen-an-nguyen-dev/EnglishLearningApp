import type { RowDataPacket } from 'mysql2';
import type { Badge } from '../badges/badges.types';

export interface StageRow extends RowDataPacket {
  id: number;
  code: string;
  title: string;
  description: string | null;
  theme_key: string;
  accent_color: string;
  sort_order: number;
  lesson_count: number;
  question_count: number;
  created_at: Date;
}

export interface LessonRow extends RowDataPacket {
  id: number;
  stage_id: number;
  code: string;
  title: string;
  topic: string;
  sort_order: number;
  created_at: Date;
}

export interface QuestionRow extends RowDataPacket {
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

export interface AnswerRow extends RowDataPacket {
  id: number;
  question_id: number;
  answer_text: string;
  is_correct: boolean | 0 | 1;
  sort_order: number;
}

export interface ProgressRow extends RowDataPacket {
  id: number;
  user_id: number;
  lesson_id: number;
  status: 'not_started' | 'in_progress' | 'completed';
  score: number | null;
  started_at: Date;
  completed_at: Date | null;
  updated_at: Date;
  attempts: number;
}

// API response types
export interface Stage {
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

export interface Answer {
  id: number;
  answer_text: string;
  sort_order: number;
}

export interface Question {
  id: number;
  question_text: string;
  question_type: string;
  explanation: string | null;
  audio_url: string | null;
  word_bank: string[];
  difficulty: string;
  sort_order: number;
  answers: Answer[];
}

export interface LessonState {
  /**
   * `unlocked` is the learner's next lesson (the frontier). `available` is a
   * lesson that sits behind the frontier — typically content an admin inserted
   * into an earlier stage — so it can be studied without re-locking the road.
   */
  status: 'locked' | 'unlocked' | 'available' | 'completed';
  score: number | null;
}

export interface Lesson {
  id: number;
  stage_id: number;
  code: string;
  title: string;
  topic: string;
  sort_order: number;
  state: LessonState;
  total_questions: number;
}

export interface StageWithLessons extends Stage {
  lessons: Lesson[];
}

// Input types for completion
export interface SubmittedAnswer {
  questionId: number;
  answer: string; // text for fill_blank/translate/word_order, or answer_id string for MCQ
}

export interface CompleteLessonInput {
  answers: SubmittedAnswer[];
  practiceSeconds?: number;
}

export interface CheckAnswerInput {
  answer: string;
  /** Milliseconds between the question being shown and the answer being sent. */
  responseMs?: number;
}

export interface CheckAnswerResult {
  is_correct: boolean;
  correct_answer: string;
  meaning_vi: string | null;
}

export interface CompleteLessonResult {
  score: number;
  correct_answers: number;
  total_questions: number;
  xp_earned: number;
  rc_earned: number;
  /** False when this was a replay of a lesson already completed before. */
  is_first_completion: boolean;
  lesson_status: 'completed' | 'retry';
  stage_completed: boolean;
  /** Race Coin + XP paid for finishing the whole stage in this completion. */
  stage_reward: { rc: number; xp: number } | null;
  level_before: number;
  level_after: number;
  badges_awarded: Badge[];
  practice_seconds?: number;
}
