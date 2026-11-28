import { requireUserId } from '../../middleware/authenticate';
import type { RequestHandler } from 'express';
import { HttpError } from '../../middleware/error-handler';
import * as gamificationService from './gamification.service';
import { parseItemId } from './gamification.validation';

export const getWallet: RequestHandler = async (request, response, next) => {
  try {
    const wallet = await gamificationService.getWallet(requireUserId(request));
    response.json({ success: true, data: { wallet } });
  } catch (error) {
    next(error);
  }
};

export const getShop: RequestHandler = async (request, response, next) => {
  try {
    const data = await gamificationService.getShop(requireUserId(request));
    response.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const purchaseItem: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const itemId = parseItemId(request.params.itemId);
    const data = await gamificationService.purchaseItem(userId, itemId);
    response.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const equipItem: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const itemId = parseItemId(request.params.itemId);
    const item = await gamificationService.equipCosmetic(userId, itemId);
    response.json({ success: true, data: { item } });
  } catch (error) {
    next(error);
  }
};

export const unequipSlot: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const slot = String(request.params.slot ?? '');
    const item = await gamificationService.unequipSlot(userId, slot);
    response.json({ success: true, data: { item } });
  } catch (error) {
    next(error);
  }
};

export const getRewards: RequestHandler = async (request, response, next) => {
  try {
    const data = await gamificationService.getRewards(requireUserId(request));
    response.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const claimQuest: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const code = String(request.params.code ?? '').trim();
    if (!code) throw new HttpError(422, 'Provide a quest code.', ['INVALID_QUEST']);
    const data = await gamificationService.claimQuest(userId, code);
    response.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getLeague: RequestHandler = async (request, response, next) => {
  try {
    const data = await gamificationService.getLeague(requireUserId(request));
    response.json({ success: true, data: { league: data } });
  } catch (error) {
    next(error);
  }
};
