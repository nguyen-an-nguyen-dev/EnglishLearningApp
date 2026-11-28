import { requestApi } from './apiClient'
import type {
  ReviewAnswerResult,
  ReviewQueue,
} from '../types/analytics'

export async function getReviewQueueApi(): Promise<ReviewQueue> {
  return requestApi<ReviewQueue>('/api/review')
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
