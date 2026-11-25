import { env } from '../../config/env';
import { HttpError } from '../../middleware/error-handler';
import {
  cfAccountTargets,
  isDailyQuotaError,
  markCfAccountExhausted,
} from '../../utils/cf-rotate';
import { alignWords, measurePacing, readTimedWords } from './speech.practice';
import type { TimedWord } from './speech.practice';
import type { SpeechMimeType, SpeechTranscript } from './speech.types';
import { assertReasonableDuration, cleanTranscript } from './speech.validation';

type RecognizedSpeech = SpeechTranscript & { timedWords?: TimedWord[] };

function readLanguage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const info = record.transcription_info;
  if (info && typeof info === 'object') {
    const language = (info as Record<string, unknown>).language;
    if (typeof language === 'string' && language.trim()) return language.trim();
  }
  if (typeof record.language === 'string' && record.language.trim()) return record.language.trim();
  return null;
}

/**
 * Workers AI Whisper. The raw bytes are the body and the model name lives in
 * the URL; every configured account is tried in rotation so one exhausted daily
 * quota does not disable dictation.
 */
async function transcribeWhisper(
  audio: Buffer,
  mime: SpeechMimeType,
): Promise<RecognizedSpeech | null> {
  let lastError: unknown = null;
  for (const account of cfAccountTargets({})) {
    // Env URLs point at a chat endpoint:
    //   https://api.cloudflare.com/client/v4/accounts/<id>/ai/v1/chat/completions
    // Whisper lives beside it under /ai/run/<model>.
    const marker = account.apiUrl.indexOf('/ai/');
    const base = marker >= 0 ? account.apiUrl.slice(0, marker) : account.apiUrl;
    if (!base) continue;
    const url = `${base}/ai/run/${env.speechWhisperModel}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${account.apiKey}`,
          'Content-Type': mime,
        },
        body: new Uint8Array(audio),
        signal: AbortSignal.timeout(env.speechTimeoutMs),
      });
    } catch (error) {
      lastError = error;
      continue;
    }

    if (response.status === 429) {
      const detail = await response.text().catch(() => '');
      if (isDailyQuotaError(detail)) markCfAccountExhausted(account.apiKey);
      lastError = new HttpError(429, 'Dịch vụ nhận diện đang bận. Thử lại sau một chút nhé.');
      continue;
    }
    if (!response.ok) {
      lastError = new HttpError(503, 'Dịch vụ nhận diện giọng nói tạm thời không khả dụng.');
      continue;
    }

    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    const result = payload && typeof payload.result === 'object' && payload.result !== null
      ? payload.result as Record<string, unknown>
      : payload;
    const text = cleanTranscript(result?.text);
    if (!text) return null; // silence: a valid answer, not an error
    assertReasonableDuration((result?.transcription_info as Record<string, unknown> | undefined)?.duration as number);
    return { text, language: readLanguage(result), provider: 'whisper', timedWords: readTimedWords(result?.segments) };
  }
  if (lastError instanceof HttpError) throw lastError;
  return null;
}

/**
 * Gemini audio input, used when Workers AI has no account or Whisper failed.
 * Silence is an empty string, which becomes `null`.
 */
async function transcribeGemini(
  audio: Buffer,
  mime: SpeechMimeType,
): Promise<SpeechTranscript | null> {
  if (!env.aiApiKey.trim()) return null;
  const model = env.aiFallbackModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.aiApiKey)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: 'Transcribe the speech in this audio exactly, keeping the spoken language. Return only the transcript text, with no quotes or notes. If there is no speech, return an empty string.',
            },
            { inline_data: { mime_type: mime, data: audio.toString('base64') } },
          ],
        }],
        generationConfig: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(env.speechTimeoutMs),
    });
  } catch {
    throw new HttpError(504, 'Dịch vụ nhận diện giọng nói không phản hồi. Bạn gõ câu hỏi bên dưới nhé.');
  }
  if (!response.ok) {
    throw new HttpError(503, 'Dịch vụ nhận diện giọng nói tạm thời không khả dụng.');
  }
  const payload = await response.json().catch(() => null) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  } | null;
  const text = cleanTranscript(payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join(' '));
  if (!text) return null;
  return { text, language: null, provider: 'gemini' };
}

/**
 * Best-effort chain: Whisper first (cheap, purpose-built), then Gemini. A
 * `null` return means no speech; a thrown HttpError means every provider failed.
 */
async function recognizeSpeech(
  audio: Buffer,
  mime: SpeechMimeType,
): Promise<RecognizedSpeech | null> {
  let lastError: unknown = null;

  if (env.cfAccounts.length > 0) {
    try {
      const result = await transcribeWhisper(audio, mime);
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
  }

  try {
    const result = await transcribeGemini(audio, mime);
    if (result) return result;
  } catch (error) {
    lastError = error;
  }

  if (lastError instanceof HttpError) throw lastError;
  return null;
}

export async function transcribeSpeech(audio: Buffer, mime: SpeechMimeType): Promise<SpeechTranscript | null> {
  const result = await recognizeSpeech(audio, mime);
  if (!result) return null;
  const { text, language, provider } = result;
  return { text, language, provider };
}

export async function practiceSpeech(audio: Buffer, mime: SpeechMimeType, expected: string) {
  const result = await recognizeSpeech(audio, mime);
  if (!result || !/[\p{L}\p{N}]/u.test(result.text)) return null;
  const alignment = alignWords(expected, result.text);
  return {
    transcript: result.text,
    completeness: alignment.completeness,
    words: alignment.words,
    pacing: measurePacing(result.timedWords ?? []),
  };
}
