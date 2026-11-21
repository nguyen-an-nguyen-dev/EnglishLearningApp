/**
 * Spoken commands that map to one screen, resolved on the device.
 *
 * The assistant model is good at open questions ("hôm nay học gì?") but slow for
 * "mở bảng xếp hạng". A learner who says that expects the screen to open now, so
 * the obvious short commands are matched locally and never reach the network.
 * Anything that is not a plain destination falls through to the model.
 */

export type VoiceTab =
  | 'study'
  | 'videos'
  | 'translate'
  | 'compete'
  | 'rankings'
  | 'shop'
  | 'profile'

export type VoiceCommand =
  | { kind: 'tab'; tab: VoiceTab }
  | { kind: 'review' }

/** Lower-case, accent-free, punctuation-free: dictation is messy. */
export function normalizeSpoken(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Longest first, so "đi tới" is consumed before "đi".
const PREFIXES = [
  'dua minh toi',
  'dua toi toi',
  'cho minh xem',
  'cho toi xem',
  'chuyen sang',
  'chuyen qua',
  'minh muon',
  'toi muon',
  'di toi',
  'di den',
  'mo ra',
  'mo trang',
  'mo man',
  'mo',
  'vao',
  'di',
  'toi',
  'qua',
  'xem',
  'chuyen',
  'hien',
  'bat',
].sort((a, b) => b.length - a.length)

const SUFFIXES = [
  'giup minh',
  'giup toi',
  'ho minh',
  'luon',
  'voi',
  'nhe',
  'nha',
  'nao',
  'roi',
  'di',
  'a',
].sort((a, b) => b.length - a.length)

const ROUTES: Record<string, VoiceCommand> = {}

function add(phrase: string, command: VoiceCommand): void {
  ROUTES[normalizeSpoken(phrase)] = command
}

// Review is the profile button's session, not a tab.
for (const phrase of [
  'ôn tập', 'ôn lại', 'ôn bài', 'bài ôn tập', 'bài cần ôn', 'phiên ôn tập',
  'ôn từ', 'tới lịch ôn', 'lịch ôn', 'review',
]) add(phrase, { kind: 'review' })

for (const phrase of ['bảng xếp hạng', 'xếp hạng', 'bảng hạng', 'league', 'bxh', 'hạng của mình']) {
  add(phrase, { kind: 'tab', tab: 'rankings' })
}
for (const phrase of ['thi đua', 'đấu trường', 'đấu từ vựng', 'vào trận', '1v1', 'đấu 1v1']) {
  add(phrase, { kind: 'tab', tab: 'compete' })
}
for (const phrase of ['dịch', 'dịch tài liệu', 'trang dịch', 'translate']) {
  add(phrase, { kind: 'tab', tab: 'translate' })
}
for (const phrase of ['video', 'học qua video', 'thư viện video']) {
  add(phrase, { kind: 'tab', tab: 'videos' })
}
for (const phrase of ['gara', 'cửa hàng', 'shop', 'mua phụ tùng', 'cửa hàng gara']) {
  add(phrase, { kind: 'tab', tab: 'shop' })
}
for (const phrase of ['hồ sơ', 'trang cá nhân', 'profile', 'tài khoản', 'thông tin cá nhân']) {
  add(phrase, { kind: 'tab', tab: 'profile' })
}
for (const phrase of ['lộ trình', 'học tập', 'trang học', 'bài học', 'roadmap', 'lộ trình học']) {
  add(phrase, { kind: 'tab', tab: 'study' })
}

function stripEdges(words: string[]): string[] {
  let current = words
  let changed = true

  while (changed && current.length > 0) {
    changed = false
    for (const prefix of PREFIXES) {
      const prefixWords = prefix.split(' ')
      if (current.length > prefixWords.length
        && prefixWords.every((word, index) => current[index] === word)) {
        current = current.slice(prefixWords.length)
        changed = true
        break
      }
    }
    if (changed) continue
    for (const suffix of SUFFIXES) {
      const suffixWords = suffix.split(' ')
      const start = current.length - suffixWords.length
      if (start > 0 && suffixWords.every((word, index) => current[start + index] === word)) {
        current = current.slice(0, start)
        changed = true
        break
      }
    }
  }

  return current
}

/**
 * The spoken destination, or `null` when the sentence is a real question.
 * Only short, exact destinations are claimed, so "dịch giúp mình câu này"
 * still goes to the model instead of jumping to the translate screen.
 */
export function routeVoiceCommand(text: string): VoiceCommand | null {
  const normalized = normalizeSpoken(text)
  if (!normalized) return null

  const direct = ROUTES[normalized]
  if (direct) return direct

  const trimmed = stripEdges(normalized.split(' ')).join(' ')
  return ROUTES[trimmed] ?? null
}
