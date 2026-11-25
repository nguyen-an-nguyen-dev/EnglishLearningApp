import assert from 'node:assert/strict'
import test from 'node:test'
import { buddyLessonToOpen } from './buddyLessonNavigation'

test('open starts the lesson even with a spotlight target', () => {
  assert.equal(buddyLessonToOpen({ lessonId: 12, mode: 'open', highlight: 'lesson:12' }), 12)
})

test('reveal never starts the lesson', () => {
  assert.equal(buddyLessonToOpen({ lessonId: 12, mode: 'reveal', highlight: 'lesson:12' }), undefined)
  assert.equal(buddyLessonToOpen({ lessonId: 12, mode: 'reveal' }), undefined)
})
