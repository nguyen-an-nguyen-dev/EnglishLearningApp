import { request } from './api';

export interface Stage {
  id: number;
  code: string;
  title: string;
  description: string | null;
  sort_order: number;
}

export interface LessonState {
  status: 'locked' | 'unlocked' | 'available' | 'completed';
  score: number | null;
  completed_at: string | null;
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

export interface AnswerOption {
  id: number;
  answer_text: string;
  sort_order: number;
}

export interface Question {
  id: number;
  question_text: string;
  question_type: string;
  explanation: string | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  sort_order: number;
  answers: AnswerOption[];
}

export interface UserProgress {
  completed_lesson_ids: number[];
  total_xp: number;
  stages: StageWithLessons[];
}

export interface SubmittedAnswer {
  questionId: number;
  answer: string;
}

export interface CheckAnswerFeedback {
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

export async function fetchStages(): Promise<Stage[]> {
  const data = await request<{ stages: Stage[] }>('/stages');
  return data.stages;
}

export async function fetchStageLessons(stageId: number): Promise<Lesson[]> {
  const data = await request<{ lessons: Lesson[] }>(`/stages/${stageId}/lessons`);
  return data.lessons;
}

export async function fetchLessonDetail(lessonId: number): Promise<Lesson> {
  const data = await request<{ lesson: Lesson }>(`/lessons/${lessonId}`);
  return data.lesson;
}

export async function fetchLessonQuestions(lessonId: number): Promise<Question[]> {
  const data = await request<{ questions: Question[] }>(`/lessons/${lessonId}/questions`);
  return data.questions;
}

export async function fetchUserProgress(): Promise<UserProgress> {
  const data = await request<UserProgress>('/progress');
  return data;
}

export async function submitLessonCompletion(
  lessonId: number,
  answers: SubmittedAnswer[],
): Promise<CompleteLessonResult> {
  const data = await request<CompleteLessonResult>(`/lessons/${lessonId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
  return data;
}

export async function checkLessonAnswer(
  lessonId: number,
  questionId: number,
  answer: string,
): Promise<CheckAnswerFeedback> {
  return request<CheckAnswerFeedback>(`/lessons/${lessonId}/questions/${questionId}/check`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  });
}
