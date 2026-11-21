import type { RowDataPacket } from 'mysql2';
import type { BoosterKind } from '../gamification/gamification.types';
import { CEFR_LEVELS } from './admin.types';

export const SHOP_SLOTS = ['car', 'frame', 'nameplate', 'booster'] as const;
export type ShopSlotValue = (typeof SHOP_SLOTS)[number];

export const SHOP_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type ShopRarityValue = (typeof SHOP_RARITIES)[number];

export const SHOP_UNLOCK_TYPES = ['default', 'level', 'stage', 'league', 'achievement'] as const;
export type ShopUnlockTypeValue = (typeof SHOP_UNLOCK_TYPES)[number];

export const BOOSTER_KINDS = ['streak_shield', 'xp_multiplier', 'rc_multiplier'] as const;

export const LEAGUE_TIERS = ['coal', 'copper', 'iron', 'gold', 'redstone', 'lapis', 'diamond'] as const;

export const BATTLE_PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'interjection',
] as const;
export type BattlePartOfSpeech = (typeof BATTLE_PARTS_OF_SPEECH)[number];

export type AdminCefrLevel = (typeof CEFR_LEVELS)[number];

export interface AdminShopItemRow extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  description: string;
  slot: ShopSlotValue;
  rarity: ShopRarityValue;
  price: number;
  unlock_type: ShopUnlockTypeValue;
  unlock_value: string | null;
  visual_key: string;
  style_json: string | Record<string, unknown> | null;
  booster_kind: BoosterKind | null;
  booster_charges: number;
  booster_duration_minutes: number;
  sort_order: number;
  active: boolean | 0 | 1;
  created_at: Date;
}

export interface AdminShopItem {
  id: number;
  code: string;
  name: string;
  description: string;
  slot: ShopSlotValue;
  rarity: ShopRarityValue;
  price: number;
  unlock_type: ShopUnlockTypeValue;
  unlock_value: string | null;
  visual_key: string;
  style: Record<string, string | null> | null;
  booster_kind: BoosterKind | null;
  booster_charges: number;
  booster_duration_minutes: number;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface ShopItemInput {
  code?: string;
  name: string;
  description: string;
  slot: ShopSlotValue;
  rarity: ShopRarityValue;
  price: number;
  unlockType: ShopUnlockTypeValue;
  unlockValue: string | null;
  visualKey: string;
  style: Record<string, string | null> | null;
  boosterKind: BoosterKind | null;
  boosterCharges: number;
  boosterDurationMinutes: number;
  active: boolean;
}

export type ShopItemPatch = Partial<ShopItemInput>;

export interface AdminBattleWordRow extends RowDataPacket {
  id: number;
  word_en: string;
  translation_vi: string;
  part_of_speech: BattlePartOfSpeech;
  cefr_level: AdminCefrLevel;
  explanation_vi: string;
  example_en: string;
  example_vi: string;
  image_url: string | null;
  sort_order: number;
}

export type AdminBattleWord = AdminBattleWordRow;

export interface BattleWordInput {
  wordEn: string;
  translationVi: string;
  partOfSpeech: BattlePartOfSpeech;
  cefrLevel: AdminCefrLevel;
  explanationVi: string;
  exampleEn: string;
  exampleVi: string;
  imageUrl: string | null;
}

export type BattleWordPatch = Partial<BattleWordInput>;

export interface AdminVideoVocabularyRow extends RowDataPacket {
  id: number;
  video_id: number;
  word: string;
  ipa: string;
  meaning_vi: string;
  detail_vi: string;
  sort_order: number;
}

export type AdminVideoVocabulary = AdminVideoVocabularyRow;

export interface VideoVocabularyInput {
  word: string;
  ipa: string;
  meaningVi: string;
  detailVi: string;
}

export type VideoVocabularyPatch = Partial<VideoVocabularyInput>;
