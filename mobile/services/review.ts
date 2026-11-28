import { request } from './api';

export type DueReviewItem = {
  id: number;
  kind: 'word' | 'question';
  word: { translation: string; part_of_speech: string; example_vi: string } | null;
  question: { prompt: string; lesson_title: string; answers: Array<{ id: number; answer_text: string }> } | null;
};

export interface ReviewVerdict {
  is_correct: boolean;
  correct_answer: string;
  explanation: string | null;
  interval_days: number;
}

export async function loadDueReview(): Promise<DueReviewItem[]> {
  const { due } = await request<{ due: DueReviewItem[] }>('/review');
  return due.filter((item) => item.kind === 'word' ? item.word !== null : item.question !== null);
}

export function gradeReviewItem(id: number, answer: string, responseMs: number): Promise<ReviewVerdict> {
  return request<ReviewVerdict>(`/review/items/${id}/answer`, {
    method: 'POST',
    body: JSON.stringify({ answer, response_ms: responseMs }),
  });
}
