/**
 * Speech recognition, wrapped so the UI never has to think about vendor
 * prefixes or the permission dance. Chrome/Edge expose the Web Speech API as
 * `webkitSpeechRecognition`; Safari uses `SpeechRecognition`. When neither
 * exists (Firefox today) the hook reports `supported: false` and the orb falls
 * back to typing — it never pretends to listen.
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

/**
 * Maps a browser error code onto the one thing the learner needs to know, so
 * the orb can explain itself instead of going silent.
 */
export function describeSpeechError(code: string): 'denied' | 'no-speech' | 'unsupported' | 'network' | 'other' {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'denied'
  if (code === 'no-speech' || code === 'aborted') return 'no-speech'
  if (code === 'language-not-supported') return 'unsupported'
  // Chrome fires "network" when its speech service cannot be reached. That is
  // a service outage, not the learner failing to speak — say so, and point at
  // the typing fallback instead of asking them to repeat themselves.
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

  let stopped = false

  recognition.onresult = (event) => {
    let text = ''
    let isFinal = false
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      text += result[0].transcript
      if (result.isFinal) isFinal = true
    }
    handlers.onTranscript(text.trim(), isFinal)
  }

  recognition.onerror = (event) => {
    // `aborted` also fires when we call cancel() on purpose, so ignore it then.
    if (stopped && event.error === 'aborted') return
    handlers.onError(describeSpeechError(event.error))
  }

  recognition.onend = () => {
    if (!stopped) handlers.onEnd()
  }

  return {
    supported: true,
    start() {
      stopped = false
      try {
        recognition.start()
      } catch {
        // Calling start() while already listening throws; the UI stays usable.
      }
    },
    stop() {
      stopped = true
      try {
        recognition.stop()
      } catch {
        /* already stopped */
      }
    },
    cancel() {
      stopped = true
      try {
        recognition.abort()
      } catch {
        /* already stopped */
      }
    },
  }
}
