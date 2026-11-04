export interface SubtitleToken {
  raw: string
  clean: string
  vocabularyIndex: number
}

export function youtubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:[^#]*&)?v=)([\w-]{6,})/i,
    /(?:youtube\.com\/embed\/)([\w-]{6,})/i,
    /(?:youtube-nocookie\.com\/embed\/)([\w-]{6,})/i,
    /(?:youtu\.be\/)([\w-]{6,})/i,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

/**
 * The practice player is a listening stage, not a video browser: no controls, no
 * keyboard scrubbing, no fullscreen, no captions, no related videos, no annotations.
 * Playback is driven by the segment script, so every escape hatch is closed.
 */
export const YOUTUBE_LOCKED_VARS = {
  autoplay: 0,
  controls: 0,
  disablekb: 1,
  fs: 0,
  cc_load_policy: 0,
  iv_load_policy: 3,
  rel: 0,
  modestbranding: 1,
  playsinline: 1,
  enablejsapi: 1,
  vq: 'hd720',
} satisfies Record<string, string | number>

export function youtubeEmbedUrl(url: string): string | null {
  const id = youtubeVideoId(url)
  if (!id) return null
  const query = Object.entries(YOUTUBE_LOCKED_VARS)
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  return `https://www.youtube-nocookie.com/embed/${id}?${query}`
}

export function youtubeThumbnailUrl(url: string): string | null {
  const id = youtubeVideoId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

export function normalizeWord(value: string): string {
  return value
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9']/g, '')
}

export function subtitleTokens(
  text: string | null,
  vocabulary: Array<{ word: string }>,
): SubtitleToken[] {
  if (!text) return []
  const indexByWord = new Map<string, number>()
  vocabulary.forEach((entry, index) => {
    const key = normalizeWord(entry.word)
    if (key && !indexByWord.has(key)) indexByWord.set(key, index)
  })

  return (text.match(/\S+/g) ?? []).map((raw) => {
    const clean = normalizeWord(raw)
    return { raw, clean, vocabularyIndex: indexByWord.get(clean) ?? -1 }
  })
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function playbackDelta(
  previousTime: number,
  nextTime: number,
  seeked: boolean,
): number {
  if (seeked || !Number.isFinite(previousTime) || !Number.isFinite(nextTime)) return 0
  const delta = nextTime - previousTime
  if (delta <= 0) return 0
  return Math.min(delta, 2)
}

export function videoCompletionRatio(durationSeconds: number, watchedSeconds: number): number {
  if (durationSeconds <= 0) return 0
  return Math.min(100, Math.round((watchedSeconds / durationSeconds) * 100))
}
