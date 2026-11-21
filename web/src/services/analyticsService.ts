import { requestApi } from './apiClient'
import type {
  LearningAnalytics,
  ReviewAnswerResult,
  ReviewItem,
  ReviewQueue,
} from '../types/analytics'

export async function getAnalyticsApi(): Promise<LearningAnalytics> {
  return requestApi<LearningAnalytics>('/api/analytics')
}

export async function getReviewQueueApi(): Promise<ReviewQueue> {
  return requestApi<ReviewQueue>('/api/review')
}

/** Backfills the queue from past mistakes. Idempotent: existing items keep their schedule. */
export async function syncReviewQueueApi(): Promise<{ added: number; counts: ReviewQueue['counts'] }> {
  return requestApi<{ added: number; counts: ReviewQueue['counts'] }>('/api/review/sync', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function addReviewItemApi(kind: ReviewItem['kind'], refId: number): Promise<ReviewQueue> {
  return requestApi<ReviewQueue>('/api/review/items', {
    method: 'POST',
    body: JSON.stringify({ kind, ref_id: refId }),
  })
}

export async function answerReviewItemApi(
  itemId: number,
  answer: string,
  responseMs?: number,
): Promise<ReviewAnswerResult> {
  return requestApi<ReviewAnswerResult>(`/api/review/items/${itemId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ answer, response_ms: responseMs }),
  })
}
