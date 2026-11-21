import { HttpError } from '../../middleware/error-handler';
import { SPEECH_MIME_TYPES, type SpeechMimeType } from './speech.types';

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
