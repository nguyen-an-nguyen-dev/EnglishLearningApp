import { HttpError } from '../../middleware/error-handler';
import type { LanguageCode } from './translations.types';

export const MAX_TRANSLATION_CHARACTERS = 10_000;
export const MAX_TRANSLATION_FILE_BYTES = 100 * 1024;

export function parseLanguages(sourceValue: unknown, targetValue: unknown): {
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
} {
  if ((sourceValue !== 'en' && sourceValue !== 'vi')
    || (targetValue !== 'en' && targetValue !== 'vi')
    || sourceValue === targetValue) {
    throw new HttpError(422, 'sourceLanguage and targetLanguage must be en/vi in opposite directions.');
  }
  return {
    sourceLanguage: sourceValue,
    targetLanguage: targetValue,
  };
}

export function parseTranslationText(
  value: unknown,
  maxLength = MAX_TRANSLATION_CHARACTERS,
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(422, 'Text to translate cannot be empty.');
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new HttpError(413, `Text is too long. Maximum length is ${maxLength.toLocaleString()} characters.`);
  }
  return text;
}

export function isSingleWord(text: string): boolean {
  return /^[\p{L}]+(?:['’-][\p{L}]+)*$/u.test(text.trim());
}
