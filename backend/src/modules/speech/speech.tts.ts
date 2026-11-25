import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { HttpError } from '../../middleware/error-handler';
import type { SpeechVoiceLang } from './speech.types';

/**
 * Microsoft Neural voices, read through the Edge Read Aloud service. No API key
 * is needed, but the endpoint is unofficial and may change without notice.
 */
export const TTS_VOICES: Record<SpeechVoiceLang, string> = {
  en: 'en-US-AriaNeural',
  vi: 'vi-VN-HoaiMyNeural',
};

const TTS_TIMEOUT_MS = 20_000;
/**
 * Same text and voice are often replayed (word pronunciation). The cache is capped by bytes,
 * because clip sizes vary with the passage length (a 500-character passage is a few hundred KB).
 */
export const CACHE_MAX_BYTES = 64 * 1024 * 1024;
const cache = new Map<string, Buffer>();
let cacheBytes = 0;

const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/** XML 1.0 forbids these control characters, and one of them makes the whole SSML invalid. */
const XML_FORBIDDEN_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/** The library puts text straight into SSML, so markup characters must be escaped here. */
export function escapeSsmlText(text: string): string {
  return text.replace(XML_FORBIDDEN_CHARS, '').replace(/[&<>"']/g, (char) => XML_ENTITIES[char] ?? char);
}

async function synthesizeOnce(text: string, voice: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escapeSsmlText(text));
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        tts.close();
        reject(new Error('TTS timed out'));
      }, TTS_TIMEOUT_MS);
      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      audioStream.on('end', () => {
        clearTimeout(timer);
        resolve();
      });
      // A dropped socket closes the stream early; a truncated clip must not be served.
      audioStream.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}

/** Returns MP3 bytes. Throws `HttpError` 503 when the voice service cannot answer. */
export async function synthesizeSpeech(text: string, lang: SpeechVoiceLang): Promise<Buffer> {
  const voice = TTS_VOICES[lang];
  const key = `${voice}\n${text}`;
  const cached = cache.get(key);
  if (cached) {
    rememberClip(key, cached);
    return cached;
  }

  let audio: Buffer;
  try {
    audio = await synthesizeOnce(text, voice);
  } catch (error) {
    console.error('[tts] synthesis failed', error instanceof Error ? error.message : error);
    throw new HttpError(503, 'Chưa tạo được giọng đọc. Thử lại sau nhé.');
  }
  if (audio.length === 0) {
    throw new HttpError(503, 'Chưa tạo được giọng đọc. Thử lại sau nhé.');
  }

  rememberClip(key, audio);
  return audio;
}

/** Stores a clip as the newest entry and evicts the oldest ones until the total fits the budget. */
export function rememberClip(key: string, audio: Buffer): void {
  const previous = cache.get(key);
  if (previous) {
    cache.delete(key);
    cacheBytes -= previous.length;
  }
  if (audio.length > CACHE_MAX_BYTES) return;
  cache.set(key, audio);
  cacheBytes += audio.length;
  for (const [oldKey, oldAudio] of cache) {
    if (cacheBytes <= CACHE_MAX_BYTES) break;
    cache.delete(oldKey);
    cacheBytes -= oldAudio.length;
  }
}

export function cachedClipBytes(): number {
  return cacheBytes;
}
