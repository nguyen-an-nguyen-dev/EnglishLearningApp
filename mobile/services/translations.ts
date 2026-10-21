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

async function authenticatedFetch(path: string, init: RequestInit): Promise<Response> {
  const token = await readToken();
  const url = `${API_BASE_URL}${path}`;
  try {
    return await fetch(url, {
      ...init,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    console.warn(`[Translation] Request failed at ${url}:`, error);
    throw new Error('Không kết nối được máy chủ. Hãy kiểm tra mạng hoặc trạng thái backend.');
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
  asset: { uri: string; name: string; mimeType?: string | null; file?: File | null },
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
): Promise<Translation> {
  const form = new FormData();
  form.append('sourceLanguage', sourceLanguage);
  form.append('targetLanguage', targetLanguage);
  if (asset.file) {
    form.append('file', asset.file, asset.name);
  } else {
    const nativeForm = form as FormData & {
      append(name: string, value: { uri: string; name: string; type: string }): void;
    };
    nativeForm.append('file', {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || 'text/plain',
    });
  }
  const response = await authenticatedFetch('/translate/file', { method: 'POST', body: form });
  return await parseResponse(response) as Translation;
}

export async function getTranslationHistory(): Promise<Translation[]> {
  const response = await authenticatedFetch('/translations', { method: 'GET' });
  const data = await parseResponse(response) as { translations: Translation[] };
  return data.translations;
}
