import type { RequestHandler } from 'express';
import { HttpError } from '../../middleware/error-handler';
import * as authService from './auth.service';

export const register: RequestHandler = async (request, response, next) => {
  try {
    const user = await authService.register(request.body);
    response.status(201).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (request, response, next) => {
  try {
    const data = await authService.login(request.body);
    response.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const me: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const user = await authService.getCurrentUser(request.auth.userId);
    response.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};