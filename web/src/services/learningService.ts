import { requestApi } from './apiClient'
import type {
  AnswerOption,
  CheckAnswerFeedback,
  CompleteLessonResult,
  Question,
  SubmittedAnswer,
  UserProgress,
} from '../types/learning'

export async function getProgressApi(): Promise<UserProgress> {
  return requestApi<UserProgress>('/api/progress')
}

export async function getLessonQuestionsApi(lessonId: number): Promise<Question[]> {
  const data = await requestApi<{ questions: Question[] }>(`/api/lessons/${lessonId}/questions`)
  return data.questions
}

export async function checkLessonAnswerApi(
  lessonId: number,
  questionId: number,
  answer: string,
): Promise<CheckAnswerFeedback> {
  return requestApi<CheckAnswerFeedback>(
    `/api/lessons/${lessonId}/questions/${questionId}/check`,
    { method: 'POST', body: JSON.stringify({ answer }) },
  )
}

export async function submitLessonCompletionApi(
  lessonId: number,
  answers: SubmittedAnswer[],
): Promise<CompleteLessonResult> {
  return requestApi<CompleteLessonResult>(
    `/api/lessons/${lessonId}/complete`,
    { method: 'POST', body: JSON.stringify({ answers }) },
  )
}

export type { AnswerOption }
