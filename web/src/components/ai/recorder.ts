/**
 * Microphone recording for the backend speech service. The Web Speech API is
 * free but depends on the browser vendor's speech servers, which can be
 * unreachable (Chrome reports `network`). This wrapper captures a short clip
 * with MediaRecorder so the backend can transcribe it with Whisper/Gemini.
 */

const CANDIDATE_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
]

export interface RecorderHandlers {
  /** One finished clip, already typed by the browser. */
  onClip: (blob: Blob) => void
  onError: (kind: 'denied' | 'unsupported' | 'other') => void
}

export interface Recorder {
  readonly supported: boolean
  start(): void
  /** Stops and delivers the clip through `onClip`. */
  stop(): void
  /** Stops without delivering anything. */
  cancel(): void
}

/** Longest single utterance the backend will accept by default. */
export const MAX_RECORD_MS = 30_000

function audioSupport(): boolean {
  return typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof window.MediaRecorder !== 'undefined'
}

function pickMimeType(): string | undefined {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') return undefined
  for (const type of CANDIDATE_TYPES) {
    if (window.MediaRecorder.isTypeSupported(type)) return type
  }
  return undefined
}

export function createRecorder(handlers: RecorderHandlers): Recorder {
  if (!audioSupport()) {
    return {
      supported: false,
      start: () => handlers.onError('unsupported'),
      stop: () => {},
      cancel: () => {},
    }
  }

  let stream: MediaStream | null = null
  let recorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let discarded = false
  let timer: number | null = null

  const releaseStream = () => {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
  }

  const finish = (deliver: boolean) => {
    const active = recorder
    recorder = null
    if (!active) {
      releaseStream()
      return
    }
    discarded = !deliver
    try {
      if (active.state !== 'inactive') active.stop()
    } catch {
      releaseStream()
    }
  }

  return {
    supported: true,
    start() {
      void navigator.mediaDevices.getUserMedia({ audio: true })
        .then((nextStream) => {
          stream = nextStream
          chunks = []
          discarded = false
          const mimeType = pickMimeType()
          const active = new window.MediaRecorder(nextStream, mimeType ? { mimeType } : undefined)
          recorder = active
          active.ondataavailable = (event) => {
            if (event.data.size > 0) chunks.push(event.data)
          }
          active.onerror = () => {
            releaseStream()
            recorder = null
            handlers.onError('other')
          }
          active.onstop = () => {
            releaseStream()
            if (discarded) return
            const clip = new Blob(chunks, { type: active.mimeType || mimeType || 'audio/webm' })
            chunks = []
            if (clip.size === 0) {
              handlers.onError('other')
              return
            }
            handlers.onClip(clip)
          }
          active.start()
          timer = window.setTimeout(() => finish(true), MAX_RECORD_MS)
        })
        .catch((error: unknown) => {
          releaseStream()
          const name = error instanceof DOMException ? error.name : ''
          handlers.onError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'other')
        })
    },
    stop() {
      finish(true)
    },
    cancel() {
      finish(false)
    },
  }
}
