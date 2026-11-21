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

export const startRegistration: RequestHandler = async (request, response, next) => {
  try {
    const data = await authService.startRegistration(request.body);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const verifyRegistration: RequestHandler = async (request, response, next) => {
  try {
    const data = await authService.verifyRegistration(request.body);
    response.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const resendRegistrationOtp: RequestHandler = async (request, response, next) => {
  try {
    const data = await authService.resendRegistrationOtp(request.body);
    response.json({ success: true, data });
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

export const google: RequestHandler = async (request, response, next) => {
  try {
    const data = await authService.loginWithProvider('google', request.body?.credential);
    response.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const facebook: RequestHandler = async (request, response, next) => {
  try {
    const data = await authService.loginWithProvider('facebook', request.body?.accessToken);
    response.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const providers: RequestHandler = async (_request, response, next) => {
  try {
    response.json({ success: true, data: await authService.listProviders() });
  } catch (error) {
    next(error);
  }
};

export const linkedProviders: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const providers = await authService.listLinkedProviders(request.auth.userId);
    response.json({ success: true, data: { providers } });
  } catch (error) {
    next(error);
  }
};

export const linkProvider: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const token = request.params.provider === 'google'
      ? request.body?.credential
      : request.body?.accessToken;
    const data = await authService.linkProvider(
      request.auth.userId,
      String(request.params.provider),
      token,
    );
    response.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const unlinkProvider: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const providers = await authService.unlinkProvider(
      request.auth.userId,
      String(request.params.provider),
    );
    response.json({ success: true, data: { providers } });
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

export const updateProfile: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const user = await authService.updateProfile(request.auth.userId, request.body);
    response.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

export const changePassword: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    await authService.changePassword(request.auth.userId, request.body);
    response.json({ success: true, data: { message: 'Password updated.' } });
  } catch (error) {
    next(error);
  }
};