/**
 * Speech recognition wrapper. Chrome/Edge expose `webkitSpeechRecognition`, Safari
 * uses `SpeechRecognition`; when neither exists the hook reports `supported: false`
 * and the orb falls back to typing.
 */

type SpeechRecognitionResultLike = {
  isFinal: boolean
  0: { transcript: string }
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}

type SpeechRecognitionErrorLike = { error: string }

interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

type RecognitionCtor = new () => RecognitionLike

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

/** Vietnamese dictation is the default: the learner speaks Vietnamese. */
export const SPEECH_LANG = 'vi-VN'

/** Maps a browser error code to what the learner needs to know. */
export function describeSpeechError(code: string): 'denied' | 'no-speech' | 'unsupported' | 'network' | 'other' {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'denied'
  if (code === 'no-speech' || code === 'aborted') return 'no-speech'
  if (code === 'language-not-supported') return 'unsupported'
  // Chrome's "network" is a service outage, not the learner failing to speak, so
  // point at the typing fallback instead of asking them to repeat.
  if (code === 'network') return 'network'
  return 'other'
}

export interface DictationHandlers {
  /** Fires with the best transcript so far, including interim words. */
  onTranscript: (text: string, isFinal: boolean) => void
  onError: (kind: ReturnType<typeof describeSpeechError>) => void
  onEnd: () => void
}

export interface Dictation {
  readonly supported: boolean
  start(): void
  stop(): void
  /** Stops without emitting a final result, e.g. when the panel is dismissed. */
  cancel(): void
}

export function createDictation(handlers: DictationHandlers, lang = SPEECH_LANG): Dictation {
  const Ctor = recognitionCtor()
  if (!Ctor) {
    return {
      supported: false,
      start: () => handlers.onError('unsupported'),
      stop: () => {},
      cancel: () => {},
    }
  }

  const recognition = new Ctor()
  recognition.lang = lang
  recognition.continuous = false
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  let active = false
  let delivered = false

  recognition.onresult = (event) => {
    if (!active || delivered) return
    const parts: string[] = []
    let isFinal = event.results.length > 0
    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index]
      parts.push(result[0].transcript.trim())
      isFinal &&= result.isFinal
    }
    delivered = isFinal
    handlers.onTranscript(parts.filter(Boolean).join(' '), isFinal)
  }

  recognition.onerror = (event) => {
    if (!active || delivered) return
    active = false
    handlers.onError(describeSpeechError(event.error))
  }

  recognition.onend = () => {
    if (!active) return
    active = false
    handlers.onEnd()
  }

  return {
    supported: true,
    start() {
      if (active) return
      active = true
      delivered = false
      try {
        recognition.start()
      } catch {
        active = false
        handlers.onError('other')
      }
    },
    stop() {
      if (!active) return
      try {
        recognition.stop()
      } catch {
        active = false
        handlers.onEnd()
      }
    },
    cancel() {
      active = false
      try {
        recognition.abort()
      } catch {
        /* already stopped */
      }
    },
  }
}
