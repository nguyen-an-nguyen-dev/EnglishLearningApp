import { File as ExpoFile } from 'expo-file-system';
import { API_BASE_URL, readToken } from './api';

export type LanguageCode = 'en' | 'vi';
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'pronoun' | 'preposition' | 'conjunction' | 'interjection' | 'other';

export interface WordDetails {
  word: string;
  phonetic: string;
  partOfSpeech: PartOfSpeech;
  meaning: string;
  example: string;
}

export interface Translation {
  id?: number;
  originalText: string;
  translatedText: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  fileName: string | null;
  wordDetails: WordDetails | null;
  createdAt?: string;
}

interface ApiError {
  message?: string;
  errors?: string[];
}

const DEFAULT_TIMEOUT_MS = 60_000;
const FILE_TIMEOUT_MS = 150_000;

function withTimeout(timeoutMs: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function describeConnectionFailure(url: string): Promise<Error> {
  const unreachable = new Error(
    `Không kết nối được backend tại ${API_BASE_URL}. Hãy kiểm tra backend đang chạy và điện thoại dùng cùng mạng Wi-Fi (EXPO_PUBLIC_API_URL trong mobile/.env).`,
  );
  const probe = withTimeout(4_000);
  try {
    const health = await fetch(`${API_BASE_URL}/health`, { signal: probe.signal });
    return health.ok
      ? new Error(`Backend ở ${API_BASE_URL} vẫn phản hồi, nhưng yêu cầu tới ${url} bị ngắt. Hãy thử lại sau ít phút.`)
      : unreachable;
  } catch {
    return unreachable;
  } finally {
    probe.done();
  }
}

async function authenticatedFetch(path: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const token = await readToken();
  const url = `${API_BASE_URL}${path}`;
  const attempt = withTimeout(timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: attempt.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    console.warn(`[Translation] Request failed at ${url}:`, error);
    if (attempt.signal.aborted) {
      throw new Error(`Máy chủ mất hơn ${Math.round(timeoutMs / 1000)} giây để phản hồi. Hãy thử lại.`);
    }
    throw await describeConnectionFailure(url);
  } finally {
    attempt.done();
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  let body: unknown;
  try {
    body = await response.json() as unknown;
  } catch {
    throw new Error(`Phản hồi máy chủ không hợp lệ (${response.status}).`);
  }
  if (!response.ok || typeof body !== 'object' || body === null || !('success' in body)) {
    const error = body as ApiError;
    const details = error.errors?.length ? ` ${error.errors.join(' ')}` : '';
    throw new Error(`${error.message || 'Không thể dịch nội dung.'}${details}`);
  }
  return 'data' in body ? body.data : body;
}

export async function translateText(
  text: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
): Promise<Translation> {
  const response = await authenticatedFetch('/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, sourceLanguage, targetLanguage }),
  });
  return await parseResponse(response) as Translation;
}

export async function translateTxtFile(
  asset: { uri: string; name: string; file?: File | null },
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
): Promise<Translation> {
  const text = await readPickedText(asset);
  const response = await authenticatedFetch('/translate/file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, fileName: asset.name, sourceLanguage, targetLanguage }),
  }, FILE_TIMEOUT_MS);
  return await parseResponse(response) as Translation;
}

// Expo's fetch cannot serialize React Native's `{ uri }` FormData parts ("Unsupported FormDataPart
// implementation"), so the .txt is read locally and sent as JSON instead of multipart.
async function readPickedText(asset: { uri: string; name: string; file?: File | null }): Promise<string> {
  try {
    if (asset.file) return await asset.file.text();
    return await new ExpoFile(asset.uri).text();
  } catch (error) {
    console.warn(`[Translation] Could not read ${asset.uri}:`, error);
    throw new Error(`Không đọc được tệp "${asset.name}". Hãy chọn lại tệp .txt.`);
  }
}

export async function getTranslationHistory(): Promise<Translation[]> {
  const response = await authenticatedFetch('/translations', { method: 'GET' });
  const data = await parseResponse(response) as { translations: Translation[] };
  return data.translations;
}
