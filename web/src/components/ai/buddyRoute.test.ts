import assert from 'node:assert/strict'
import test from 'node:test'
import { isNavigationAnswer, navigationToast } from './buddyRoute'
import type { BuddyAnswer } from '../../types/buddy'

const base: BuddyAnswer = {
  reply: 'Đã mở Bảng xếp hạng cho bạn.',
  followups: [],
  action: { kind: 'open_tab', tab: 'rankings', label: 'Mở bảng xếp hạng' },
  suggestion: null,
}

test('a resolved action navigates even when the route says open_prompt', () => {
  assert.equal(isNavigationAnswer({ ...base, route: 'open_prompt' }), true)
  assert.equal(isNavigationAnswer({ ...base, route: 'navigate' }), true)
})

test('an answer without an action never navigates', () => {
  assert.equal(isNavigationAnswer({ ...base, action: null }), false)
  assert.equal(isNavigationAnswer({ ...base, action: null, route: 'open_prompt' }), false)
  assert.equal(isNavigationAnswer({ ...base, action: null, route: 'navigate' }), false)
})

test('only a short confirmation is used as a toast', () => {
  assert.equal(navigationToast(base, 'Đã mở ngay'), 'Đã mở Bảng xếp hạng cho bạn.')
  assert.equal(navigationToast({ ...base, reply: 'word '.repeat(40) }, 'Đã mở ngay'), 'Đã mở ngay')
})

test('long prerequisite and shop messages survive direct navigation', () => {
  const reply = 'word '.repeat(40).trim()
  const answer: BuddyAnswer = {
    reply, followups: [], suggestion: null, route: 'navigate',
    action: { kind: 'open_lesson', mode: 'reveal', label: 'Chỉ vị trí bài', lessonId: 13 },
  }
  assert.equal(navigationToast(answer, 'Opened'), reply)
  assert.equal(navigationToast({
    ...answer, action: { kind: 'show_shop_item', itemCode: 'shield', label: 'Xem khiên' },
  }, 'Opened'), reply)
})
