import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INITIAL_EASE,
  MAX_EASE,
  MIN_EASE,
  gradeAnswer,
  initialState,
  reviewPriority,
  schedule,
  sortQueue,
  REVIEW_SESSION_LIMIT,
} from '../src/modules/analytics/review.scheduler';

const NOW = new Date('2026-11-20T08:00:00.000Z');

function daysFromNow(date: Date): number {
  return Math.round((date.getTime() - NOW.getTime()) / 86_400_000);
}

test('the priority ranking puts the most forgotten words first', () => {
  const day = 86_400_000;
  const now = NOW;
  const old = { dueAt: new Date(now.getTime() - 5 * day), lapses: 0, mistakeCount: 1, repetitions: 2 };
  const fresh = { dueAt: now, lapses: 0, mistakeCount: 1, repetitions: 0 };
  const stubborn = { dueAt: now, lapses: 4, mistakeCount: 6, repetitions: 0 };
  const mid = { dueAt: new Date(now.getTime() - day), lapses: 2, mistakeCount: 3, repetitions: 1 };

  // The shortlist is now `ORDER BY reviewPriority DESC LIMIT 7` in SQL. This
  // asserts the ranking that query mirrors: a repeatedly-forgotten item beats
  // one that is overdue but was recalled twice.
  const ranked = sortQueue([old, fresh, stubborn, mid], now);
  assert.equal(ranked[0], stubborn, 'the stubborn item leads');
  assert.equal(ranked[1], mid);
  assert.ok(ranked.indexOf(old) > ranked.indexOf(mid), 'being old alone does not win');
  assert.equal(REVIEW_SESSION_LIMIT, 7, 'the session cap stays a handful');
});

test('a correct fast answer is graded easy and earns the longest first interval', () => {
  const easy = schedule(initialState(NOW), gradeAnswer(true, 1_200), NOW);
  const good = schedule(initialState(NOW), gradeAnswer(true, 7_000), NOW);
  const hard = schedule(initialState(NOW), gradeAnswer(true, 20_000), NOW);

  assert.equal(gradeAnswer(true, 1_200), 'easy');
  assert.equal(gradeAnswer(true, 7_000), 'good');
  assert.equal(gradeAnswer(true, 20_000), 'hard');
  assert.ok(easy.intervalDays > good.intervalDays);
  assert.ok(good.intervalDays >= hard.intervalDays);
});

test('a consistently easy item pulls ahead of a consistently hard one', () => {
  let easy = initialState(NOW);
  let good = initialState(NOW);
  let hard = initialState(NOW);
  for (let index = 0; index < 4; index += 1) {
    easy = schedule(easy, 'easy', NOW);
    good = schedule(good, 'good', NOW);
    hard = schedule(hard, 'hard', NOW);
    assert.ok(easy.intervalDays > good.intervalDays, `round ${index}: easy ahead`);
    // The first review schedules both at one day; from the second on, ease and
    // the growth rule must separate them.
    if (index > 0) {
      assert.ok(good.intervalDays > hard.intervalDays, `round ${index}: good ahead of hard`);
    }
  }
  // Hard still advances, just slowly: it must never freeze at one day.
  assert.ok(hard.intervalDays >= 3);
});

test('a wrong answer always grades again, whatever the speed', () => {
  assert.equal(gradeAnswer(false, 500), 'again');
  assert.equal(gradeAnswer(false, null), 'again');
});

test('the interval ladder is 1 day, 3 days, then multiplied by ease', () => {
  let state = initialState(NOW);
  assert.equal(state.ease, INITIAL_EASE);

  state = schedule(state, 'good', NOW);
  assert.equal(state.intervalDays, 1);
  assert.equal(state.repetitions, 1);

  state = schedule(state, 'good', NOW);
  assert.equal(state.intervalDays, 3);
  assert.equal(state.repetitions, 2);

  state = schedule(state, 'good', NOW);
  assert.equal(state.intervalDays, 8); // 3 * 2.5 = 7.5, rounded
  assert.equal(state.repetitions, 3);
});

test('a lapse resets the interval but keeps the history', () => {
  let state = schedule(schedule(initialState(NOW), 'good', NOW), 'good', NOW);
  assert.equal(state.intervalDays, 3);

  const lapsed = schedule(state, 'again', NOW);
  assert.equal(lapsed.intervalDays, 0);
  assert.equal(lapsed.repetitions, 0);
  assert.equal(lapsed.lapses, 1);
  assert.ok(lapsed.ease < state.ease);
  assert.equal(lapsed.dueAt.getTime() - NOW.getTime(), 10 * 60_000);
});

test('ease never leaves its floor or ceiling', () => {
  let state = initialState(NOW);
  for (let index = 0; index < 20; index += 1) state = schedule(state, 'again', NOW);
  assert.equal(state.ease, MIN_EASE);

  state = initialState(NOW);
  for (let index = 0; index < 20; index += 1) state = schedule(state, 'easy', NOW);
  assert.equal(state.ease, MAX_EASE);
});

test('intervals are capped at a year so the queue keeps moving', () => {
  let state = initialState(NOW);
  for (let index = 0; index < 12; index += 1) state = schedule(state, 'easy', NOW);
  assert.ok(state.intervalDays <= 365);
});

test('a due date lands the expected number of days later', () => {
  const state = schedule(schedule(initialState(NOW), 'good', NOW), 'good', NOW);
  assert.equal(daysFromNow(state.dueAt), 3);
});

test('a lapsed, overdue, never-recalled item outranks a fresh easy one', () => {
  const struggling = { dueAt: new Date(NOW.getTime() - 2 * 86_400_000), lapses: 3, mistakeCount: 5, repetitions: 0 };
  const fresh = { dueAt: new Date(NOW.getTime() + 5 * 86_400_000), lapses: 0, mistakeCount: 1, repetitions: 2 };
  assert.ok(reviewPriority(struggling, NOW) > reviewPriority(fresh, NOW));

  const sorted = sortQueue([fresh, struggling], NOW);
  assert.equal(sorted[0], struggling);
});

test('two items due at the same time fall back to their mistake count', () => {
  const due = new Date(NOW.getTime() - 86_400_000);
  const few = { dueAt: due, lapses: 0, mistakeCount: 1, repetitions: 0 };
  const many = { dueAt: due, lapses: 0, mistakeCount: 6, repetitions: 0 };
  assert.deepEqual(sortQueue([few, many], NOW), [many, few]);
});
