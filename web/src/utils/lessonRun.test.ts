import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  LESSON_MAX_HEARTS,
  advanceLessonRun,
  clearedQuestionCount,
  loseHeart,
  startLessonRun,
} from './lessonRun'

const QUESTIONS = [{ id: 1 }, { id: 2 }, { id: 3 }]

function run(...actions: Array<[boolean, boolean?]>): ReturnType<typeof startLessonRun<{ id: number }>> {
  return actions.reduce(
    (current, [isCorrect, missed]) => {
      const spent = missed === undefined ? !isCorrect : missed
      return advanceLessonRun(spent ? loseHeart(current) : current, isCorrect)
    },
    startLessonRun(QUESTIONS),
  )
}

test('a run starts with every question queued once and three hearts', () => {
  const started = startLessonRun(QUESTIONS)
  assert.equal(started.hearts, LESSON_MAX_HEARTS)
  assert.equal(started.status, 'active')
  assert.deepEqual(started.queue.map((entry) => entry.question.id), [1, 2, 3])
  assert.deepEqual(started.queue.map((entry) => entry.attempt), [1, 1, 1])
  assert.equal(clearedQuestionCount(started), 0)
})

test('a miss spends the heart immediately, before the learner advances', () => {
  const spent = loseHeart(startLessonRun(QUESTIONS))
  assert.equal(spent.hearts, LESSON_MAX_HEARTS - 1)
  // The run is still on the same question: the verdict is read first.
  assert.equal(spent.status, 'active')
  assert.deepEqual(spent.queue.map((entry) => entry.question.id), [1, 2, 3])
  assert.equal(clearedQuestionCount(spent), 0)
})

test('advancing past a miss brings the question back after a short gap', () => {
  const next = run([false])
  assert.equal(next.hearts, LESSON_MAX_HEARTS - 1)
  assert.equal(next.status, 'active')
  // Q1 waits behind the next few questions instead of the whole lesson.
  assert.deepEqual(next.queue.map((entry) => entry.question.id), [2, 3, 1])
  assert.equal(next.queue.at(-1)?.attempt, 2)
  assert.equal(clearedQuestionCount(next), 0)
})

test('the gap shrinks near the end so a repeat always comes back', () => {
  // Only one question left after the miss: the repeat returns immediately after it.
  const oneLeft = advanceLessonRun(loseHeart(startLessonRun([{ id: 1 }, { id: 2 }])), false)
  assert.deepEqual(oneLeft.queue.map((entry) => entry.question.id), [2, 1])
  assert.equal(oneLeft.queue[1].attempt, 2)
})

test('a repeat that is answered correctly clears the question for good', () => {
  const done = run([false], [true], [true], [true])
  assert.equal(done.status, 'cleared')
  assert.deepEqual(done.queue, [])
  assert.equal(clearedQuestionCount(done), QUESTIONS.length)
  assert.equal(done.hearts, LESSON_MAX_HEARTS - 1)
})

test('the last heart still lets the verdict be read, then ends the run', () => {
  let current = startLessonRun(QUESTIONS)
  for (let miss = 0; miss < LESSON_MAX_HEARTS; miss += 1) {
    current = loseHeart(current)
    assert.equal(current.status, 'active', 'the failure waits for the advance')
    current = advanceLessonRun(current, false)
  }

  assert.equal(current.status, 'failed')
  assert.equal(current.hearts, 0)
  // A failed run is discarded, never resumed with a partial queue.
  assert.equal(current.queue.length, QUESTIONS.length)
  assert.equal(clearedQuestionCount(current), 0)
})

test('losing a heart never goes below zero and is ignored once the run ended', () => {
  const failed = { ...startLessonRun(QUESTIONS), hearts: 0, status: 'failed' as const }
  assert.deepEqual(loseHeart(failed), failed)
})

test('answers after a run has ended do nothing', () => {
  const cleared = run([true], [true], [true])
  assert.equal(cleared.status, 'cleared')
  assert.deepEqual(advanceLessonRun(cleared, false), cleared)
})

test('an empty lesson never enters the active state', () => {
  const empty = startLessonRun<{ id: number }>([])
  assert.equal(empty.status, 'cleared')
  assert.equal(clearedQuestionCount(empty), 0)
})
