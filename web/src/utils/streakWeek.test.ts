import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildStreakWeek } from './streakWeek.ts'

const LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
// Thursday, 19 Nov 2026 — the demo day used by the seeded account.
const THURSDAY = new Date(2026, 10, 19)
const SUNDAY = new Date(2026, 10, 22)

function states(week: ReturnType<typeof buildStreakWeek>): string[] {
  return week.map((day) => day.state)
}

describe('buildStreakWeek', () => {
  test('marks the days already kept and leaves the rest of the week ahead', () => {
    const week = buildStreakWeek({ streak: 28, lastActivityDaysAgo: 0, today: THURSDAY, labels: LABELS })
    assert.deepEqual(states(week), ['done', 'done', 'done', 'done', 'upcoming', 'upcoming', 'upcoming'])
    assert.equal(week[3].isToday, true)
    assert.equal(week[4].isToday, false)
  })

  test('keeps the chain on yesterday and shows today as pending', () => {
    const week = buildStreakWeek({ streak: 4, lastActivityDaysAgo: 1, today: THURSDAY, labels: LABELS })
    assert.deepEqual(states(week), ['done', 'done', 'done', 'pending', 'upcoming', 'upcoming', 'upcoming'])
  })

  test('shows missed days and an empty pending today after a break', () => {
    const week = buildStreakWeek({ streak: 0, lastActivityDaysAgo: null, today: THURSDAY, labels: LABELS })
    assert.deepEqual(states(week), ['missed', 'missed', 'missed', 'pending', 'upcoming', 'upcoming', 'upcoming'])
  })

  test('fills the whole week when the streak is longer than seven days', () => {
    const week = buildStreakWeek({ streak: 10, lastActivityDaysAgo: 0, today: SUNDAY, labels: LABELS })
    assert.deepEqual(states(week), ['done', 'done', 'done', 'done', 'done', 'done', 'done'])
  })

  test('does not paint days before the week even when the chain reaches them', () => {
    const week = buildStreakWeek({ streak: 2, lastActivityDaysAgo: 4, today: THURSDAY, labels: LABELS })
    assert.deepEqual(states(week), ['missed', 'missed', 'missed', 'pending', 'upcoming', 'upcoming', 'upcoming'])
  })

  test('falls back to today when the API payload has no activity field', () => {
    const week = buildStreakWeek({ streak: 2, today: THURSDAY, labels: LABELS })
    assert.deepEqual(states(week), ['missed', 'missed', 'done', 'done', 'upcoming', 'upcoming', 'upcoming'])
  })

  test('clamps a future activity date so later days are not painted early', () => {
    const week = buildStreakWeek({ streak: 2, lastActivityDaysAgo: -1, today: THURSDAY, labels: LABELS })
    assert.deepEqual(states(week), ['missed', 'missed', 'done', 'done', 'upcoming', 'upcoming', 'upcoming'])
  })
})
