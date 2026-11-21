import { HttpError } from '../../middleware/error-handler';
import type {
  ReviewAnswerResult,
  ReviewGrade,
  ReviewItem,
  ReviewQueue,
} from './analytics.types';
import * as repo from './review.repository';
import { gradeAnswer } from './review.scheduler';

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Damerau (restricted) distance: a transposition such as "langauge" for
  // "language" is one slip of the fingers, not two separate edits.
  const rows = a.length + 1;
  const cols = b.length + 1;
  const grid: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      grid[i][j] = Math.min(
        grid[i - 1][j] + 1,
        grid[i][j - 1] + 1,
        grid[i - 1][j - 1] + cost,
      );
      if (
        i > 1
        && j > 1
        && a[i - 1] === b[j - 2]
        && a[i - 2] === b[j - 1]
      ) {
        grid[i][j] = Math.min(grid[i][j], grid[i - 2][j - 2] + 1);
      }
    }
  }
  return grid[a.length][b.length];
}

/**
 * Typed recall is unforgiving: one transposed letter should not count as a
 * forgotten word. Short words must match exactly, longer ones tolerate a small
 * edit distance that scales with their length.
 */
export function isReviewAnswerCorrect(expected: string, submitted: string): boolean {
  const target = normalize(expected);
  const given = normalize(submitted);
  if (!target || !given) return false;
  if (target === given) return true;
  if (target.length <= 4) return false;
  const tolerance = target.length >= 10 ? 2 : 1;
  return levenshtein(target, given) <= tolerance;
}

export async function getQueue(userId: number): Promise<ReviewQueue> {
  const [due, upcoming, counts] = await Promise.all([
    // Ranking and the cap live in SQL: a learner with thousands of due items
    // still reads only the handful most worth revisiting.
    repo.listDueShortlist(userId),
    repo.listUpcoming(userId, 10),
    repo.getCounts(userId),
  ]);
  return { due, upcoming, counts };
}

export async function sync(userId: number): Promise<{ added: number; counts: ReviewQueue['counts'] }> {
  const added = await repo.syncHistoricalMistakes(userId);
  const counts = await repo.getCounts(userId);
  return { added, counts };
}

export async function addItem(
  userId: number,
  kind: ReviewItem['kind'],
  refId: number,
): Promise<void> {
  if (!Number.isInteger(refId) || refId < 1) {
    throw new HttpError(422, 'Validation failed', ['ref_id must be a positive integer.']);
  }
  await repo.enqueue(userId, kind, refId, 'manual');
}

export interface AnswerReviewInput {
  answer: string;
  responseMs?: number;
}

export async function answerItem(
  userId: number,
  itemId: number,
  input: AnswerReviewInput,
): Promise<ReviewAnswerResult> {
  const [item] = await repo.hydrateByIds(userId, [itemId]);
  if (!item) throw new HttpError(404, 'Review item not found.');

  let expected = '';
  let explanation: string | null = null;

  if (item.kind === 'word') {
    if (!item.word) throw new HttpError(404, 'The word for this review no longer exists.');
    expected = item.word.word;
    explanation = item.word.explanation;
  } else {
    const correct = await repo.getCorrectAnswer(item.ref_id);
    if (!correct) throw new HttpError(404, 'This question has no answer key.');
    expected = correct.answer_text;
    explanation = item.question?.explanation ?? null;
  }

  const isCorrect = isReviewAnswerCorrect(expected, input.answer);
  const responseMs = typeof input.responseMs === 'number' && Number.isFinite(input.responseMs)
    ? Math.max(0, Math.min(input.responseMs, 10 * 60_000))
    : null;
  const grade: ReviewGrade = gradeAnswer(isCorrect, responseMs);
  const next = await repo.recordGrade(itemId, grade, responseMs);

  return {
    is_correct: isCorrect,
    correct_answer: expected,
    explanation,
    grade,
    next_due_at: next.dueAt.toISOString(),
    interval_days: next.intervalDays,
    repetitions: next.repetitions,
    ease: next.ease,
  };
}
