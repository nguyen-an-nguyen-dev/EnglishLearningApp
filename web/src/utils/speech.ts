import { synthesizeSpeechApi, type SpeechVoiceLang } from '../services/speechService'

export interface SpeechHandlers {
  /** Share of the text already spoken, from 0 to 1. */
  onProgress?: (ratio: number) => void
  onEnd?: () => void
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

/**
 * Reads `text` aloud. The neural MP3 from the backend is preferred; when it is
 * unavailable the browser voice takes over. Returns false only when there is
 * nothing to read. Progress and end are reported through `handlers`.
 */
export function speakText(text: string, lang: SpeechVoiceLang, handlers: SpeechHandlers = {}): boolean {
  const clean = text.trim()
  if (!clean || typeof window === 'undefined') return false
  stopSpeaking()

  let finished = false
  let audio: HTMLAudioElement | null = null
  let objectUrl: string | null = null
  let frame = 0
  let timer: number | null = null
  const controller = new AbortController()

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
    handlers.onEnd?.()
  }

  const playback: Playback = {
    stop: () => {
      finished = true
      controller.abort()
      releaseAudio()
      if (timer !== null) window.clearInterval(timer)
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
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

  const run = async () => {
    let blob: Blob
    try {
      blob = await synthesizeSpeechApi(clean, lang, controller.signal)
    } catch {
      speakWithBrowser()
      return
    }
    if (finished) return
    objectUrl = URL.createObjectURL(blob)
    const player = new Audio(objectUrl)
    audio = player
    player.onended = finish
    player.onerror = speakWithBrowser
    const tick = () => {
      if (finished) return
      if (Number.isFinite(player.duration) && player.duration > 0) {
        handlers.onProgress?.(Math.min(1, player.currentTime / player.duration))
      }
      frame = requestAnimationFrame(tick)
    }
    try {
      await player.play()
    } catch {
      // Autoplay blocked or the clip is unreadable: the browser voice still works.
      speakWithBrowser()
      return
    }
    frame = requestAnimationFrame(tick)
  }

  active = playback
  void run()
  return true
}

/** Pronounces a single English word, e.g. from a vocabulary card. */
export function speakEnglish(value: string): void {
  speakText(value.replace(/[^a-zA-Z' ]/g, ''), 'en')
}
