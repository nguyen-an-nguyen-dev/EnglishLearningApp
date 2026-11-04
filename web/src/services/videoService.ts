import { requestApi } from './apiClient'
import type {
  CompleteVideoResult,
  SaveWordPayload,
  SavedWord,
  VideoLessonDetail,
  VideoLessonSummary,
} from '../types/video'

export async function getVideosApi(): Promise<VideoLessonSummary[]> {
  const data = await requestApi<{ videos: VideoLessonSummary[] }>('/api/videos')
  return data.videos
}

export async function getVideoApi(videoId: number): Promise<VideoLessonDetail> {
  const data = await requestApi<{ video: VideoLessonDetail }>(`/api/videos/${videoId}`)
  return data.video
}

export async function saveVideoProgressApi(
  videoId: number,
  watchedSeconds: number,
): Promise<CompleteVideoResult> {
  return requestApi<CompleteVideoResult>(`/api/videos/${videoId}/progress`, {
    method: 'POST',
    body: JSON.stringify({ watchedSeconds }),
  })
}

export async function importVideoApi(url: string): Promise<VideoLessonDetail> {
  const data = await requestApi<{ video: VideoLessonDetail }>('/api/videos/import', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
  return data.video
}

export async function deleteVideoApi(videoId: number): Promise<void> {
  await requestApi<{ deleted: boolean }>(`/api/videos/${videoId}`, {
    method: 'DELETE',
  })
}

export async function completeVideoApi(
  videoId: number,
  watchedSeconds: number,
): Promise<CompleteVideoResult> {
  return requestApi<CompleteVideoResult>(`/api/videos/${videoId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ watchedSeconds }),
  })
}

export async function getSavedWordsApi(): Promise<SavedWord[]> {
  const data = await requestApi<{ words: SavedWord[] }>('/api/vocabulary')
  return data.words
}

export async function saveWordApi(payload: SaveWordPayload): Promise<SavedWord> {
  const data = await requestApi<{ word: SavedWord }>('/api/vocabulary', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.word
}

export async function deleteSavedWordApi(word: string): Promise<void> {
  await requestApi<{ deleted: boolean }>(`/api/vocabulary/${encodeURIComponent(word)}`, {
    method: 'DELETE',
  })
}
