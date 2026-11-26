import assert from 'node:assert/strict'
import test from 'node:test'
import {
  phaseAfterCommand,
  phaseAfterEnd,
  shouldReadAloud,
  type VoicePhase,
} from './voiceFlow'

test('a spoken navigation command returns the orb to idle', () => {
  // Regression: the command branch used to return before phase was reset, so
  // "mở bảng xếp hạng" left the orb stuck in thinking and blocked the next tap.
  assert.equal(phaseAfterCommand(), 'idle')
})

test('the recognition engine ending only releases a listening orb', () => {
  const cases: Array<[VoicePhase, VoicePhase]> = [
    ['listening', 'idle'],
    ['thinking', 'thinking'],
    ['idle', 'idle'],
  ]
  for (const [before, after] of cases) {
    assert.equal(phaseAfterEnd(before), after, `from ${before}`)
  }
})

test('only spoken, unmuted questions are read aloud', () => {
  assert.equal(shouldReadAloud(false, true), true)
  assert.equal(shouldReadAloud(true, true), false)
  assert.equal(shouldReadAloud(false, false), false)
  assert.equal(shouldReadAloud(true, false), false)
})
