import { HttpError } from '../../middleware/error-handler';
import * as repo from './admin.catalog.repository';
import type {
  AdminBattleWord,
  AdminShopItem,
  AdminShopItemRow,
  AdminVideoVocabulary,
  BattleWordInput,
  BattleWordPatch,
  ShopItemInput,
  ShopItemPatch,
  VideoVocabularyInput,
  VideoVocabularyPatch,
} from './admin.catalog.types';
import { validateUnlockPair } from './admin.catalog.validation';
import { nextAvailableCode } from './admin.validation';
import { isDuplicateKeyError } from '../../utils/db-errors';

function parseStyle(raw: AdminShopItemRow['style_json']): Record<string, string | null> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object') {
    const result: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value === null || typeof value === 'string') result[key] = value;
    }
    return result;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parseStyle(parsed as Record<string, unknown>);
  } catch {
    return null;
  }
}

function mapShopItem(row: AdminShopItemRow): AdminShopItem {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    description: row.description,
    slot: row.slot,
    rarity: row.rarity,
    price: Number(row.price),
    unlock_type: row.unlock_type,
    unlock_value: row.unlock_value,
    visual_key: row.visual_key,
    style: parseStyle(row.style_json),
    booster_kind: row.booster_kind,
    booster_charges: Number(row.booster_charges),
    booster_duration_minutes: Number(row.booster_duration_minutes),
    sort_order: Number(row.sort_order),
    active: row.active === true || row.active === 1,
    created_at: new Date(row.created_at).toISOString(),
  };
}

// --- Shop items -----------------------------------------------------------

export async function listShopItems(): Promise<AdminShopItem[]> {
  const rows = await repo.getShopItemRows();
  return rows.map(mapShopItem);
}

export async function getShopItem(itemId: number): Promise<AdminShopItem> {
  const row = await repo.getShopItemRow(itemId);
  if (!row) throw new HttpError(404, 'Shop item not found.');
  return mapShopItem(row);
}

export async function createShopItem(input: ShopItemInput): Promise<AdminShopItem> {
  const code = input.code
    ? input.code
    : nextAvailableCode(input.name, new Set((await repo.getShopItemRows()).map((row) => row.code)), 'item');
  if (input.code && await repo.findShopItemByCode(input.code)) {
    throw new HttpError(409, 'Shop item code already exists.', ['CODE_TAKEN']);
  }

  const sortOrder = await repo.nextShopSortOrder();
  try {
    const id = await repo.insertShopItem({
      code,
      name: input.name,
      description: input.description,
      slot: input.slot,
      rarity: input.rarity,
      price: input.price,
      unlockType: input.unlockType,
      unlockValue: input.unlockValue,
      visualKey: input.visualKey,
      styleJson: input.style ? JSON.stringify(input.style) : null,
      boosterKind: input.boosterKind,
      boosterCharges: input.boosterCharges,
      boosterDurationMinutes: input.boosterDurationMinutes,
      sortOrder,
      active: input.active,
    });
    return getShopItem(id);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, 'Shop item code already exists.', ['CODE_TAKEN']);
    }
    throw error;
  }
}

export async function updateShopItem(itemId: number, patch: ShopItemPatch): Promise<AdminShopItem> {
  const existing = await repo.getShopItemRow(itemId);
  if (!existing) throw new HttpError(404, 'Shop item not found.');

  if (patch.code !== undefined && patch.code !== existing.code) {
    throw new HttpError(422, 'Validation failed', ['code cannot be changed.']);
  }

  const slot = patch.slot ?? existing.slot;
  const boosterKind = patch.boosterKind !== undefined ? patch.boosterKind : existing.booster_kind;
  const boosterCharges = patch.boosterCharges !== undefined
    ? patch.boosterCharges
    : Number(existing.booster_charges);
  const boosterDuration = patch.boosterDurationMinutes !== undefined
    ? patch.boosterDurationMinutes
    : Number(existing.booster_duration_minutes);

  if (slot === 'booster') {
    if (!boosterKind) {
      throw new HttpError(422, 'Validation failed', ['booster_kind is required for a booster item.']);
    }
    if (boosterCharges <= 0 && boosterDuration <= 0) {
      throw new HttpError(422, 'Validation failed', ['A booster needs charges or a duration.']);
    }
  } else if (boosterKind || boosterCharges > 0 || boosterDuration > 0) {
    throw new HttpError(422, 'Validation failed', ['Only booster items can define booster behaviour.']);
  }

  const unlockType = patch.unlockType ?? existing.unlock_type;
  const unlockValue = patch.unlockValue !== undefined ? patch.unlockValue : existing.unlock_value;
  const normalizedUnlock = validateUnlockPair(unlockType, unlockValue);
  const finalPatch: ShopItemPatch = {
    ...patch,
    unlockValue: normalizedUnlock,
  };

  try {
    await repo.updateShopItem(itemId, finalPatch);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, 'Shop item code already exists.', ['CODE_TAKEN']);
    }
    throw error;
  }
  return getShopItem(itemId);
}

export async function deleteShopItem(itemId: number): Promise<void> {
  const deleted = await repo.deleteShopItemRow(itemId);
  if (!deleted) throw new HttpError(404, 'Shop item not found.');
}

// --- Arena vocabulary -----------------------------------------------------

export async function listBattleWords(): Promise<AdminBattleWord[]> {
  return repo.getBattleWordRows();
}

export async function getBattleWord(wordId: number): Promise<AdminBattleWord> {
  const row = await repo.getBattleWordRow(wordId);
  if (!row) throw new HttpError(404, 'Battle word not found.');
  return row;
}

export async function createBattleWord(input: BattleWordInput): Promise<AdminBattleWord> {
  if (await repo.findBattleWordByWord(input.wordEn)) {
    throw new HttpError(409, 'This word already exists in the arena.', ['WORD_TAKEN']);
  }
  const sortOrder = await repo.nextBattleSortOrder();
  try {
    const id = await repo.insertBattleWord(input, sortOrder);
    return getBattleWord(id);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, 'This word already exists in the arena.', ['WORD_TAKEN']);
    }
    throw error;
  }
}

export async function updateBattleWord(wordId: number, patch: BattleWordPatch): Promise<AdminBattleWord> {
  const existing = await repo.getBattleWordRow(wordId);
  if (!existing) throw new HttpError(404, 'Battle word not found.');
  if (patch.wordEn !== undefined) {
    const duplicate = await repo.findBattleWordByWord(patch.wordEn);
    if (duplicate && Number(duplicate.id) !== wordId) {
      throw new HttpError(409, 'This word already exists in the arena.', ['WORD_TAKEN']);
    }
  }
  try {
    await repo.updateBattleWord(wordId, patch);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, 'This word already exists in the arena.', ['WORD_TAKEN']);
    }
    throw error;
  }
  return getBattleWord(wordId);
}

export async function deleteBattleWord(wordId: number): Promise<void> {
  const deleted = await repo.deleteBattleWordRow(wordId);
  if (!deleted) throw new HttpError(404, 'Battle word not found.');
}

// --- Video vocabulary -----------------------------------------------------

export async function listVideoVocabulary(videoId: number): Promise<AdminVideoVocabulary[]> {
  const video = await repo.getSharedVideoRow(videoId);
  if (!video) throw new HttpError(404, 'Shared video not found.');
  return repo.getVideoVocabularyRows(videoId);
}

export async function createVideoVocabulary(
  videoId: number,
  input: VideoVocabularyInput,
): Promise<AdminVideoVocabulary> {
  const video = await repo.getSharedVideoRow(videoId);
  if (!video) throw new HttpError(404, 'Shared video not found.');
  if (await repo.findVideoVocabularyWord(videoId, input.word)) {
    throw new HttpError(409, 'This word already exists in the video.', ['WORD_TAKEN']);
  }
  const sortOrder = await repo.nextVideoVocabularySortOrder(videoId);
  try {
    const id = await repo.insertVideoVocabulary(videoId, input, sortOrder);
    const row = await repo.getVideoVocabularyRow(id);
    if (!row) throw new HttpError(500, 'Created vocabulary could not be loaded.');
    return row;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, 'This word already exists in the video.', ['WORD_TAKEN']);
    }
    throw error;
  }
}

export async function updateVideoVocabulary(
  vocabularyId: number,
  patch: VideoVocabularyPatch,
): Promise<AdminVideoVocabulary> {
  const existing = await repo.getVideoVocabularyRow(vocabularyId);
  if (!existing) throw new HttpError(404, 'Vocabulary not found.');
  if (patch.word !== undefined) {
    const duplicate = await repo.findVideoVocabularyWord(Number(existing.video_id), patch.word);
    if (duplicate && Number(duplicate.id) !== vocabularyId) {
      throw new HttpError(409, 'This word already exists in the video.', ['WORD_TAKEN']);
    }
  }
  try {
    await repo.updateVideoVocabulary(vocabularyId, patch);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, 'This word already exists in the video.', ['WORD_TAKEN']);
    }
    throw error;
  }
  const row = await repo.getVideoVocabularyRow(vocabularyId);
  if (!row) throw new HttpError(404, 'Vocabulary not found.');
  return row;
}

export async function deleteVideoVocabulary(vocabularyId: number): Promise<void> {
  const deleted = await repo.deleteVideoVocabularyRow(vocabularyId);
  if (!deleted) throw new HttpError(404, 'Vocabulary not found.');
}
