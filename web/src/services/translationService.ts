import { requestApi } from './apiClient'
import type { WordLookup } from '../types/video'

export type TranslateLanguage = 'en' | 'vi'

export interface TranslationWordDetails {
  word: string
  phonetic: string
  partOfSpeech: string
  meaning: string
  example: string
}

export interface TranslationResult {
  originalText: string
  translatedText: string
  sourceLanguage: TranslateLanguage
  targetLanguage: TranslateLanguage
  fileName: string | null
  wordDetails: TranslationWordDetails | null
  id?: number
  createdAt?: string
}

const TEXT_TIMEOUT_MS = 60_000
const FILE_TIMEOUT_MS = 150_000

export async function translateTextApi(
  text: string,
  sourceLanguage: TranslateLanguage,
  targetLanguage: TranslateLanguage,
): Promise<TranslationResult> {
  return requestApi<TranslationResult>('/api/translate', {
    method: 'POST',
    body: JSON.stringify({ text, sourceLanguage, targetLanguage }),
    signal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
  })
}

export async function translateFileApi(
  text: string,
  fileName: string,
  sourceLanguage: TranslateLanguage,
  targetLanguage: TranslateLanguage,
): Promise<TranslationResult> {
  return requestApi<TranslationResult>('/api/translate/file', {
    method: 'POST',
    body: JSON.stringify({ text, fileName, sourceLanguage, targetLanguage }),
    signal: AbortSignal.timeout(FILE_TIMEOUT_MS),
  })
}

export async function listTranslationHistoryApi(): Promise<TranslationResult[]> {
  const data = await requestApi<{ translations: TranslationResult[] }>('/api/translations')
  return data.translations
}

export async function clearTranslationHistoryApi(): Promise<number> {
  const data = await requestApi<{ deleted: number }>('/api/translations', { method: 'DELETE' })
  return data.deleted
}

export async function lookupWordApi(word: string): Promise<WordLookup> {
  const data = await translateTextApi(word, 'en', 'vi')
  return {
    word,
    translation: data.translatedText,
    phonetic: data.wordDetails?.phonetic ?? '',
    partOfSpeech: data.wordDetails?.partOfSpeech ?? '',
    meaning: data.wordDetails?.meaning || data.translatedText,
    example: data.wordDetails?.example ?? '',
  }
}
