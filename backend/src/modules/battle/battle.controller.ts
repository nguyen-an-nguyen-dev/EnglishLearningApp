import { requireUserId } from '../../middleware/authenticate';
import type { RequestHandler } from 'express';
import * as battleService from './battle.service';

export const getSummary: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const summary = await battleService.getBattleSummary(userId);
    response.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};


