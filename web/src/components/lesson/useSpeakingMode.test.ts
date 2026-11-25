import assert from 'node:assert/strict'
import test from 'node:test'
import { SPEAKING_MUTE_MS, speakingTimeLeft } from './useSpeakingMode'

test('typing mode expires at its shared stored deadline', () => {
  const started = 1000
  const until = started + SPEAKING_MUTE_MS
  assert.equal(SPEAKING_MUTE_MS, 900_000)
  assert.equal(speakingTimeLeft(String(until), started + 5000), 895_000)
  assert.equal(speakingTimeLeft(String(until), until), 0)
  assert.equal(speakingTimeLeft('invalid', started), 0)
  assert.equal(speakingTimeLeft(null, started), 0)
})
