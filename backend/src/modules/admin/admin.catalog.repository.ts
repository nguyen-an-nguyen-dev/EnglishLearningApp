import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../db/pool';
import type {
  AdminBattleWordRow,
  AdminShopItemRow,
  AdminVideoVocabularyRow,
  BattleWordInput,
  BattleWordPatch,
  ShopItemPatch,
  VideoVocabularyInput,
  VideoVocabularyPatch,
} from './admin.catalog.types';

interface NumberRow extends RowDataPacket {
  value: number | null;
}

async function nextOrder(table: string, column: string, where?: string, params: Array<string | number> = []): Promise<number> {
  const scope = where ? ` WHERE ${where}` : '';
  const [rows] = await pool.execute<NumberRow[]>(
    `SELECT COALESCE(MAX(${column}), 0) AS value FROM ${table}${scope}`,
    params,
  );
  return Number(rows[0]?.value ?? 0) + 10;
}

const SHOP_COLUMNS = `id, code, name, description, slot, rarity, price, unlock_type,
  unlock_value, visual_key, style_json, booster_kind, booster_charges,
  booster_duration_minutes, sort_order, active, created_at`;

export async function getShopItemRows(): Promise<AdminShopItemRow[]> {
  const [rows] = await pool.execute<AdminShopItemRow[]>(
    `SELECT ${SHOP_COLUMNS} FROM shop_items ORDER BY sort_order ASC, id ASC`,
  );
  return rows;
}

export async function getShopItemRow(itemId: number): Promise<AdminShopItemRow | undefined> {
  const [rows] = await pool.execute<AdminShopItemRow[]>(
    `SELECT ${SHOP_COLUMNS} FROM shop_items WHERE id = ? LIMIT 1`,
    [itemId],
  );
  return rows[0];
}

export async function findShopItemByCode(code: string): Promise<AdminShopItemRow | undefined> {
  const [rows] = await pool.execute<AdminShopItemRow[]>(
    `SELECT ${SHOP_COLUMNS} FROM shop_items WHERE code = ? LIMIT 1`,
    [code],
  );
  return rows[0];
}

export async function nextShopSortOrder(): Promise<number> {
  return nextOrder('shop_items', 'sort_order');
}

export async function insertShopItem(input: {
  code: string;
  name: string;
  description: string;
  slot: string;
  rarity: string;
  price: number;
  unlockType: string;
  unlockValue: string | null;
  visualKey: string;
  styleJson: string | null;
  boosterKind: string | null;
  boosterCharges: number;
  boosterDurationMinutes: number;
  sortOrder: number;
  active: boolean;
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO shop_items
       (code, name, description, slot, rarity, price, unlock_type, unlock_value,
        visual_key, style_json, booster_kind, booster_charges, booster_duration_minutes,
        sort_order, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.code,
      input.name,
      input.description,
      input.slot,
      input.rarity,
      input.price,
      input.unlockType,
      input.unlockValue,
      input.visualKey,
      input.styleJson,
      input.boosterKind,
      input.boosterCharges,
      input.boosterDurationMinutes,
      input.sortOrder,
      input.active ? 1 : 0,
    ],
  );
  return result.insertId;
}

export async function updateShopItem(itemId: number, patch: ShopItemPatch): Promise<void> {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  if (patch.name !== undefined) { sets.push('name = ?'); params.push(patch.name); }
  if (patch.description !== undefined) { sets.push('description = ?'); params.push(patch.description); }
  if (patch.slot !== undefined) { sets.push('slot = ?'); params.push(patch.slot); }
  if (patch.rarity !== undefined) { sets.push('rarity = ?'); params.push(patch.rarity); }
  if (patch.price !== undefined) { sets.push('price = ?'); params.push(patch.price); }
  if (patch.unlockType !== undefined) { sets.push('unlock_type = ?'); params.push(patch.unlockType); }
  if (patch.unlockValue !== undefined) { sets.push('unlock_value = ?'); params.push(patch.unlockValue); }
  if (patch.visualKey !== undefined) { sets.push('visual_key = ?'); params.push(patch.visualKey); }
  if (patch.style !== undefined) {
    sets.push('style_json = ?');
    params.push(patch.style === null ? null : JSON.stringify(patch.style));
  }
  if (patch.boosterKind !== undefined) { sets.push('booster_kind = ?'); params.push(patch.boosterKind); }
  if (patch.boosterCharges !== undefined) { sets.push('booster_charges = ?'); params.push(patch.boosterCharges); }
  if (patch.boosterDurationMinutes !== undefined) {
    sets.push('booster_duration_minutes = ?');
    params.push(patch.boosterDurationMinutes);
  }
  if (patch.active !== undefined) { sets.push('active = ?'); params.push(patch.active ? 1 : 0); }
  if (sets.length === 0) return;
  params.push(itemId);
  await pool.execute(`UPDATE shop_items SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteShopItemRow(itemId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM shop_items WHERE id = ?', [itemId]);
  return result.affectedRows > 0;
}

const BATTLE_COLUMNS = `id, word_en, translation_vi, part_of_speech, cefr_level,
  explanation_vi, example_en, example_vi, image_url, sort_order`;

export async function getBattleWordRows(): Promise<AdminBattleWordRow[]> {
  const [rows] = await pool.execute<AdminBattleWordRow[]>(
    `SELECT ${BATTLE_COLUMNS} FROM battle_words ORDER BY sort_order ASC`,
  );
  return rows;
}

export async function getBattleWordRow(wordId: number): Promise<AdminBattleWordRow | undefined> {
  const [rows] = await pool.execute<AdminBattleWordRow[]>(
    `SELECT ${BATTLE_COLUMNS} FROM battle_words WHERE id = ? LIMIT 1`,
    [wordId],
  );
  return rows[0];
}

export async function findBattleWordByWord(word: string): Promise<AdminBattleWordRow | undefined> {
  const [rows] = await pool.execute<AdminBattleWordRow[]>(
    `SELECT ${BATTLE_COLUMNS} FROM battle_words WHERE word_en = ? LIMIT 1`,
    [word],
  );
  return rows[0];
}

export async function nextBattleSortOrder(): Promise<number> {
  return nextOrder('battle_words', 'sort_order');
}

export async function insertBattleWord(input: BattleWordInput, sortOrder: number): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO battle_words
       (word_en, translation_vi, part_of_speech, cefr_level, explanation_vi,
        example_en, example_vi, image_url, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.wordEn,
      input.translationVi,
      input.partOfSpeech,
      input.cefrLevel,
      input.explanationVi,
      input.exampleEn,
      input.exampleVi,
      input.imageUrl,
      sortOrder,
    ],
  );
  return result.insertId;
}

export async function updateBattleWord(wordId: number, patch: BattleWordPatch): Promise<void> {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  if (patch.wordEn !== undefined) { sets.push('word_en = ?'); params.push(patch.wordEn); }
  if (patch.translationVi !== undefined) { sets.push('translation_vi = ?'); params.push(patch.translationVi); }
  if (patch.partOfSpeech !== undefined) { sets.push('part_of_speech = ?'); params.push(patch.partOfSpeech); }
  if (patch.cefrLevel !== undefined) { sets.push('cefr_level = ?'); params.push(patch.cefrLevel); }
  if (patch.explanationVi !== undefined) { sets.push('explanation_vi = ?'); params.push(patch.explanationVi); }
  if (patch.exampleEn !== undefined) { sets.push('example_en = ?'); params.push(patch.exampleEn); }
  if (patch.exampleVi !== undefined) { sets.push('example_vi = ?'); params.push(patch.exampleVi); }
  if (patch.imageUrl !== undefined) { sets.push('image_url = ?'); params.push(patch.imageUrl); }
  if (sets.length === 0) return;
  params.push(wordId);
  await pool.execute(`UPDATE battle_words SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteBattleWordRow(wordId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM battle_words WHERE id = ?', [wordId]);
  return result.affectedRows > 0;
}

const VIDEO_VOCAB_COLUMNS = 'id, video_id, word, ipa, meaning_vi, detail_vi, sort_order';

export async function getVideoVocabularyRows(videoId: number): Promise<AdminVideoVocabularyRow[]> {
  const [rows] = await pool.execute<AdminVideoVocabularyRow[]>(
    `SELECT ${VIDEO_VOCAB_COLUMNS} FROM video_vocabulary WHERE video_id = ? ORDER BY sort_order ASC`,
    [videoId],
  );
  return rows;
}

export async function getVideoVocabularyRow(vocabularyId: number): Promise<AdminVideoVocabularyRow | undefined> {
  const [rows] = await pool.execute<AdminVideoVocabularyRow[]>(
    `SELECT ${VIDEO_VOCAB_COLUMNS} FROM video_vocabulary WHERE id = ? LIMIT 1`,
    [vocabularyId],
  );
  return rows[0];
}

export async function findVideoVocabularyWord(
  videoId: number,
  word: string,
): Promise<AdminVideoVocabularyRow | undefined> {
  const [rows] = await pool.execute<AdminVideoVocabularyRow[]>(
    `SELECT ${VIDEO_VOCAB_COLUMNS} FROM video_vocabulary WHERE video_id = ? AND word = ? LIMIT 1`,
    [videoId, word],
  );
  return rows[0];
}

export async function nextVideoVocabularySortOrder(videoId: number): Promise<number> {
  return nextOrder('video_vocabulary', 'sort_order', 'video_id = ?', [videoId]);
}

export async function insertVideoVocabulary(
  videoId: number,
  input: VideoVocabularyInput,
  sortOrder: number,
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO video_vocabulary (video_id, word, ipa, meaning_vi, detail_vi, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [videoId, input.word, input.ipa, input.meaningVi, input.detailVi, sortOrder],
  );
  return result.insertId;
}

export async function updateVideoVocabulary(
  vocabularyId: number,
  patch: VideoVocabularyPatch,
): Promise<void> {
  const sets: string[] = [];
  const params: Array<string | number> = [];
  if (patch.word !== undefined) { sets.push('word = ?'); params.push(patch.word); }
  if (patch.ipa !== undefined) { sets.push('ipa = ?'); params.push(patch.ipa); }
  if (patch.meaningVi !== undefined) { sets.push('meaning_vi = ?'); params.push(patch.meaningVi); }
  if (patch.detailVi !== undefined) { sets.push('detail_vi = ?'); params.push(patch.detailVi); }
  if (sets.length === 0) return;
  params.push(vocabularyId);
  await pool.execute(`UPDATE video_vocabulary SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteVideoVocabularyRow(vocabularyId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM video_vocabulary WHERE id = ?',
    [vocabularyId],
  );
  return result.affectedRows > 0;
}

interface SharedVideoRow extends RowDataPacket {
  id: number;
  title: string;
}

export async function getSharedVideoRow(videoId: number): Promise<SharedVideoRow | undefined> {
  const [rows] = await pool.execute<SharedVideoRow[]>(
    'SELECT id, title FROM video_lessons WHERE id = ? AND owner_user_id IS NULL LIMIT 1',
    [videoId],
  );
  return rows[0];
}
