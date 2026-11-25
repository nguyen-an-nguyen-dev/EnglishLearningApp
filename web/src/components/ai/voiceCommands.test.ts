import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSpoken, routeVoiceCommand } from './voiceCommands.ts'

describe('normalizeSpoken', () => {
  test('drops Vietnamese accents, punctuation and casing', () => {
    assert.equal(normalizeSpoken('Mở Bảng Xếp Hạng!'), 'mo bang xep hang')
    assert.equal(normalizeSpoken('Ôn tập'), 'on tap')
    assert.equal(normalizeSpoken('đấu trường'), 'dau truong')
  })

  test('collapses whitespace and strips every punctuation mark', () => {
    assert.equal(normalizeSpoken('  chuyen   sang   video?!  '), 'chuyen sang video')
    assert.equal(normalizeSpoken('1v1, di!'), '1v1 di')
    assert.equal(normalizeSpoken(''), '')
  })
})

describe('routeVoiceCommand', () => {
  test('a bare destination is claimed locally', () => {
    assert.deepEqual(routeVoiceCommand('bảng xếp hạng'), { kind: 'tab', tab: 'rankings' })
    assert.deepEqual(routeVoiceCommand('Mở bảng xếp hạng'), { kind: 'tab', tab: 'rankings' })
    assert.deepEqual(routeVoiceCommand('xếp hạng đi'), { kind: 'tab', tab: 'rankings' })
    assert.deepEqual(routeVoiceCommand('cho mình xem xếp hạng'), { kind: 'tab', tab: 'rankings' })
    assert.deepEqual(routeVoiceCommand('đấu trường'), { kind: 'tab', tab: 'compete' })
    assert.deepEqual(routeVoiceCommand('vào gara'), { kind: 'tab', tab: 'shop' })
    assert.deepEqual(routeVoiceCommand('dịch tài liệu'), { kind: 'tab', tab: 'translate' })
    assert.deepEqual(routeVoiceCommand('học qua video'), { kind: 'tab', tab: 'videos' })
    assert.deepEqual(routeVoiceCommand('hồ sơ'), { kind: 'tab', tab: 'profile' })
    assert.deepEqual(routeVoiceCommand('lộ trình'), { kind: 'tab', tab: 'study' })
  })

  test('review is the profile session, not a tab', () => {
    assert.deepEqual(routeVoiceCommand('ôn tập'), { kind: 'review' })
    assert.deepEqual(routeVoiceCommand('mở ôn tập'), { kind: 'review' })
    assert.deepEqual(routeVoiceCommand('bài cần ôn'), { kind: 'review' })
    assert.deepEqual(routeVoiceCommand('tới lịch ôn rồi'), { kind: 'review' })
  })

  test('real questions go to the model instead of jumping screens', () => {
    assert.equal(routeVoiceCommand('hôm nay mình nên học gì?'), null)
    assert.equal(routeVoiceCommand('dịch giúp mình câu này sang tiếng anh'), null)
    assert.equal(routeVoiceCommand('tại sao mình sai câu này'), null)
    assert.equal(routeVoiceCommand('hạng của mình'), null)
    assert.equal(routeVoiceCommand('Ôn tập?'), null)
    assert.equal(routeVoiceCommand(''), null)
    assert.equal(routeVoiceCommand('   '), null)
  })

  test('a known destination buried in a sentence is not claimed', () => {
    // Naming a screen inside a longer question must reach the coach.
    assert.equal(routeVoiceCommand('bảng xếp hạng tuần này của mình thế nào'), null)
  })

  test('every navigable tab has at least one spoken route', () => {
    const expected = {
      'bxh': 'rankings',
      'dau truong': 'compete',
      'trang dich': 'translate',
      'thu vien video': 'videos',
      'cua hang gara': 'shop',
      'trang ca nhan': 'profile',
      'trang hoc': 'study',
    } as const
    for (const [phrase, tab] of Object.entries(expected)) {
      assert.deepEqual(routeVoiceCommand(phrase), { kind: 'tab', tab }, phrase)
    }
  })

  test('accent-insensitive and prefix plus suffix forms are understood', () => {
    assert.deepEqual(routeVoiceCommand('mo Bang xep hang NHA'), { kind: 'tab', tab: 'rankings' })
    assert.deepEqual(routeVoiceCommand('dua minh toi cua hang gara nhe'), { kind: 'tab', tab: 'shop' })
    assert.deepEqual(routeVoiceCommand('chuyen sang lo trinh hoc'), { kind: 'tab', tab: 'study' })
  })

  test('unknown words never open a screen', () => {
    assert.equal(routeVoiceCommand('mo cai gi do'), null)
    assert.equal(routeVoiceCommand('tro choi'), null)
    assert.equal(routeVoiceCommand('?!'), null)
    assert.equal(routeVoiceCommand('constructor'), null)
  })
})

test('lesson ordinals and learner-specific questions stay on the backend path', () => {
  assert.equal(routeVoiceCommand('Học bài 5 chặng 2'), null)
  assert.equal(routeVoiceCommand('Bai 5'), null)
  assert.equal(routeVoiceCommand('Open lesson 5 in stage 2'), null)
  assert.equal(routeVoiceCommand('Xếp hạng của tôi'), null)
})

test('opening a video goes through Buddy and opening the library stays local', () => {
  assert.equal(routeVoiceCommand('Mở video nhé'), null)
  assert.equal(routeVoiceCommand('Video ngẫu nhiên'), null)
  assert.deepEqual(routeVoiceCommand('Mở thư viện video'), { kind: 'tab', tab: 'videos' })
})
