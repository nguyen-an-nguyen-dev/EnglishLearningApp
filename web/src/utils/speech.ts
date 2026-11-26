import { synthesizeSpeechApi, type SpeechVoiceLang } from '../services/speechService'

export interface SpeechHandlers {
  signal?: AbortSignal
  onStart?: () => void
  /** Share of the text already spoken, from 0 to 1. */
  onProgress?: (ratio: number) => void
  onEnd?: () => void
  /** Defaults to true. Disable to keep a consistent neural voice. */
  browserFallback?: boolean
}

interface Playback {
  stop: () => void
}

let active: Playback | null = null

/** Stops whatever is playing. Does not call the `onEnd` of the stopped playback. */
export function stopSpeaking(): void {
  const current = active
  active = null
  current?.stop()
}

const LOCALE: Record<SpeechVoiceLang, string> = { en: 'en-US', vi: 'vi-VN' }
const MAX_TTS_CHARS = 500

function splitTtsText(text: string): string[] {
  const parts: string[] = []
  let remaining = text
  while (remaining.length > MAX_TTS_CHARS) {
    const window = remaining.slice(0, MAX_TTS_CHARS + 1)
    const wordBoundary = window.lastIndexOf(' ')
    let end = wordBoundary > 0 ? wordBoundary : MAX_TTS_CHARS
    const last = remaining.charCodeAt(end - 1)
    if (last >= 0xd800 && last <= 0xdbff) end -= 1
    parts.push(remaining.slice(0, end))
    remaining = remaining.slice(end).trimStart()
  }
  if (remaining) parts.push(remaining)
  return parts
}

/**
 * Reads `text` aloud using the backend's neural MP3, with optional browser
 * fallback. Returns false only when there is nothing to read. Progress and
 * end are reported through `handlers`.
 */
export function speakText(text: string, lang: SpeechVoiceLang, handlers: SpeechHandlers = {}): boolean {
  const clean = text.trim()
  if (!clean || typeof window === 'undefined' || handlers.signal?.aborted) return false
  stopSpeaking()

  let finished = false
  let started = false
  let audio: HTMLAudioElement | null = null
  let objectUrl: string | null = null
  let frame = 0
  let timer: number | null = null
  const controller = new AbortController()
  const browserFallback = handlers.browserFallback !== false
  const parts = browserFallback ? [clean] : splitTtsText(clean.replace(/\s+/g, ' '))
  const notifyStarted = () => {
    if (started || finished) return
    started = true
    handlers.onStart?.()
  }

  const releaseAudio = () => {
    cancelAnimationFrame(frame)
    audio?.pause()
    audio = null
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }

  const finish = () => {
    if (finished) return
    finished = true
    releaseAudio()
    if (timer !== null) window.clearInterval(timer)
    if (active === playback) active = null
    handlers.signal?.removeEventListener('abort', stopOnAbort)
    handlers.onEnd?.()
  }

  const stopOnAbort = () => {
    if (active === playback) stopSpeaking()
  }

  const playback: Playback = {
    stop: () => {
      finished = true
      controller.abort()
      releaseAudio()
      if (timer !== null) window.clearInterval(timer)
      handlers.signal?.removeEventListener('abort', stopOnAbort)
      if (browserFallback && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    },
  }

  // Browser fallback. Boundary events drive progress; Safari emits none, so a
  // steady pace of 15 characters per second fills in until the first boundary.
  const speakWithBrowser = () => {
    releaseAudio()
    if (finished) return
    if (!('speechSynthesis' in window)) {
      finish()
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = LOCALE[lang]
    utterance.rate = 0.92
    let boundarySeen = false
    let shown = 0
    const startedAt = performance.now()
    utterance.onboundary = (event) => {
      if (finished) return
      boundarySeen = true
      shown = Math.max(shown, Math.min(clean.length, event.charIndex + Math.max(1, event.charLength)))
      handlers.onProgress?.(shown / clean.length)
    }
    utterance.onend = finish
    utterance.onerror = finish
    utterance.onstart = notifyStarted
    if (handlers.onProgress) {
      timer = window.setInterval(() => {
        if (boundarySeen) return
        const estimate = Math.floor(((performance.now() - startedAt) / 1000) * 15)
        shown = Math.max(shown, Math.min(clean.length, estimate))
        handlers.onProgress?.(shown / clean.length)
      }, 100)
    }
    window.speechSynthesis.speak(utterance)
  }

  const onPlaybackError = browserFallback ? speakWithBrowser : finish
  const run = async (index: number) => {
    let blob: Blob
    try {
      blob = await synthesizeSpeechApi(parts[index], lang, controller.signal, { retryUnavailable: !browserFallback })
    } catch {
      onPlaybackError()
      return
    }
    if (finished) return
    objectUrl = URL.createObjectURL(blob)
    const player = new Audio(objectUrl)
    audio = player
    player.onplaying = notifyStarted
    player.onended = () => {
      if (finished || audio !== player) return
      if (index + 1 === parts.length) {
        finish()
      } else {
        releaseAudio()
        void run(index + 1)
      }
    }
    player.onerror = () => {
      if (audio === player) onPlaybackError()
    }
    const tick = () => {
      if (finished || audio !== player) return
      if (Number.isFinite(player.duration) && player.duration > 0) {
        const progress = Math.min(1, player.currentTime / player.duration)
        handlers.onProgress?.((index + progress) / parts.length)
      }
      frame = requestAnimationFrame(tick)
    }
    try {
      await player.play()
    } catch {
      if (audio === player) onPlaybackError()
      return
    }
    if (!finished && audio === player) frame = requestAnimationFrame(tick)
  }

  active = playback
  handlers.signal?.addEventListener('abort', stopOnAbort, { once: true })
  void run(0)
  return true
}

/** Pronounces a single English word, e.g. from a vocabulary card. */
export function speakEnglish(value: string): void {
  speakText(value.replace(/[^a-zA-Z' ]/g, ''), 'en')
}
