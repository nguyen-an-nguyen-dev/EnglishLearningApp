import type { RequestHandler } from 'express';
import { HttpError } from '../../middleware/error-handler';
import * as rankingService from './ranking.service';

export const getRanking: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const ranking = await rankingService.getRanking(request.auth.userId);
    response.json({ success: true, data: ranking });
  } catch (error) {
    next(error);
  }
};