import { requestApi } from './apiClient'
import type {
  AdminLessonSummary,
  AdminQuestion,
  AdminSharedVideo,
  AdminStage,
  LessonPatchPayload,
  LessonPayload,
  MoveDirection,
  QuestionPatchPayload,
  QuestionPayload,
  SharedVideoImportResult,
  SharedVideoPatchPayload,
  StagePatchPayload,
  StagePayload,
  VideoAnalysisModel,
} from '../types/admin'

// ─── Content tree ────────────────────────────────────────────────────────────

export async function getAdminContentApi(): Promise<AdminStage[]> {
  const data = await requestApi<{ stages: AdminStage[] }>('/api/admin/content')
  return data.stages
}

export async function getAdminLessonQuestionsApi(lessonId: number): Promise<AdminQuestion[]> {
  const data = await requestApi<{ questions: AdminQuestion[] }>(
    `/api/admin/lessons/${lessonId}/questions`,
  )
  return data.questions
}

// ─── Stages ──────────────────────────────────────────────────────────────────

export async function createStageApi(payload: StagePayload): Promise<AdminStage> {
  const data = await requestApi<{ stage: AdminStage }>('/api/admin/stages', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.stage
}

export async function updateStageApi(stageId: number, payload: StagePatchPayload): Promise<AdminStage> {
  const data = await requestApi<{ stage: AdminStage }>(`/api/admin/stages/${stageId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return data.stage
}

export async function deleteStageApi(stageId: number): Promise<void> {
  await requestApi<{ deleted: boolean }>(`/api/admin/stages/${stageId}`, { method: 'DELETE' })
}

export async function moveStageApi(stageId: number, direction: MoveDirection): Promise<void> {
  await requestApi<{ moved: boolean }>(`/api/admin/stages/${stageId}/move`, {
    method: 'POST',
    body: JSON.stringify({ direction }),
  })
}

// ─── Lessons ─────────────────────────────────────────────────────────────────

export async function createLessonApi(payload: LessonPayload): Promise<AdminLessonSummary> {
  const data = await requestApi<{ lesson: AdminLessonSummary }>('/api/admin/lessons', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.lesson
}

export async function updateLessonApi(
  lessonId: number,
  payload: LessonPatchPayload,
): Promise<AdminLessonSummary> {
  const data = await requestApi<{ lesson: AdminLessonSummary }>(`/api/admin/lessons/${lessonId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return data.lesson
}

export async function deleteLessonApi(lessonId: number): Promise<void> {
  await requestApi<{ deleted: boolean }>(`/api/admin/lessons/${lessonId}`, { method: 'DELETE' })
}

export async function moveLessonApi(lessonId: number, direction: MoveDirection): Promise<void> {
  await requestApi<{ moved: boolean }>(`/api/admin/lessons/${lessonId}/move`, {
    method: 'POST',
    body: JSON.stringify({ direction }),
  })
}

// ─── Questions ───────────────────────────────────────────────────────────────

export async function createQuestionApi(
  lessonId: number,
  payload: QuestionPayload,
): Promise<AdminQuestion> {
  const data = await requestApi<{ question: AdminQuestion }>(
    `/api/admin/lessons/${lessonId}/questions`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
  return data.question
}

export async function updateQuestionApi(
  questionId: number,
  payload: QuestionPatchPayload,
): Promise<AdminQuestion> {
  const data = await requestApi<{ question: AdminQuestion }>(`/api/admin/questions/${questionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return data.question
}

export async function deleteQuestionApi(questionId: number): Promise<void> {
  await requestApi<{ deleted: boolean }>(`/api/admin/questions/${questionId}`, { method: 'DELETE' })
}

export async function moveQuestionApi(questionId: number, direction: MoveDirection): Promise<void> {
  await requestApi<{ moved: boolean }>(`/api/admin/questions/${questionId}/move`, {
    method: 'POST',
    body: JSON.stringify({ direction }),
  })
}

// ─── Shared video library ────────────────────────────────────────────────────

export async function listAdminVideosApi(): Promise<AdminSharedVideo[]> {
  const data = await requestApi<{ videos: AdminSharedVideo[] }>('/api/admin/videos')
  return data.videos
}

export async function importAdminVideoApi(
  url: string,
  model: VideoAnalysisModel = 'bolt',
): Promise<SharedVideoImportResult> {
  const data = await requestApi<{ video: SharedVideoImportResult }>('/api/admin/videos', {
    method: 'POST',
    body: JSON.stringify({ url, model }),
  })
  return data.video
}

export async function updateAdminVideoApi(
  videoId: number,
  payload: SharedVideoPatchPayload,
): Promise<AdminSharedVideo> {
  const data = await requestApi<{ video: AdminSharedVideo }>(`/api/admin/videos/${videoId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return data.video
}

export async function deleteAdminVideoApi(videoId: number): Promise<void> {
  await requestApi<{ deleted: boolean }>(`/api/admin/videos/${videoId}`, { method: 'DELETE' })
}

export async function moveAdminVideoApi(videoId: number, direction: MoveDirection): Promise<void> {
  await requestApi<{ moved: boolean }>(`/api/admin/videos/${videoId}/move`, {
    method: 'POST',
    body: JSON.stringify({ direction }),
  })
}
