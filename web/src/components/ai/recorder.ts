/**
 * Microphone recording for the backend speech service. The Web Speech API can be
 * unreachable, so this captures a short clip with MediaRecorder for the backend.
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
  onError: (kind: 'denied' | 'unsupported' | 'empty' | 'other') => void
  /** Optional: the live stream, so the UI can visualise the same capture. */
  onStream?: (stream: MediaStream) => void
  onStopping?: () => void
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

  type Capture = {
    stream?: MediaStream
    recorder?: MediaRecorder
    timer?: number
    stopping?: boolean
  }
  let capture: Capture | null = null

  const releaseStream = (session: Capture) => {
    if (session.timer !== undefined) {
      window.clearTimeout(session.timer)
      session.timer = undefined
    }
    session.stream?.getTracks().forEach((track) => track.stop())
    session.stream = undefined
  }

  const finish = (deliver: boolean) => {
    const session = capture
    if (!session || (deliver && session.stopping)) return
    session.stopping = true
    if (!deliver) capture = null
    const active = session.recorder
    if (!active) {
      capture = null
      if (deliver) handlers.onError('empty')
      return
    }
    try {
      if (deliver) handlers.onStopping?.()
      if (active.state !== 'inactive') active.stop()
    } catch {
      releaseStream(session)
      if (capture === session) {
        capture = null
        handlers.onError('other')
      }
    } finally {
      if (!deliver) releaseStream(session)
    }
  }

  return {
    supported: true,
    start() {
      if (capture) return
      const session: Capture = {}
      capture = session
      void navigator.mediaDevices.getUserMedia({ audio: true })
        .then((nextStream) => {
          if (capture !== session) {
            nextStream.getTracks().forEach((track) => track.stop())
            return
          }
          session.stream = nextStream
          const chunks: Blob[] = []
          handlers.onStream?.(nextStream)
          const mimeType = pickMimeType()
          const active = new window.MediaRecorder(nextStream, mimeType ? { mimeType } : undefined)
          session.recorder = active
          active.ondataavailable = (event) => {
            if (event.data.size > 0) chunks.push(event.data)
          }
          active.onerror = () => {
            releaseStream(session)
            if (capture !== session) return
            capture = null
            handlers.onError('other')
          }
          active.onstop = () => {
            releaseStream(session)
            if (capture !== session) return
            capture = null
            const clip = new Blob(chunks, { type: active.mimeType || mimeType || 'audio/webm' })
            if (clip.size === 0) {
              handlers.onError('empty')
              return
            }
            handlers.onClip(clip)
          }
          active.start()
          session.timer = window.setTimeout(() => finish(true), MAX_RECORD_MS)
        })
        .catch((error: unknown) => {
          releaseStream(session)
          if (capture !== session) return
          capture = null
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
