import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchOutcome, remainingSeconds, scoreLabel, winRate } from './arena'

test('match outcome compares the winner with the current user', () => {
  assert.equal(matchOutcome(7, 7), 'win')
  assert.equal(matchOutcome(8, 7), 'lose')
  assert.equal(matchOutcome(null, 7), 'draw')
})

test('arena score formatting is stable for empty and scored rounds', () => {
  assert.equal(scoreLabel(0, 0), '0/0')
  assert.equal(scoreLabel(9, 12), '9/12')
  assert.equal(winRate(0, 0), 0)
  assert.equal(winRate(3, 4), 75)
})

test('round countdown never drops below zero', () => {
  assert.equal(remainingSeconds(1_000, 30_000, 1_000), 30)
  assert.equal(remainingSeconds(1_000, 30_000, 16_000), 15)
  assert.equal(remainingSeconds(1_000, 30_000, 40_000), 0)
})
