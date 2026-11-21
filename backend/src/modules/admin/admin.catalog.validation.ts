import { HttpError } from '../../middleware/error-handler';
import { CEFR_LEVELS } from './admin.types';
import { asObject, boundedInt } from '../../utils/validation';
import {
  BATTLE_PARTS_OF_SPEECH,
  BOOSTER_KINDS,
  LEAGUE_TIERS,
  SHOP_RARITIES,
  SHOP_SLOTS,
  SHOP_UNLOCK_TYPES,
  type AdminCefrLevel,
  type BattlePartOfSpeech,
  type BattleWordInput,
  type BattleWordPatch,
  type ShopItemInput,
  type ShopItemPatch,
  type ShopSlotValue,
  type ShopRarityValue,
  type ShopUnlockTypeValue,
  type VideoVocabularyInput,
  type VideoVocabularyPatch,
} from './admin.catalog.types';
import { slugify } from './admin.validation';

function positiveId(value: unknown, field: string): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, `Invalid ${field}.`);
  return id;
}

export const parseShopItemId = (value: unknown): number => positiveId(value, 'shop item ID');
export const parseBattleWordId = (value: unknown): number => positiveId(value, 'word ID');
export const parseVideoVocabularyId = (value: unknown): number => positiveId(value, 'vocabulary ID');
export const parseVocabVideoId = (value: unknown): number => positiveId(value, 'video ID');

function text(
  raw: unknown,
  field: string,
  max: number,
  errors: string[],
  required: boolean,
): string | undefined {
  if (raw === undefined || raw === null) {
    if (required) errors.push(`${field} is required.`);
    return undefined;
  }
  if (typeof raw !== 'string') {
    errors.push(`${field} must be a string.`);
    return undefined;
  }
  const value = raw.trim();
  if (required && value.length === 0) {
    errors.push(`${field} must not be empty.`);
    return undefined;
  }
  if (value.length > max) errors.push(`${field} must be at most ${max} characters.`);
  return value;
}

function enumValue<T extends string>(
  raw: unknown,
  field: string,
  allowed: readonly T[],
  errors: string[],
): T | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' || !(allowed as readonly string[]).includes(raw)) {
    errors.push(`${field} must be one of ${allowed.join(', ')}.`);
    return undefined;
  }
  return raw as T;
}

function booleanValue(raw: unknown, field: string, errors: string[]): boolean | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'boolean') {
    errors.push(`${field} must be a boolean.`);
    return undefined;
  }
  return raw;
}

/** Unlock values differ by type, so validate the pair once the row is merged. */
export function validateUnlockPair(
  type: ShopUnlockTypeValue,
  value: string | null | undefined,
): string | null {
  if (type === 'default') return null;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    throw new HttpError(422, 'Validation failed', ['unlock_value is required for a locked item.']);
  }
  if (trimmed.length > 60) {
    throw new HttpError(422, 'Validation failed', ['unlock_value must be at most 60 characters.']);
  }
  if (type === 'level' || type === 'stage') {
    const numeric = Number(trimmed);
    if (!Number.isInteger(numeric) || numeric < 1) {
      throw new HttpError(422, 'Validation failed', [`unlock_value must be a positive integer for ${type}.`]);
    }
    return String(numeric);
  }
  if (type === 'league' && !(LEAGUE_TIERS as readonly string[]).includes(trimmed)) {
    throw new HttpError(422, 'Validation failed', [
      `unlock_value must be one of ${LEAGUE_TIERS.join(', ')} for a league unlock.`,
    ]);
  }
  return trimmed;
}

function parseStyle(raw: unknown, errors: string[]): Record<string, string | null> | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      errors.push('style must be valid JSON.');
      return undefined;
    }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push('style must be an object of colour values.');
    return undefined;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 40) {
    errors.push('style must have at most 40 keys.');
    return undefined;
  }
  const style: Record<string, string | null> = {};
  for (const [key, entry] of entries) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key)) {
      errors.push(`style key "${key}" is invalid.`);
      continue;
    }
    if (entry !== null && typeof entry !== 'string') {
      errors.push(`style.${key} must be a string or null.`);
      continue;
    }
    style[key] = typeof entry === 'string' ? entry.trim() : null;
  }
  if (JSON.stringify(style).length > 4_000) {
    errors.push('style is too large (max 4 KB).');
  }
  return style;
}

function unlockText(raw: unknown, errors: string[]): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'number') return String(raw);
  return text(raw, 'unlock_value', 60, errors, false);
}

const VISUAL_KEY = /^[a-z0-9][a-z0-9_-]{1,59}$/;
const SHOP_CODE = /^[a-z0-9][a-z0-9_-]{2,59}$/;

export function parseShopItemCreate(value: unknown): ShopItemInput {
  const body = asObject(value);
  const errors: string[] = [];
  const name = text(body.name, 'name', 120, errors, true) as string;
  const description = text(body.description, 'description', 500, errors, false) ?? '';
  const slot = enumValue(body.slot, 'slot', SHOP_SLOTS, errors) ?? 'car';
  const rarity = enumValue(body.rarity, 'rarity', SHOP_RARITIES, errors) ?? 'common';
  const price = boundedInt(body.price ?? 0, 'price', 0, 1_000_000, errors) ?? 0;
  const unlockType = enumValue(body.unlock_type ?? body.unlockType, 'unlock_type', SHOP_UNLOCK_TYPES, errors)
    ?? 'default';
  const rawUnlockValue = unlockText(body.unlock_value ?? body.unlockValue, errors);
  const codeRaw = text(body.code, 'code', 60, errors, false);
  let code: string | undefined;
  if (codeRaw) {
    if (!SHOP_CODE.test(codeRaw)) errors.push('code must be 3-60 lowercase letters, digits or underscores.');
    else code = codeRaw;
  }
  const visualRaw = text(body.visual_key ?? body.visualKey, 'visual_key', 60, errors, false);
  let visualKey: string | undefined;
  if (visualRaw) {
    if (!VISUAL_KEY.test(visualRaw)) errors.push('visual_key must be 2-60 lowercase letters, digits or underscores.');
    else visualKey = visualRaw;
  }
  const style = parseStyle(body.style ?? body.style_json ?? body.styleJson, errors);
  const boosterKindRaw = body.booster_kind ?? body.boosterKind;
  let boosterKind: (typeof BOOSTER_KINDS)[number] | null = null;
  if (boosterKindRaw !== undefined && boosterKindRaw !== null && boosterKindRaw !== '') {
    const parsed = enumValue(boosterKindRaw, 'booster_kind', BOOSTER_KINDS, errors);
    boosterKind = parsed ?? null;
  }
  const boosterCharges = boundedInt(body.booster_charges ?? body.boosterCharges ?? 0, 'booster_charges', 0, 1000, errors) ?? 0;
  const boosterDurationMinutes = boundedInt(
    body.booster_duration_minutes ?? body.boosterDurationMinutes ?? 0,
    'booster_duration_minutes',
    0,
    10_080,
    errors,
  ) ?? 0;
  const active = booleanValue(body.active, 'active', errors) ?? true;

  if (slot === 'booster') {
    if (!boosterKind) errors.push('booster_kind is required for a booster item.');
    if (boosterCharges <= 0 && boosterDurationMinutes <= 0) {
      errors.push('A booster needs booster_charges or booster_duration_minutes.');
    }
  } else if (boosterKind || boosterCharges > 0 || boosterDurationMinutes > 0) {
    errors.push('Only booster items can define booster behaviour.');
  }

  if (errors.length) throw new HttpError(422, 'Validation failed', errors);

  return {
    code: code ?? (slugify(name).slice(0, 46) || 'item'),
    name,
    description,
    slot: slot as ShopSlotValue,
    rarity: rarity as ShopRarityValue,
    price,
    unlockType,
    unlockValue: validateUnlockPair(unlockType, rawUnlockValue),
    visualKey: visualKey ?? (slugify(name).slice(0, 46) || 'item'),
    style: style ?? null,
    boosterKind,
    boosterCharges,
    boosterDurationMinutes,
    active,
  };
}

export function parseShopItemPatch(value: unknown): ShopItemPatch {
  const body = asObject(value);
  const errors: string[] = [];
  const patch: ShopItemPatch = {};

  if (body.name !== undefined) patch.name = text(body.name, 'name', 120, errors, true) as string;
  if (body.description !== undefined) patch.description = text(body.description, 'description', 500, errors, false) ?? '';
  if (body.slot !== undefined) patch.slot = enumValue(body.slot, 'slot', SHOP_SLOTS, errors) as ShopSlotValue;
  if (body.rarity !== undefined) patch.rarity = enumValue(body.rarity, 'rarity', SHOP_RARITIES, errors) as ShopRarityValue;
  if (body.price !== undefined) patch.price = boundedInt(body.price, 'price', 0, 1_000_000, errors);
  if (body.unlock_type !== undefined || body.unlockType !== undefined) {
    patch.unlockType = enumValue(
      body.unlock_type ?? body.unlockType,
      'unlock_type',
      SHOP_UNLOCK_TYPES,
      errors,
    );
  }
  if (body.unlock_value !== undefined || body.unlockValue !== undefined) {
    patch.unlockValue = unlockText(body.unlock_value ?? body.unlockValue, errors) ?? null;
  }
  if (body.visual_key !== undefined || body.visualKey !== undefined) {
    const visualKey = text(body.visual_key ?? body.visualKey, 'visual_key', 60, errors, true) as string;
    if (visualKey && !VISUAL_KEY.test(visualKey)) errors.push('visual_key is invalid.');
    else patch.visualKey = visualKey;
  }
  if (body.style !== undefined || body.style_json !== undefined || body.styleJson !== undefined) {
    const style = parseStyle(body.style ?? body.style_json ?? body.styleJson, errors);
    if (style !== undefined) patch.style = style;
  }
  if (body.booster_kind !== undefined || body.boosterKind !== undefined) {
    const raw = body.booster_kind ?? body.boosterKind;
    patch.boosterKind = raw === null || raw === ''
      ? null
      : enumValue(raw, 'booster_kind', BOOSTER_KINDS, errors) ?? null;
  }
  if (body.booster_charges !== undefined || body.boosterCharges !== undefined) {
    patch.boosterCharges = boundedInt(
      body.booster_charges ?? body.boosterCharges,
      'booster_charges',
      0,
      1000,
      errors,
    );
  }
  if (body.booster_duration_minutes !== undefined || body.boosterDurationMinutes !== undefined) {
    patch.boosterDurationMinutes = boundedInt(
      body.booster_duration_minutes ?? body.boosterDurationMinutes,
      'booster_duration_minutes',
      0,
      10_080,
      errors,
    );
  }
  if (body.active !== undefined) patch.active = booleanValue(body.active, 'active', errors);

  if (Object.keys(patch).length === 0) errors.push('Provide at least one field to update.');
  if (errors.length) throw new HttpError(422, 'Validation failed', errors);
  return patch;
}

function parseBattleBase(body: Record<string, unknown>, errors: string[]): Partial<BattleWordInput> {
  const input: Partial<BattleWordInput> = {};
  if (body.word_en !== undefined || body.wordEn !== undefined) {
    input.wordEn = text(body.word_en ?? body.wordEn, 'word_en', 64, errors, true);
  }
  if (body.translation_vi !== undefined || body.translationVi !== undefined) {
    input.translationVi = text(body.translation_vi ?? body.translationVi, 'translation_vi', 160, errors, true);
  }
  if (body.part_of_speech !== undefined || body.partOfSpeech !== undefined) {
    input.partOfSpeech = enumValue(
      body.part_of_speech ?? body.partOfSpeech,
      'part_of_speech',
      BATTLE_PARTS_OF_SPEECH,
      errors,
    ) as BattlePartOfSpeech;
  }
  if (body.cefr_level !== undefined || body.cefrLevel !== undefined) {
    input.cefrLevel = enumValue(
      body.cefr_level ?? body.cefrLevel,
      'cefr_level',
      CEFR_LEVELS,
      errors,
    ) as AdminCefrLevel;
  }
  if (body.explanation_vi !== undefined || body.explanationVi !== undefined) {
    input.explanationVi = text(
      body.explanation_vi ?? body.explanationVi,
      'explanation_vi',
      500,
      errors,
      true,
    );
  }
  if (body.example_en !== undefined || body.exampleEn !== undefined) {
    input.exampleEn = text(body.example_en ?? body.exampleEn, 'example_en', 300, errors, true);
  }
  if (body.example_vi !== undefined || body.exampleVi !== undefined) {
    input.exampleVi = text(body.example_vi ?? body.exampleVi, 'example_vi', 300, errors, true);
  }
  if (body.image_url !== undefined || body.imageUrl !== undefined) {
    input.imageUrl = text(body.image_url ?? body.imageUrl, 'image_url', 500, errors, false) || null;
  }
  return input;
}

export function parseBattleWordInput(value: unknown): BattleWordInput {
  const body = asObject(value);
  const errors: string[] = [];
  const base = parseBattleBase(body, errors);
  if (base.wordEn === undefined) errors.push('word_en is required.');
  if (base.translationVi === undefined) errors.push('translation_vi is required.');
  if (base.explanationVi === undefined) errors.push('explanation_vi is required.');
  if (base.exampleEn === undefined) errors.push('example_en is required.');
  if (base.exampleVi === undefined) errors.push('example_vi is required.');
  if (!base.partOfSpeech) errors.push('part_of_speech is required.');
  if (!base.cefrLevel) errors.push('cefr_level is required.');
  if (errors.length) throw new HttpError(422, 'Validation failed', errors);
  return {
    wordEn: base.wordEn as string,
    translationVi: base.translationVi as string,
    partOfSpeech: base.partOfSpeech as BattlePartOfSpeech,
    cefrLevel: base.cefrLevel as AdminCefrLevel,
    explanationVi: base.explanationVi as string,
    exampleEn: base.exampleEn as string,
    exampleVi: base.exampleVi as string,
    imageUrl: base.imageUrl ?? null,
  };
}

export function parseBattleWordPatch(value: unknown): BattleWordPatch {
  const body = asObject(value);
  const errors: string[] = [];
  const patch = parseBattleBase(body, errors);
  if (Object.keys(patch).length === 0) errors.push('Provide at least one field to update.');
  if (errors.length) throw new HttpError(422, 'Validation failed', errors);
  return patch;
}

export function parseVideoVocabularyInput(value: unknown): VideoVocabularyInput {
  const body = asObject(value);
  const errors: string[] = [];
  const word = text(body.word, 'word', 80, errors, true);
  const ipa = text(body.ipa, 'ipa', 80, errors, false) ?? '';
  const meaningVi = text(body.meaning_vi ?? body.meaningVi, 'meaning_vi', 160, errors, true);
  const detailVi = text(body.detail_vi ?? body.detailVi, 'detail_vi', 500, errors, true);
  if (errors.length) throw new HttpError(422, 'Validation failed', errors);
  return {
    word: word as string,
    ipa,
    meaningVi: meaningVi as string,
    detailVi: detailVi as string,
  };
}

export function parseVideoVocabularyPatch(value: unknown): VideoVocabularyPatch {
  const body = asObject(value);
  const errors: string[] = [];
  const patch: VideoVocabularyPatch = {};
  if (body.word !== undefined) patch.word = text(body.word, 'word', 80, errors, true);
  if (body.ipa !== undefined) patch.ipa = text(body.ipa, 'ipa', 80, errors, false) ?? '';
  if (body.meaning_vi !== undefined || body.meaningVi !== undefined) {
    patch.meaningVi = text(body.meaning_vi ?? body.meaningVi, 'meaning_vi', 160, errors, true);
  }
  if (body.detail_vi !== undefined || body.detailVi !== undefined) {
    patch.detailVi = text(body.detail_vi ?? body.detailVi, 'detail_vi', 500, errors, true);
  }
  if (Object.keys(patch).length === 0) errors.push('Provide at least one field to update.');
  if (errors.length) throw new HttpError(422, 'Validation failed', errors);
  return patch;
}
