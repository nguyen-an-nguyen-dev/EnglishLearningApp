import { authStorage } from './authService'
import type {
  AnswerOption,
  CheckAnswerFeedback,
  CompleteLessonResult,
  Question,
  SubmittedAnswer,
  UserProgress,
} from '../types/learning'

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

async function requestApi<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>

  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error || body.message || 'Không tải được dữ liệu bài học.')
  }

  return body.data
}

export async function getProgressApi(token = authStorage.getToken()): Promise<UserProgress> {
  if (!token) throw new Error('Bạn cần đăng nhập lại.')
  return requestApi<UserProgress>('/api/progress', token)
}

export async function getLessonQuestionsApi(
  lessonId: number,
  token = authStorage.getToken(),
): Promise<Question[]> {
  if (!token) throw new Error('Bạn cần đăng nhập lại.')
  const data = await requestApi<{ questions: Question[] }>(`/api/lessons/${lessonId}/questions`, token)
  return data.questions
}

export async function checkLessonAnswerApi(
  lessonId: number,
  questionId: number,
  answer: string,
  token = authStorage.getToken(),
): Promise<CheckAnswerFeedback> {
  if (!token) throw new Error('Bạn cần đăng nhập lại.')
  return requestApi<CheckAnswerFeedback>(
    `/api/lessons/${lessonId}/questions/${questionId}/check`,
    token,
    { method: 'POST', body: JSON.stringify({ answer }) },
  )
}

export async function submitLessonCompletionApi(
  lessonId: number,
  answers: SubmittedAnswer[],
  token = authStorage.getToken(),
): Promise<CompleteLessonResult> {
  if (!token) throw new Error('Bạn cần đăng nhập lại.')
  return requestApi<CompleteLessonResult>(
    `/api/lessons/${lessonId}/complete`,
    token,
    { method: 'POST', body: JSON.stringify({ answers }) },
  )
}

export type { AnswerOption }
