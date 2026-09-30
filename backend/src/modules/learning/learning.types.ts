// Row types (from database)
import type { RowDataPacket } from 'mysql2';

export interface StageRow extends RowDataPacket {
  id: number;
  code: string;
  title: string;
  description: string | null;
  sort_order: number;
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
}

// API response types

export interface Stage {
  id: number;
  code: string;
  title: string;
  description: string | null;
  sort_order: number;
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
  difficulty: string;
  sort_order: number;
  answers: Answer[];
}

export interface LessonState {
  status: 'locked' | 'unlocked' | 'completed';
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
}

export interface CheckAnswerInput {
  answer: string;
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
  lesson_status: 'completed' | 'retry';
  stage_completed: boolean;
}
