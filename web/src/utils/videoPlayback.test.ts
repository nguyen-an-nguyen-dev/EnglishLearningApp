import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatClock,
  normalizeWord,
  playbackDelta,
  subtitleTokens,
  videoCompletionRatio,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  youtubeVideoId,
} from './videoPlayback'

test('YouTube URLs are converted to privacy-friendly embeds', () => {
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=juKd26qkNAw'), 'juKd26qkNAw')
  assert.equal(youtubeVideoId('https://youtu.be/juKd26qkNAw?t=10'), 'juKd26qkNAw')
  assert.equal(
    youtubeEmbedUrl('https://www.youtube.com/watch?v=juKd26qkNAw'),
    'https://www.youtube-nocookie.com/embed/juKd26qkNAw?autoplay=0&controls=0&disablekb=1&fs=0&cc_load_policy=0&iv_load_policy=3&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&vq=hd720',
  )
  assert.equal(
    youtubeThumbnailUrl('https://www.youtube.com/watch?v=juKd26qkNAw'),
    'https://img.youtube.com/vi/juKd26qkNAw/hqdefault.jpg',
  )
  assert.equal(youtubeVideoId('https://example.test/video.mp4'), null)
  assert.equal(youtubeEmbedUrl('https://example.test/video.mp4'), null)
})

test('the practice embed hands no control surface to the viewer', () => {
  const url = youtubeEmbedUrl('https://www.youtube.com/watch?v=juKd26qkNAw') ?? ''
  for (const locked of ['controls=0', 'disablekb=1', 'fs=0', 'cc_load_policy=0', 'iv_load_policy=3', 'vq=hd720']) {
    assert.ok(url.includes(locked), `expected ${locked} in the embed url`)
  }
  assert.ok(!url.includes('controls=1'))
})

test('subtitle tokens match vocabulary regardless of punctuation and case', () => {
  const tokens = subtitleTokens('Actually, to be completely honest, I had no idea.', [
    { word: 'Actually,' },
    { word: 'HONEST,' },
    { word: 'idea' },
  ])
  assert.deepEqual(tokens.map((token) => token.raw), [
    'Actually,', 'to', 'be', 'completely', 'honest,', 'I', 'had', 'no', 'idea.',
  ])
  assert.equal(tokens[0].vocabularyIndex, 0)
  assert.equal(tokens[4].vocabularyIndex, 1)
  assert.equal(tokens[8].vocabularyIndex, 2)
  assert.equal(tokens[1].vocabularyIndex, -1)
  assert.equal(normalizeWord('Natural!'), 'natural')
  assert.deepEqual(subtitleTokens(null, []), [])
})

test('playback deltas ignore seeks and clamp long gaps', () => {
  assert.equal(playbackDelta(10, 11, false), 1)
  assert.equal(playbackDelta(10, 11, true), 0)
  assert.equal(playbackDelta(10, 30, false), 2)
  assert.equal(playbackDelta(11, 10, false), 0)
  assert.equal(playbackDelta(Number.NaN, 10, false), 0)
})

test('watched progress and clocks are formatted for the UI', () => {
  assert.equal(formatClock(0), '0:00')
  assert.equal(formatClock(9), '0:09')
  assert.equal(formatClock(300), '5:00')
  assert.equal(videoCompletionRatio(300, 150), 50)
  assert.equal(videoCompletionRatio(300, 310), 100)
  assert.equal(videoCompletionRatio(0, 20), 0)
})
