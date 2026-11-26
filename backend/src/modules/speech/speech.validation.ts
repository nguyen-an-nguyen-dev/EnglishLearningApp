import { HttpError } from '../../middleware/error-handler';
import { SPEECH_MIME_TYPES, type SpeechMimeType, type SpeechVoiceLang } from './speech.types';

const MAX_AUDIO_SECONDS = 60;

/**
 * The recorder posts raw bytes, so Content-Type is the only metadata. Normalise
 * `audio/webm;codecs=opus` to `audio/webm` and reject unreadable formats.
 */
export function parseSpeechMimeType(raw: string | undefined): SpeechMimeType {
  const base = (raw ?? '').split(';')[0].trim().toLowerCase();
  if (!base) throw new HttpError(415, 'Thiếu Content-Type của đoạn âm thanh.');
  const match = SPEECH_MIME_TYPES.find((type) => type === base);
  if (!match) {
    throw new HttpError(415, `Định dạng âm thanh không được hỗ trợ: ${base}.`);
  }
  return match;
}

export function parseSpeechAudio(body: unknown, maxBytes: number): Buffer {
  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw new HttpError(400, 'Đoạn âm thanh trống. Hãy nói lại nhé.');
  }
  if (body.length > maxBytes) {
    throw new HttpError(413, 'Đoạn âm thanh quá dài. Hãy nói ngắn hơn nhé.');
  }
  return body;
}

/** Spoken language hint for the recognizer; unknown values fall back safely. */
export function parseSpeechLanguage(value: unknown, fallback: 'vi' | 'en' | null): 'vi' | 'en' | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return raw === 'vi' || raw === 'en' ? raw : fallback;
}

/**
 * One request is one short passage (a sentence or a reply). Longer text is refused so a single
 * request cannot tie up the voice stream; the web falls back to the browser voice for it.
 */
export const MAX_TTS_CHARS = 500;

export function parsePracticeText(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > MAX_TTS_CHARS || !/[\p{L}\p{N}]/u.test(text)) {
    throw new HttpError(400, 'Câu mẫu cần có từ 1 đến 500 ký tự và chứa từ để luyện nói.');
  }
  return text;
}

export function parseTtsRequest(body: unknown): { text: string; lang: SpeechVoiceLang } {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const text = typeof record.text === 'string' ? record.text.replace(/\s+/g, ' ').trim() : '';
  if (!text) throw new HttpError(400, 'Thiếu nội dung cần đọc.');
  if (text.length > MAX_TTS_CHARS) throw new HttpError(400, 'Đoạn cần đọc quá dài.', ['TEXT_TOO_LONG']);
  if (record.lang !== 'en' && record.lang !== 'vi') throw new HttpError(400, 'Ngôn ngữ đọc không hợp lệ.');
  return { text, lang: record.lang };
}

/** A transcript longer than this is not one spoken command anymore. */
export const MAX_TRANSCRIPT_CHARS = 500;

export function cleanTranscript(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/\s+/g, ' ')
    .replace(/^\s*[.,!?;:]+\s*$/, '')
    .trim()
    .slice(0, MAX_TRANSCRIPT_CHARS);
}

export function assertReasonableDuration(seconds: number | null | undefined): void {
  if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > MAX_AUDIO_SECONDS) {
    throw new HttpError(413, 'Đoạn âm thanh quá dài. Hãy nói ngắn hơn nhé.');
  }
}
