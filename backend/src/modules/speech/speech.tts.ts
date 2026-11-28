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

const TTS_TIMEOUT_MS = 8_000;
const TTS_IDLE_MS = 20_000;
const idleClients = new Map<string, { client: MsEdgeTTS; timer: ReturnType<typeof setTimeout> }>();
/**
 * Same text and voice are often replayed (word pronunciation). The cache is capped by bytes,
 * because clip sizes vary with the passage length (a 500-character passage is a few hundred KB).
 */
export const CACHE_MAX_BYTES = 64 * 1024 * 1024;
const cache = new Map<string, Buffer>();
const pending = new Map<string, Promise<Buffer>>();
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

function takeIdleClient(voice: string): MsEdgeTTS | undefined {
  const idle = idleClients.get(voice);
  if (!idle) return undefined;
  idleClients.delete(voice);
  clearTimeout(idle.timer);
  return idle.client;
}

function retainIdleClient(voice: string, client: MsEdgeTTS): void {
  if (idleClients.has(voice)) {
    client.close();
    return;
  }
  const timer = setTimeout(() => {
    idleClients.delete(voice);
    client.close();
  }, TTS_IDLE_MS);
  timer.unref();
  idleClients.set(voice, { client, timer });
}

export function closeIdleSpeechClients(): void {
  for (const { client, timer } of idleClients.values()) {
    clearTimeout(timer);
    client.close();
  }
  idleClients.clear();
}

async function renderClip(tts: MsEdgeTTS, text: string, voice: string, deadline: number): Promise<Buffer> {
  const remaining = deadline - performance.now();
  if (remaining <= 0) throw new Error('TTS timed out');
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      expired = true;
      reject(new Error('TTS timed out'));
    }, remaining);
  });
  try {
    const render = async () => {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      if (expired) throw new Error('TTS timed out');
      const { audioStream } = tts.toStream(escapeSsmlText(text));
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) chunks.push(Buffer.from(chunk));
      const audio = Buffer.concat(chunks);
      if (audio.length === 0) throw new Error('Empty TTS clip');
      return audio;
    };
    return await Promise.race([render(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function synthesizeOnce(text: string, voice: string): Promise<Buffer> {
  const deadline = performance.now() + TTS_TIMEOUT_MS;
  const render = async (client: MsEdgeTTS) => {
    try {
      const audio = await renderClip(client, text, voice, deadline);
      retainIdleClient(voice, client);
      return audio;
    } catch (error) {
      client.close();
      throw error;
    }
  };
  const idle = takeIdleClient(voice);
  if (idle) {
    try {
      return await render(idle);
    } catch (error) {
      // The service can close an idle socket between setup and the next turn.
      if (performance.now() >= deadline) throw error;
    }
  }
  return render(new MsEdgeTTS());
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

  const existing = pending.get(key);
  if (existing) return existing;
  const request = synthesizeOnce(text, voice)
    .then((audio) => {
      rememberClip(key, audio);
      return audio;
    })
    .catch((error: unknown) => {
      console.error('[tts] synthesis failed', error instanceof Error ? error.message : error);
      throw new HttpError(503, 'Chưa tạo được giọng đọc. Thử lại sau nhé.');
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
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
