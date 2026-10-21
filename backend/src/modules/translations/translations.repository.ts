import type { ResultSetHeader } from 'mysql2/promise';
import { pool } from '../../db/pool';
import type { LanguageCode, TranslationHistoryRow, TranslationResult } from './translations.types';

export async function saveTranslation(
  userId: number,
  result: TranslationResult,
): Promise<TranslationResult> {
  const [insertResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO translations
       (user_id, file_name, original_text, source_language, translated_text, target_language, provider)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      result.fileName,
      result.originalText,
      result.sourceLanguage,
      result.translatedText,
      result.targetLanguage,
      'Gemini',
    ],
  );
  const [rows] = await pool.execute<TranslationHistoryRow[]>(
    `SELECT id, file_name, original_text, translated_text, source_language, target_language, created_at
     FROM translations WHERE id = ? AND user_id = ? LIMIT 1`,
    [insertResult.insertId, userId],
  );
  const row = rows[0];
  if (!row) throw new Error('Saved translation could not be loaded.');
  return {
    id: row.id,
    originalText: row.original_text,
    translatedText: row.translated_text,
    sourceLanguage: row.source_language,
    targetLanguage: row.target_language,
    fileName: row.file_name,
    wordDetails: result.wordDetails,
    createdAt: row.created_at,
  };
}

export async function listTranslations(userId: number): Promise<TranslationResult[]> {
  const [rows] = await pool.execute<TranslationHistoryRow[]>(
    `SELECT id, file_name, original_text, translated_text, source_language, target_language, created_at
     FROM translations WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`,
    [userId],
  );
  return rows.map((row) => ({
    id: row.id,
    originalText: row.original_text,
    translatedText: row.translated_text,
    sourceLanguage: row.source_language as LanguageCode,
    targetLanguage: row.target_language as LanguageCode,
    fileName: row.file_name,
    wordDetails: null,
    createdAt: row.created_at,
  }));
}
