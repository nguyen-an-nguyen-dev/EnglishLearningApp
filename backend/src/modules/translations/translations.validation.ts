import { HttpError } from '../../middleware/error-handler';
import type { LanguageCode } from './translations.types';

export const MAX_TRANSLATION_CHARACTERS = 10_000;
export const MAX_TRANSLATION_FILE_BYTES = 20 * 1024;
export const MAX_TRANSLATION_CHUNK_CHARACTERS = 2_000;

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

// The mobile client reads the picked .txt locally and posts its content as JSON, because Expo's
// fetch cannot serialize React Native's `{ uri }` FormData parts.
export function parseInlineFileText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(422, 'Choose a .txt file with text to translate.');
  }
  const text = value.trim();
  if (text.includes('\u0000')) throw new HttpError(422, 'The file is not valid plain text.');
  if (Buffer.byteLength(text, 'utf8') > MAX_TRANSLATION_FILE_BYTES) {
    throw new HttpError(413, `File is too large. Maximum size is ${MAX_TRANSLATION_FILE_BYTES / 1024} KB.`);
  }
  return text;
}

export function parseInlineFileName(value: unknown): string {
  const fileName = typeof value === 'string' && value.trim() ? value.trim().slice(0, 255) : 'document.txt';
  if (!fileName.toLowerCase().endsWith('.txt')) throw new HttpError(422, 'Only .txt files are supported.');
  return fileName;
}

export function isSingleWord(text: string): boolean {
  return /^[\p{L}]+(?:['’-][\p{L}]+)*$/u.test(text.trim());
}

// Provider latency is dominated by request queueing, not payload size, so a long document is
// translated as parallel chunks and rejoined. Lines are kept intact where possible to preserve
// paragraph breaks, and the chunks are joined back with the same newlines.
export function splitTranslationChunks(
  text: string,
  maxChars = MAX_TRANSLATION_CHUNK_CHARACTERS,
): string[] {
  if (text.length <= maxChars) return [text];

  const lines = text.split('\n');
  const pieces: string[] = [];
  for (const line of lines) {
    if (line.length <= maxChars) {
      pieces.push(line);
      continue;
    }
    let rest = line;
    while (rest.length > maxChars) {
      const space = rest.lastIndexOf(' ', maxChars);
      const cut = space > maxChars / 2 ? space : maxChars;
      pieces.push(rest.slice(0, cut));
      rest = rest.slice(cut).replace(/^ +/, '');
    }
    if (rest) pieces.push(rest);
  }

  const chunks: string[] = [];
  let current: string | null = null;
  for (const piece of pieces) {
    if (current === null) {
      current = piece;
    } else if (current.length + piece.length + 1 <= maxChars) {
      current += `\n${piece}`;
    } else {
      chunks.push(current);
      current = piece;
    }
  }
  if (current !== null) chunks.push(current);
  return chunks;
}
