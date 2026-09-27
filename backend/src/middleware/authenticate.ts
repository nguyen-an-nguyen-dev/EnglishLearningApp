import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { getVerifiedJwtSecret } from '../modules/auth/auth.service';
import { HttpError } from './error-handler';

export const authenticate: RequestHandler = (request, _response, next) => {
  const authorization = request.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    next(new HttpError(401, 'Authentication required.'));
    return;
  }

  try {
    const payload = jwt.verify(match[1], getVerifiedJwtSecret());
    if (typeof payload === 'string' || !payload.sub || !/^\d+$/.test(payload.sub)) {
      throw new Error('Invalid token subject.');
    }
    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId < 1) throw new Error('Invalid token subject.');
    request.auth = { userId };
    next();
  } catch (error) {
    if (error instanceof HttpError) next(error);
    else next(new HttpError(401, 'Invalid or expired authentication token.'));
  }
};