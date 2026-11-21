import assert from 'node:assert/strict'
import test from 'node:test'
import type { RankingEntry } from '../types/community'
import { BOARD_PREVIEW_SIZE, previewBoard } from './leaderboardPreview'

function board(count: number): RankingEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    rank: index + 1,
    userId: index + 1,
    name: `Learner ${index + 1}`,
    avatar: null,
    xp: 0,
    race_points: (count - index) * 10,
  }))
}

test('a full board keeps only the six leaders and six tail learners', () => {
  const preview = previewBoard(board(25))
  assert.equal(preview.top.length, BOARD_PREVIEW_SIZE)
  assert.equal(preview.bottom.length, BOARD_PREVIEW_SIZE)
  assert.deepEqual(preview.top.map((e) => e.rank), [1, 2, 3, 4, 5, 6])
  assert.deepEqual(preview.bottom.map((e) => e.rank), [20, 21, 22, 23, 24, 25])
  assert.equal(preview.hiddenCount, 13)
})

test('the blocks never overlap or repeat a learner', () => {
  const preview = previewBoard(board(25))
  const ids = [...preview.top, ...preview.bottom].map((e) => e.userId)
  assert.equal(new Set(ids).size, ids.length)
})

test('a small board is shown in full without duplicates or a hidden gap', () => {
  for (const total of [1, 5, 6, 7, 10, 12]) {
    const preview = previewBoard(board(total))
    const ids = [...preview.top, ...preview.bottom].map((e) => e.userId)
    assert.equal(new Set(ids).size, total, `total ${total}`)
    assert.equal(preview.hiddenCount, 0, `total ${total}`)
  }
})

test('an empty board yields two empty blocks', () => {
  const preview = previewBoard([])
  assert.deepEqual(preview.top, [])
  assert.deepEqual(preview.bottom, [])
  assert.equal(preview.hiddenCount, 0)
  assert.equal(preview.me, null)
  assert.equal(preview.meInMiddle, false)
})

test('the signed-in learner is found and flagged when hidden in the middle', () => {
  const middle = previewBoard(board(25), 12)
  assert.equal(middle.me?.userId, 12)
  assert.equal(middle.meInMiddle, true)

  const visible = previewBoard(board(25), 2)
  assert.equal(visible.me?.userId, 2)
  assert.equal(visible.meInMiddle, false)

  const bottom = previewBoard(board(25), 24)
  assert.equal(bottom.me?.userId, 24)
  assert.equal(bottom.meInMiddle, false)
})

test('an unknown user id never produces a phantom middle row', () => {
  const preview = previewBoard(board(25), 999)
  assert.equal(preview.me, null)
  assert.equal(preview.meInMiddle, false)
})
