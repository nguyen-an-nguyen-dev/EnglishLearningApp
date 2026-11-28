import { env } from '../../config/env';
import { setTimeout as sleep } from 'node:timers/promises';
import { HttpError } from '../../middleware/error-handler';
import { alignWords, measurePacing } from './speech.practice';
import type { TimedWord } from './speech.practice';
import { findSpeechModel, speechModelSupports } from './speech.models';
import type { SpeechMimeType, SpeechTranscript } from './speech.types';
import { assertReasonableDuration, cleanTranscript } from './speech.validation';

type RecognizedSpeech = SpeechTranscript & { timedWords?: TimedWord[] };

interface AssemblyAiWord {
  text?: unknown;
  start?: unknown;
  end?: unknown;
}

interface AssemblyAiTranscript {
  id?: unknown;
  status?: unknown;
  text?: unknown;
  error?: unknown;
  language_code?: unknown;
  speech_model_used?: unknown;
  audio_duration?: unknown;
  words?: unknown;
}

function assemblyAuth(): Record<string, string> {
  return { authorization: env.assemblyAiApiKey };
}

async function readErrorMessage(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const candidate = parsed.error ?? parsed.detail ?? parsed.message ?? parsed.title;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  } catch {
    /* AssemblyAI returns plain text for a few upload failures. */
  }
  return raw.trim();
}

function assemblyFailure(stage: string, status: number, detail: string): HttpError {
  const suffix = detail ? `: ${detail.slice(0, 180)}` : '';
  if (status === 401 || status === 403) {
    return new HttpError(503, `AssemblyAI từ chối API key${suffix}. Kiểm tra ASSEMBLYAI_API_KEY.`);
  }
  if (status === 429) {
    return new HttpError(429, `AssemblyAI đang giới hạn tần suất, thử lại sau vài giây${suffix}.`);
  }
  if (status === 413) {
    return new HttpError(413, `Đoạn âm thanh vượt giới hạn của AssemblyAI${suffix}.`);
  }
  if (status === 415) {
    return new HttpError(415, `AssemblyAI không đọc được định dạng âm thanh này${suffix}.`);
  }
  return new HttpError(503, `AssemblyAI lỗi ${status} ở bước ${stage}${suffix}.`);
}

/** Uploads raw bytes; AssemblyAI returns a private URL which transcription can read. */
async function uploadAudio(audio: Buffer, signal: AbortSignal): Promise<string> {
  const response = await fetch(`${env.assemblyAiBaseUrl}/v2/upload`, {
    method: 'POST',
    headers: { ...assemblyAuth(), 'content-type': 'application/octet-stream' },
    body: new Uint8Array(audio),
    signal,
  });
  if (!response.ok) {
    throw assemblyFailure('tải âm thanh lên', response.status, await readErrorMessage(response));
  }
  const body = await response.json().catch(() => null) as { upload_url?: unknown } | null;
  const uploadUrl = typeof body?.upload_url === 'string' ? body.upload_url : '';
  if (!uploadUrl) throw new HttpError(502, 'AssemblyAI không trả về URL của file đã tải lên.');
  return uploadUrl;
}

async function submitTranscript(
  audioUrl: string,
  language: 'vi' | 'en' | null,
  model: string,
  signal: AbortSignal,
): Promise<string> {
  const payload = {
    audio_url: audioUrl,
    speech_models: [model],
    punctuate: true,
    format_text: true,
    ...(language ? { language_code: language } : { language_detection: true }),
  };
  const response = await fetch(`${env.assemblyAiBaseUrl}/v2/transcript`, {
    method: 'POST',
    headers: { ...assemblyAuth(), 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) {
    throw assemblyFailure('tạo transcript', response.status, await readErrorMessage(response));
  }
  const body = await response.json().catch(() => null) as { id?: unknown } | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) throw new HttpError(502, 'AssemblyAI không trả về mã transcript.');
  return id;
}

async function waitForTranscript(id: string, signal: AbortSignal): Promise<AssemblyAiTranscript> {
  while (!signal.aborted) {
    const response = await fetch(`${env.assemblyAiBaseUrl}/v2/transcript/${encodeURIComponent(id)}`, {
      headers: assemblyAuth(),
      signal,
    });
    if (!response.ok) {
      throw assemblyFailure('lấy kết quả', response.status, await readErrorMessage(response));
    }
    const body = await response.json().catch(() => null) as AssemblyAiTranscript | null;
    if (body?.status === 'completed') return body;
    if (body?.status === 'error') {
      const message = typeof body.error === 'string' && body.error.trim()
        ? body.error.trim()
        : 'AssemblyAI không nhận diện được nội dung trong đoạn ghi âm.';
      throw new HttpError(422, message);
    }
    await sleep(env.speechPollIntervalMs, undefined, { signal });
  }
  throw new HttpError(504, 'AssemblyAI xử lý quá lâu. Thử đoạn ghi âm ngắn hơn nhé.');
}

function readTimedWords(raw: unknown): TimedWord[] {
  if (!Array.isArray(raw)) return [];
  const words: TimedWord[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const word = entry as AssemblyAiWord;
    if (typeof word.text !== 'string' || !word.text.trim()) continue;
    if (typeof word.start !== 'number' || typeof word.end !== 'number') continue;
    if (!Number.isFinite(word.start) || !Number.isFinite(word.end)) continue;
    // AssemblyAI reports milliseconds.
    words.push({ word: word.text, start: word.start / 1000, end: word.end / 1000 });
  }
  return words;
}

/**
 * AssemblyAI pre-recorded REST: upload the clip, create a transcript, then poll
 * until it finishes. The response includes word timings, which practice mode
 * uses for pacing feedback.
 */
async function transcribeAssemblyAi(
  audio: Buffer,
  _mime: SpeechMimeType,
  language: 'vi' | 'en' | null,
  model: string,
  requestSignal?: AbortSignal,
): Promise<RecognizedSpeech | null> {
  if (!env.assemblyAiApiKey) {
    throw new HttpError(503, 'Chưa cấu hình ASSEMBLYAI_API_KEY để nhận diện giọng nói.');
  }
  const timeout = AbortSignal.timeout(env.speechTimeoutMs);
  const signal = requestSignal ? AbortSignal.any([requestSignal, timeout]) : timeout;
  const result = await (async () => {
    try {
      const uploadUrl = await uploadAudio(audio, signal);
      const transcriptId = await submitTranscript(uploadUrl, language, model, signal);
      return await waitForTranscript(transcriptId, signal);
    } catch (error) {
      if (signal.aborted) throw new HttpError(504, 'AssemblyAI không phản hồi kịp. Thử lại với đoạn ghi âm ngắn hơn.');
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'Không kết nối được AssemblyAI.');
    }
  })();

  const text = cleanTranscript(result.text);
  if (!text) return null;
  assertReasonableDuration(typeof result.audio_duration === 'number' ? result.audio_duration : null);

  return {
    text,
    language: typeof result.language_code === 'string' ? result.language_code : language,
    provider: 'assemblyai',
    model: typeof result.speech_model_used === 'string' ? result.speech_model_used : model,
    timedWords: readTimedWords(result.words),
  };
}

/**
 * The app has one ASR provider: AssemblyAI. A `null` return means the clip had
 * no speech; a thrown HttpError means the provider failed.
 */
async function recognizeSpeech(
  audio: Buffer,
  mime: SpeechMimeType,
  language: 'vi' | 'en' | null,
  modelOverride: string | null = null,
  signal?: AbortSignal,
): Promise<RecognizedSpeech | null> {
  const model = modelOverride ?? env.speechModel;
  const info = findSpeechModel(model);

  if (info?.transport === 'websocket') {
    throw new HttpError(422, `${info.label} chỉ chạy qua WebSocket nên endpoint HTTP không dùng được.`);
  }
  if (!speechModelSupports(model, language)) {
    const label = info?.label ?? model;
    throw new HttpError(422, `${label} không hỗ trợ ${language === 'vi' ? 'tiếng Việt' : 'tiếng Anh'}.`);
  }
  return transcribeAssemblyAi(audio, mime, language, model, signal);
}

export async function transcribeSpeech(
  audio: Buffer,
  mime: SpeechMimeType,
  language: 'vi' | 'en' | null = null,
  modelOverride: string | null = null,
  signal?: AbortSignal,
): Promise<SpeechTranscript | null> {
  const result = await recognizeSpeech(audio, mime, language, modelOverride, signal);
  if (!result) return null;
  const { text, language: detected, provider, model } = result;
  return { text, language: detected, provider, model };
}

export async function practiceSpeech(audio: Buffer, mime: SpeechMimeType, expected: string, signal?: AbortSignal) {
  // The practice sentence is English, so ask the recognizer for English even
  // when the app UI is Vietnamese.
  const result = await recognizeSpeech(audio, mime, 'en', null, signal);
  if (!result || !/[\p{L}\p{N}]/u.test(result.text)) return null;
  const alignment = alignWords(expected, result.text);
  return {
    transcript: result.text,
    completeness: alignment.completeness,
    words: alignment.words,
    pacing: measurePacing(result.timedWords ?? []),
  };
}
