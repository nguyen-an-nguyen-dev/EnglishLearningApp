import type { RequestHandler } from 'express';
import { findRoleById } from '../modules/auth/auth.repository';
import { HttpError } from './error-handler';

/**
 * Gate for `/api/admin/*`. `authenticate` has already resolved the user id; the
 * role is re-read from the database on every call so revoking admin takes effect
 * without waiting for the JWT to expire.
 */
export const requireAdmin: RequestHandler = async (request, _response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const role = await findRoleById(request.auth.userId);
    if (role === null) throw new HttpError(401, 'Invalid authentication token.');
    if (role !== 'admin') {
      throw new HttpError(403, 'Administrator access required.', ['ADMIN_REQUIRED']);
    }
    next();
  } catch (error) {
    next(error);
  }
};
