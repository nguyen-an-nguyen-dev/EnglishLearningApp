import { authStorage } from './authStorage'

export interface SpeechTranscript {
  text: string
  language: string | null
  provider: 'assemblyai'
  model: string | null
}

export interface SpeechStatus {
  backend: boolean
  buddyStreaming?: boolean
  speechModel?: string
  maxBytes: number
}

export async function getSpeechStatusApi(): Promise<SpeechStatus> {
  const response = await fetch('/api/speech/status')
  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean
    data?: SpeechStatus
  }
  if (!response.ok || !body.success || !body.data) {
    return { backend: false, maxBytes: 0 }
  }
  return body.data
}

/**
 * Posts raw recorded bytes. Does not use `requestApi` because its forced
 * `Content-Type: application/json` would corrupt the audio body.
 */
export interface SpeechPractice {
  transcript: string
  completeness: number
  words: Array<{ word: string; status: 'matched' | 'missing' | 'different'; heard?: string }>
  pacing: {
    wordsPerMinute: number
    pauses: Array<{ afterWord: string; beforeWord: string; seconds: number }>
  } | null
}

export function transcribeAudioApi(
  blob: Blob,
  signal?: AbortSignal,
  lang: SpeechVoiceLang = 'vi',
): Promise<SpeechTranscript> {
  return postSpeechAudio(`/api/speech/transcribe?${new URLSearchParams({ lang })}`, blob, signal)
}

export function practiceSpeechApi(text: string, blob: Blob, signal?: AbortSignal): Promise<SpeechPractice> {
  return postSpeechAudio(`/api/speech/practice?${new URLSearchParams({ text })}`, blob, signal)
}

async function postSpeechAudio<T>(path: string, blob: Blob, signal?: AbortSignal): Promise<T> {
  const token = authStorage.getToken()
  if (!token) throw new Error('Bạn cần đăng nhập lại.')

  const response = await fetch(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': blob.type || 'audio/webm',
    },
    body: blob,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(45_000)]) : AbortSignal.timeout(45_000),
  })
  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean
    data?: T
    error?: string
    code?: string
  }
  if (!response.ok || !body.success || !body.data) {
    const error = new Error(body.error || 'Không nhận diện được giọng nói.')
    ;(error as Error & { code?: string }).code = body.code
    throw error
  }
  return body.data
}

export type SpeechVoiceLang = 'en' | 'vi'

/** Neural voice clip (MP3) for `text`. Rejects when the voice service cannot answer. */
export async function synthesizeSpeechApi(
  text: string,
  lang: SpeechVoiceLang,
  signal?: AbortSignal,
  { retryUnavailable = false }: { retryUnavailable?: boolean } = {},
): Promise<Blob> {
  const token = authStorage.getToken()
  if (!token) throw new Error('Bạn cần đăng nhập lại.')

  const timeout = AbortSignal.timeout(25_000)
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
  const synthesize = () => fetch('/api/speech/synthesize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, lang }),
    signal: requestSignal,
  })
  let response = await synthesize()
  if (retryUnavailable && !requestSignal.aborted && [502, 503, 504].includes(response.status)) {
    await response.body?.cancel().catch(() => {})
    response = await synthesize()
  }
  if (!response.ok) throw new Error(`Speech synthesis failed (${response.status}).`)
  return response.blob()
}
