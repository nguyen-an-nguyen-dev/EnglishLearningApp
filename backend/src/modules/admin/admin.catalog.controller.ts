import type { RequestHandler } from 'express';
import * as service from './admin.catalog.service';
import {
  parseBattleWordId,
  parseBattleWordInput,
  parseBattleWordPatch,
  parseShopItemCreate,
  parseShopItemId,
  parseShopItemPatch,
  parseVideoVocabularyId,
  parseVideoVocabularyInput,
  parseVideoVocabularyPatch,
  parseVocabVideoId,
} from './admin.catalog.validation';

function fail(error: unknown, next: (error: unknown) => void): void {
  next(error);
}

export const listShopItems: RequestHandler = async (_request, response, next) => {
  try {
    const items = await service.listShopItems();
    response.json({ success: true, data: { items } });
  } catch (error) {
    fail(error, next);
  }
};

export const createShopItem: RequestHandler = async (request, response, next) => {
  try {
    const input = parseShopItemCreate(request.body);
    const item = await service.createShopItem(input);
    response.status(201).json({ success: true, data: { item } });
  } catch (error) {
    fail(error, next);
  }
};

export const updateShopItem: RequestHandler = async (request, response, next) => {
  try {
    const itemId = parseShopItemId(request.params.itemId);
    const patch = parseShopItemPatch(request.body);
    const item = await service.updateShopItem(itemId, patch);
    response.json({ success: true, data: { item } });
  } catch (error) {
    fail(error, next);
  }
};

export const deleteShopItem: RequestHandler = async (request, response, next) => {
  try {
    const itemId = parseShopItemId(request.params.itemId);
    await service.deleteShopItem(itemId);
    response.json({ success: true, data: { deleted: true } });
  } catch (error) {
    fail(error, next);
  }
};

export const listBattleWords: RequestHandler = async (_request, response, next) => {
  try {
    const words = await service.listBattleWords();
    response.json({ success: true, data: { words } });
  } catch (error) {
    fail(error, next);
  }
};

export const createBattleWord: RequestHandler = async (request, response, next) => {
  try {
    const input = parseBattleWordInput(request.body);
    const word = await service.createBattleWord(input);
    response.status(201).json({ success: true, data: { word } });
  } catch (error) {
    fail(error, next);
  }
};

export const updateBattleWord: RequestHandler = async (request, response, next) => {
  try {
    const wordId = parseBattleWordId(request.params.wordId);
    const patch = parseBattleWordPatch(request.body);
    const word = await service.updateBattleWord(wordId, patch);
    response.json({ success: true, data: { word } });
  } catch (error) {
    fail(error, next);
  }
};

export const deleteBattleWord: RequestHandler = async (request, response, next) => {
  try {
    const wordId = parseBattleWordId(request.params.wordId);
    await service.deleteBattleWord(wordId);
    response.json({ success: true, data: { deleted: true } });
  } catch (error) {
    fail(error, next);
  }
};

export const listVideoVocabulary: RequestHandler = async (request, response, next) => {
  try {
    const videoId = parseVocabVideoId(request.params.videoId);
    const vocabulary = await service.listVideoVocabulary(videoId);
    response.json({ success: true, data: { vocabulary } });
  } catch (error) {
    fail(error, next);
  }
};

export const createVideoVocabulary: RequestHandler = async (request, response, next) => {
  try {
    const videoId = parseVocabVideoId(request.params.videoId);
    const input = parseVideoVocabularyInput(request.body);
    const vocabulary = await service.createVideoVocabulary(videoId, input);
    response.status(201).json({ success: true, data: { vocabulary } });
  } catch (error) {
    fail(error, next);
  }
};

export const updateVideoVocabulary: RequestHandler = async (request, response, next) => {
  try {
    const vocabularyId = parseVideoVocabularyId(request.params.vocabularyId);
    const patch = parseVideoVocabularyPatch(request.body);
    const vocabulary = await service.updateVideoVocabulary(vocabularyId, patch);
    response.json({ success: true, data: { vocabulary } });
  } catch (error) {
    fail(error, next);
  }
};

export const deleteVideoVocabulary: RequestHandler = async (request, response, next) => {
  try {
    const vocabularyId = parseVideoVocabularyId(request.params.vocabularyId);
    await service.deleteVideoVocabulary(vocabularyId);
    response.json({ success: true, data: { deleted: true } });
  } catch (error) {
    fail(error, next);
  }
};
