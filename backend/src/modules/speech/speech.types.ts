/** Audio formats a recorder realistically produces in a browser. */
export const SPEECH_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
] as const;

export type SpeechMimeType = (typeof SPEECH_MIME_TYPES)[number];

export interface SpeechTranscript {
  text: string;
  /** Best-effort language reported by the provider, `null` when unknown. */
  language: string | null;
  /** Which backend transcribed it, for diagnostics. */
  provider: 'whisper' | 'gemini';
}
