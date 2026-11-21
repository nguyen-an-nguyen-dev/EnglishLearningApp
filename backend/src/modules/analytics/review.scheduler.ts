import type { ReviewGrade } from './analytics.types';

// Deterministic SM-2 variant. The grade comes from correctness and response
// time, not self-rating, so the numbers are tuned for a quiz; kept pure so the
// same rules run in tests and the browser.

export const REVIEW_SESSION_LIMIT = 7;

export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const INITIAL_EASE = 2.5;

export const LAPSE_MINUTES = 10;

export interface ReviewState {
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

export interface ScheduleResult extends ReviewState {
  dueAt: Date;
}

function clampEase(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Math.min(MAX_EASE, Math.max(MIN_EASE, rounded));
}

export function gradeAnswer(isCorrect: boolean, responseMs: number | null | undefined): ReviewGrade {
  if (!isCorrect) return 'again';
  // A correct answer that took longer than 12 seconds is recalled with effort:
  // it should come back sooner than a fluent one.
  if (responseMs !== null && responseMs !== undefined) {
    if (responseMs <= 4_000) return 'easy';
    if (responseMs > 12_000) return 'hard';
  }
  return 'good';
}

export function initialState(now: Date = new Date()): ScheduleResult {
  return {
    ease: INITIAL_EASE,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    dueAt: now,
  };
}

export function schedule(
  state: ReviewState,
  grade: ReviewGrade,
  now: Date = new Date(),
): ScheduleResult {
  let { ease, intervalDays, repetitions, lapses } = state;
  ease = clampEase(ease);

  if (grade === 'again') {
    lapses += 1;
    repetitions = 0;
    intervalDays = 0;
    ease = clampEase(ease - 0.2);
    return {
      ease,
      intervalDays,
      repetitions,
      lapses,
      dueAt: new Date(now.getTime() + LAPSE_MINUTES * 60_000),
    };
  }

  if (grade === 'hard') {
    ease = clampEase(ease - 0.15);
    // "Hard" must still move forward: an interval that never grows would keep
    // the item in the queue forever, which is the opposite of spaced practice.
    intervalDays = repetitions === 0
      ? 1
      : Math.max(intervalDays + 1, Math.round(intervalDays * 1.2));
  } else if (grade === 'good') {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 3;
    else intervalDays = Math.max(1, Math.round(intervalDays * ease));
  } else {
    ease = clampEase(ease + 0.15);
    if (repetitions === 0) intervalDays = 2;
    else intervalDays = Math.max(2, Math.round(intervalDays * ease * 1.3));
  }

  repetitions += 1;
  // A year is plenty; beyond that the item is effectively known and the queue
  // should spend its slots on fresher mistakes.
  intervalDays = Math.min(365, intervalDays);

  const dueAt = new Date(now);
  dueAt.setDate(dueAt.getDate() + intervalDays);

  return { ease, intervalDays, repetitions, lapses, dueAt };
}

// A lapsed item that keeps coming back outranks a fresh mistake, and older
// overdue items float up.
export function reviewPriority(
  item: { dueAt: Date; lapses: number; mistakeCount: number; repetitions: number },
  now: Date = new Date(),
): number {
  const overdueDays = Math.max(0, (now.getTime() - item.dueAt.getTime()) / 86_400_000);
  const struggle = item.lapses * 2 + item.mistakeCount;
  const freshness = item.repetitions === 0 ? 1.5 : 0;
  return overdueDays + struggle + freshness;
}

export function sortQueue<T extends { dueAt: Date; lapses: number; mistakeCount: number; repetitions: number }>(
  items: T[],
  now: Date = new Date(),
): T[] {
  return [...items].sort((a, b) => reviewPriority(b, now) - reviewPriority(a, now));
}
