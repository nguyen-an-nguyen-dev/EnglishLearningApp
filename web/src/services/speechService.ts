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

/** Asks the backend whether server-side transcription is configured. */
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
 * Posts raw recorded bytes. Deliberately does not use `requestApi`: that helper
 * forces `Content-Type: application/json`, which would corrupt the audio body.
 */
export async function transcribeAudioApi(blob: Blob): Promise<SpeechTranscript> {
  const token = authStorage.getToken()
  if (!token) throw new Error('Bạn cần đăng nhập lại.')

  const response = await fetch('/api/speech/transcribe', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': blob.type || 'audio/webm',
    },
    body: blob,
    signal: AbortSignal.timeout(45_000),
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
