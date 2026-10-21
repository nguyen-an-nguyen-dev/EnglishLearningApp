import { env } from '../../config/env';
import { HttpError } from '../../middleware/error-handler';
import * as repository from './translations.repository';
import {
  isSingleWord,
  MAX_TRANSLATION_CHARACTERS,
  MAX_TRANSLATION_FILE_BYTES,
  parseTranslationText,
} from './translations.validation';
import type {
  LanguageCode,
  TranslationProviderResponse,
  TranslationResult,
  WordDetails,
} from './translations.types';

const PARTS_OF_SPEECH = new Set([
  'noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition',
  'conjunction', 'interjection', 'other',
]);
const PART_OF_SPEECH_ALIASES: Record<string, WordDetails['partOfSpeech']> = {
  n: 'noun',
  n0: 'noun',
  v: 'verb',
  v0: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  prep: 'preposition',
  conj: 'conjunction',
  int: 'interjection',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseProviderResult(content: string, word: string | null): TranslationProviderResponse {
  const normalizedContent = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let value: unknown;
  try {
    value = JSON.parse(normalizedContent) as unknown;
  } catch {
    if (!normalizedContent) {
      throw new HttpError(502, 'The translation provider returned an empty translation.');
    }
    return {
      translation: normalizedContent.slice(0, MAX_TRANSLATION_CHARACTERS * 4),
      wordDetails: null,
    };
  }
  if (typeof value === 'string' && value.trim()) {
    return {
      translation: value.trim().slice(0, MAX_TRANSLATION_CHARACTERS * 4),
      wordDetails: null,
    };
  }
  if (!isRecord(value)) {
    throw new HttpError(502, 'The translation provider returned an empty or invalid translation.');
  }
  const rawTranslation = value.translation ?? value.translatedText ?? value.translated_text;
  if (typeof rawTranslation !== 'string' || !rawTranslation.trim()) {
    throw new HttpError(502, 'The translation provider returned an empty or invalid translation.');
  }

  let wordDetails: WordDetails | null = null;
  if (word && isRecord(value.wordDetails)) {
    const details = value.wordDetails;
    const rawPartOfSpeech = typeof details.partOfSpeech === 'string'
      ? details.partOfSpeech.trim().toLowerCase()
      : typeof details.part_of_speech === 'string' ? details.part_of_speech.trim().toLowerCase() : '';
    const normalizedPartOfSpeech = rawPartOfSpeech
      .replace(/\s*\([^)]*\)\s*/g, '')
      .replace(/[.\s]+/g, '');
    const partOfSpeech = PARTS_OF_SPEECH.has(normalizedPartOfSpeech)
      ? normalizedPartOfSpeech as WordDetails['partOfSpeech']
      : PART_OF_SPEECH_ALIASES[normalizedPartOfSpeech] ?? 'other';
    const rawMeaning = details.meaning ?? details.definition;
    const rawExample = details.example ?? details.exampleSentence ?? details.example_sentence;
    wordDetails = {
      word,
      phonetic: typeof details.phonetic === 'string' ? details.phonetic.trim().slice(0, 120) : '',
      partOfSpeech,
      meaning: typeof rawMeaning === 'string' && rawMeaning.trim()
        ? rawMeaning.trim().slice(0, 1000)
        : rawTranslation.trim().slice(0, 1000),
      example: typeof rawExample === 'string' ? rawExample.trim().slice(0, 1000) : '',
    };
  }
  return {
    translation: rawTranslation.trim().slice(0, MAX_TRANSLATION_CHARACTERS * 4),
    wordDetails,
  };
}

function promptForTranslation(
  text: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  word: string | null,
): string {
  const source = sourceLanguage === 'en' ? 'English' : 'Vietnamese';
  const target = targetLanguage === 'en' ? 'English' : 'Vietnamese';
  const wordInstructions = word
    ? 'Also provide wordDetails with phonetic (IPA, empty if uncertain), partOfSpeech (noun, verb, adjective, adverb, pronoun, preposition, conjunction, interjection, other), meaning (in the target language), and a short natural example in English.'
    : 'Return only the translated text. Do not include explanations, labels, or quotation marks.';
  return [
    `Translate the following ${source} text into natural ${target}.`,
    'Preserve the meaning. Keep the translation concise.',
    wordInstructions,
    ...(word ? ['Return only a JSON object with keys "translation" and "wordDetails".'] : []),
    `TEXT_TO_TRANSLATE:\n${text}`,
  ].join('\n');
}

async function translateWithGemini(
  text: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  word: string | null,
): Promise<TranslationProviderResponse> {
  if (!env.aiApiKey.trim()) {
    throw new HttpError(503, 'Dịch vụ dịch chưa được cấu hình. Hãy kiểm tra AI_API_KEY trong backend/.env.');
  }

  const prompt = promptForTranslation(text, sourceLanguage, targetLanguage, word);
  const maxTokens = Math.min(8192, Math.max(256, Math.ceil(text.length * 0.5) + 128));
  let response: Response;
  try {
    response = await fetch(env.aiApiUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.aiApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.aiModel,
        messages: [{ role: 'user', content: prompt }],
        ...(word ? { response_format: { type: 'json_object' } } : {}),
        temperature: 0.1,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(env.aiTimeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new HttpError(504, 'Translation timed out. Please try again.');
    }
    throw new HttpError(503, 'The translation service is unavailable. Check your connection and try again.');
  }

  if (response.status === 429) throw new HttpError(429, 'The translation service is busy. Please try again shortly.');
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(503, 'Gemini rejected the backend API key or its permissions. Check backend AI_API_KEY.');
  }
  if (response.status === 400 || response.status === 404) {
    throw new HttpError(503, 'Gemini rejected the model or request. Check backend AI_MODEL and Gemini settings.');
  }
  if (!response.ok) throw new HttpError(503, 'The translation service is temporarily unavailable.');

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new HttpError(502, 'The translation provider returned an invalid response.');
  }
  if (!isRecord(payload) || !Array.isArray(payload.choices)
    || !isRecord(payload.choices[0]) || !isRecord(payload.choices[0].message)
    || typeof payload.choices[0].message.content !== 'string'
    || !payload.choices[0].message.content.trim()) {
    throw new HttpError(502, 'The translation provider returned an empty or invalid response.');
  }
  const content = payload.choices[0].message.content.trim();
  return word
    ? parseProviderResult(content, word)
    : { translation: content.slice(0, MAX_TRANSLATION_CHARACTERS * 4), wordDetails: null };
}

export async function translateText(
  userId: number,
  rawText: unknown,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  fileName: string | null = null,
): Promise<TranslationResult> {
  const text = parseTranslationText(
    rawText,
    fileName ? MAX_TRANSLATION_FILE_BYTES : MAX_TRANSLATION_CHARACTERS,
  );
  const word = isSingleWord(text) ? text : null;
  const providerResult = await translateWithGemini(text, sourceLanguage, targetLanguage, word);
  return repository.saveTranslation(userId, {
    originalText: text,
    translatedText: providerResult.translation,
    sourceLanguage,
    targetLanguage,
    fileName,
    wordDetails: providerResult.wordDetails ?? null,
  });
}

export async function listHistory(userId: number): Promise<TranslationResult[]> {
  return repository.listTranslations(userId);
}
