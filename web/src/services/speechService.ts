import { authStorage } from './authStorage'

export interface SpeechTranscript {
  text: string
  language: string | null
  provider: 'whisper' | 'gemini'
}

export interface SpeechStatus {
  backend: boolean
  whisper: boolean
  gemini: boolean
  maxBytes: number
}

export async function getSpeechStatusApi(): Promise<SpeechStatus> {
  const response = await fetch('/api/speech/status')
  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean
    data?: SpeechStatus
  }
  if (!response.ok || !body.success || !body.data) {
    return { backend: false, whisper: false, gemini: false, maxBytes: 0 }
  }
  return body.data
}

/**
 * Posts raw recorded bytes. Does not use `requestApi` because its forced
 * `Content-Type: application/json` would corrupt the audio body.
 */
export async function transcribeAudioApi(blob: Blob, signal?: AbortSignal): Promise<SpeechTranscript> {
  const token = authStorage.getToken()
  if (!token) throw new Error('Bạn cần đăng nhập lại.')

  const response = await fetch('/api/speech/transcribe', {
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
    data?: SpeechTranscript
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
): Promise<Blob> {
  const token = authStorage.getToken()
  if (!token) throw new Error('Bạn cần đăng nhập lại.')

  const timeout = AbortSignal.timeout(25_000)
  const response = await fetch('/api/speech/synthesize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, lang }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
  if (!response.ok) throw new Error(`Speech synthesis failed (${response.status}).`)
  return response.blob()
}
