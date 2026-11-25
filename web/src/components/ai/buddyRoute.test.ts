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

test('the decision model route wins over the presence of an action', () => {
  assert.equal(isNavigationAnswer({ ...base, route: 'open_prompt' }, 'chat'), false)
  assert.equal(isNavigationAnswer({ ...base, route: 'navigate' }, 'chat'), true)
})

test('older backends fall back to intent plus action', () => {
  assert.equal(isNavigationAnswer(base, 'plan'), true)
  assert.equal(isNavigationAnswer(base, 'chat'), false)
  assert.equal(isNavigationAnswer({ ...base, action: null }, 'plan'), false)
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
