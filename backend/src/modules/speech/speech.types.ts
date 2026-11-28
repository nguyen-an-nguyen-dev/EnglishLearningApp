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

export type SpeechVoiceLang = 'en' | 'vi';

export interface SpeechTranscript {
  text: string;
  language: string | null;
  provider: 'assemblyai';
  model: string | null;
}
