import type { RequestHandler } from 'express';
import { HttpError } from '../../middleware/error-handler';
import * as service from './admin.users.service';
import { parseAdminUserId, parseAdminUserListQuery, parseAdminUserPatch } from './admin.users.validation';

function requireAdminId(request: Parameters<RequestHandler>[0]): number {
  if (!request.auth) throw new HttpError(401, 'Authentication required.');
  return request.auth.userId;
}

export const listUsers: RequestHandler = async (request, response, next) => {
  try {
    const query = parseAdminUserListQuery(request.query as Record<string, unknown>);
    const data = await service.listUsers(query);
    response.json({ success: true, data: { ...data, limit: query.limit, offset: query.offset } });
  } catch (error) {
    next(error);
  }
};

export const updateUser: RequestHandler = async (request, response, next) => {
  try {
    const userId = parseAdminUserId(request.params.userId);
    const patch = parseAdminUserPatch(request.body);
    const user = await service.updateUser(requireAdminId(request), userId, patch);
    response.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};
