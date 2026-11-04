import { requestApi } from './apiClient'
import type { WordLookup } from '../types/video'

interface TranslationResult {
  originalText: string
  translatedText: string
  wordDetails: {
    word: string
    phonetic: string
    partOfSpeech: string
    meaning: string
    example: string
  } | null
}

export async function lookupWordApi(word: string): Promise<WordLookup> {
  const data = await requestApi<TranslationResult>('/api/translate', {
    method: 'POST',
    body: JSON.stringify({
      text: word,
      sourceLanguage: 'en',
      targetLanguage: 'vi',
    }),
  })
  return {
    word,
    translation: data.translatedText,
    phonetic: data.wordDetails?.phonetic ?? '',
    partOfSpeech: data.wordDetails?.partOfSpeech ?? '',
    meaning: data.wordDetails?.meaning || data.translatedText,
    example: data.wordDetails?.example ?? '',
  }
}
