import type { RowDataPacket } from 'mysql2';

export type LanguageCode = 'en' | 'vi';
export type WordPartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'pronoun' | 'preposition' | 'conjunction' | 'interjection' | 'other';

export interface WordDetails {
  word: string;
  phonetic: string;
  partOfSpeech: WordPartOfSpeech;
  meaning: string;
  example: string;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  fileName: string | null;
  wordDetails: WordDetails | null;
  id?: number;
  createdAt?: Date;
}

export interface TranslationHistoryRow extends RowDataPacket {
  id: number;
  file_name: string | null;
  original_text: string;
  translated_text: string;
  source_language: LanguageCode;
  target_language: LanguageCode;
  created_at: Date;
}

export interface TranslationProviderResponse {
  translation: string;
  wordDetails?: WordDetails | null;
}
