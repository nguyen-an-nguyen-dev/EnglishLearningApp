import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { formatCompact } from './format.ts'

describe('formatCompact', () => {
  test('keeps numbers under a thousand as they are', () => {
    assert.equal(formatCompact(0), '0')
    assert.equal(formatCompact(7), '7')
    assert.equal(formatCompact(860), '860')
    assert.equal(formatCompact(999), '999')
  })

  test('shortens thousands with a single decimal', () => {
    assert.equal(formatCompact(1000), '1k')
    assert.equal(formatCompact(1250), '1,2k')
    assert.equal(formatCompact(12500), '12,5k')
    assert.equal(formatCompact(100000), '100k')
    assert.equal(formatCompact(999400), '999,4k')
  })

  test('never rounds a score up', () => {
    assert.equal(formatCompact(1999), '1,9k')
    assert.equal(formatCompact(999999), '999,9k')
  })

  test('steps up a unit instead of printing 1000k', () => {
    assert.equal(formatCompact(1000000), '1m')
    assert.equal(formatCompact(1250000), '1,2m')
  })

  test('handles billions, negatives and junk input', () => {
    assert.equal(formatCompact(2400000000), '2,4b')
    assert.equal(formatCompact(-1250), '-1,2k')
    assert.equal(formatCompact(Number.NaN), '0')
    assert.equal(formatCompact(Number.POSITIVE_INFINITY), '0')
  })

  test('accepts another decimal separator', () => {
    assert.equal(formatCompact(1250, '.'), '1.2k')
  })
})
