import { requestApi } from './apiClient'
import type {
  AdminBattleWord,
  AdminContentStats,
  AdminDayTrend,
  AdminInactiveUser,
  AdminLessonStat,
  AdminLessonSummary,
  AdminManagedUser,
  AdminUserListResult,
  AdminUserPatchPayload,
  AdminQuestion,
  AdminSharedVideo,
  AdminShopItem,
  AdminStage,
  AdminStageStat,
  AdminStatsOverview,
  AdminVideoVocabulary,
  BattleWordPatchPayload,
  BattleWordPayload,
  LessonPatchPayload,
  LessonPayload,
  MoveDirection,
  QuestionPatchPayload,
  QuestionPayload,
  SharedVideoImportResult,
  SharedVideoPatchPayload,
  ShopItemPatchPayload,
  ShopItemPayload,
  StagePatchPayload,
  StagePayload,
  VideoVocabularyPatchPayload,
  VideoVocabularyPayload,
} from '../types/admin'

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

export async function listAdminVideosApi(): Promise<AdminSharedVideo[]> {
  const data = await requestApi<{ videos: AdminSharedVideo[] }>('/api/admin/videos')
  return data.videos
}

export async function importAdminVideoApi(
  url: string,
): Promise<SharedVideoImportResult> {
  const data = await requestApi<{ video: SharedVideoImportResult }>('/api/admin/videos', {
    method: 'POST',
    body: JSON.stringify({ url }),
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

export async function listAdminShopItemsApi(): Promise<AdminShopItem[]> {
  const data = await requestApi<{ items: AdminShopItem[] }>('/api/admin/shop-items')
  return data.items
}

export async function createAdminShopItemApi(payload: ShopItemPayload): Promise<AdminShopItem> {
  const data = await requestApi<{ item: AdminShopItem }>('/api/admin/shop-items', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.item
}

export async function updateAdminShopItemApi(
  itemId: number,
  payload: ShopItemPatchPayload,
): Promise<AdminShopItem> {
  const data = await requestApi<{ item: AdminShopItem }>(`/api/admin/shop-items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return data.item
}

export async function deleteAdminShopItemApi(itemId: number): Promise<void> {
  await requestApi<{ deleted: boolean }>(`/api/admin/shop-items/${itemId}`, { method: 'DELETE' })
}

export async function listAdminBattleWordsApi(): Promise<AdminBattleWord[]> {
  const data = await requestApi<{ words: AdminBattleWord[] }>('/api/admin/battle-words')
  return data.words
}

export async function createAdminBattleWordApi(payload: BattleWordPayload): Promise<AdminBattleWord> {
  const data = await requestApi<{ word: AdminBattleWord }>('/api/admin/battle-words', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.word
}

export async function updateAdminBattleWordApi(
  wordId: number,
  payload: BattleWordPatchPayload,
): Promise<AdminBattleWord> {
  const data = await requestApi<{ word: AdminBattleWord }>(`/api/admin/battle-words/${wordId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return data.word
}

export async function deleteAdminBattleWordApi(wordId: number): Promise<void> {
  await requestApi<{ deleted: boolean }>(`/api/admin/battle-words/${wordId}`, { method: 'DELETE' })
}

export async function listAdminVideoVocabularyApi(videoId: number): Promise<AdminVideoVocabulary[]> {
  const data = await requestApi<{ vocabulary: AdminVideoVocabulary[] }>(
    `/api/admin/videos/${videoId}/vocabulary`,
  )
  return data.vocabulary
}

export async function createAdminVideoVocabularyApi(
  videoId: number,
  payload: VideoVocabularyPayload,
): Promise<AdminVideoVocabulary> {
  const data = await requestApi<{ vocabulary: AdminVideoVocabulary }>(
    `/api/admin/videos/${videoId}/vocabulary`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
  return data.vocabulary
}

export async function updateAdminVideoVocabularyApi(
  vocabularyId: number,
  payload: VideoVocabularyPatchPayload,
): Promise<AdminVideoVocabulary> {
  const data = await requestApi<{ vocabulary: AdminVideoVocabulary }>(
    `/api/admin/video-vocabulary/${vocabularyId}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  )
  return data.vocabulary
}

export async function deleteAdminVideoVocabularyApi(vocabularyId: number): Promise<void> {
  await requestApi<{ deleted: boolean }>(
    `/api/admin/video-vocabulary/${vocabularyId}`,
    { method: 'DELETE' },
  )
}

export async function listAdminUsersApi(params: {
  search?: string
  role?: 'learner' | 'admin' | ''
  limit?: number
  offset?: number
} = {}): Promise<AdminUserListResult> {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.role) query.set('role', params.role)
  query.set('limit', String(params.limit ?? 100))
  query.set('offset', String(params.offset ?? 0))
  return requestApi<AdminUserListResult>(`/api/admin/users?${query.toString()}`)
}

export async function updateAdminUserApi(
  userId: number,
  payload: AdminUserPatchPayload,
): Promise<AdminManagedUser> {
  const data = await requestApi<{ user: AdminManagedUser }>(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return data.user
}

export async function getAdminStatsOverviewApi(): Promise<AdminStatsOverview> {
  const data = await requestApi<{ overview: AdminStatsOverview }>('/api/admin/stats/overview')
  return data.overview
}

export async function getAdminStatsTrendApi(days = 14): Promise<AdminDayTrend[]> {
  const data = await requestApi<{ trend: AdminDayTrend[] }>(`/api/admin/stats/trend?days=${days}`)
  return data.trend
}

export async function getAdminLessonStatsApi(): Promise<{
  stages: AdminStageStat[]
  lessons: AdminLessonStat[]
}> {
  const data = await requestApi<{ stages: AdminStageStat[]; lessons: AdminLessonStat[] }>(
    '/api/admin/stats/lessons',
  )
  return data
}

export async function getAdminContentStatsApi(): Promise<AdminContentStats> {
  const data = await requestApi<{ content: AdminContentStats }>('/api/admin/stats/content')
  return data.content
}

export async function listAdminInactiveUsersApi(
  days = 7,
  limit = 50,
): Promise<AdminInactiveUser[]> {
  const data = await requestApi<{ users: AdminInactiveUser[] }>(
    `/api/admin/stats/inactive-users?days=${days}&limit=${limit}`,
  )
  return data.users
}
