import type { RequestHandler } from 'express';
import { HttpError } from '../../middleware/error-handler';
import * as badgesService from './badges.service';

export const getMyBadges: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const badges = await badgesService.getUserBadges(request.auth.userId);
    response.json({ success: true, data: { badges } });
  } catch (error) {
    next(error);
  }
};