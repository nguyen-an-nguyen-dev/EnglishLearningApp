import type { RequestHandler } from 'express';
import { HttpError } from '../../middleware/error-handler';
import * as service from './reminders.service';
import { parseReminderId } from './reminders.validation';

function requireUserId(request: Parameters<RequestHandler>[0]): number {
  if (!request.auth) throw new HttpError(401, 'Authentication required.');
  return request.auth.userId;
}

export const listReminders: RequestHandler = async (request, response, next) => {
  try {
    const reminders = await service.listReminders(requireUserId(request));
    response.json({ success: true, data: { reminders } });
  } catch (error) {
    next(error);
  }
};

export const createReminder: RequestHandler = async (request, response, next) => {
  try {
    const reminder = await service.createReminder(requireUserId(request), request.body);
    response.status(201).json({ success: true, data: { reminder } });
  } catch (error) {
    next(error);
  }
};

export const dismissReminder: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const reminderId = parseReminderId(request.params.reminderId);
    await service.dismissReminder(userId, reminderId);
    response.json({ success: true, data: { dismissed: true } });
  } catch (error) {
    next(error);
  }
};

/** The client calls this once a due reminder has actually been shown. */
export const acknowledgeReminder: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const reminderId = parseReminderId(request.params.reminderId);
    await service.acknowledgeReminder(userId, reminderId);
    response.json({ success: true, data: { acknowledged: true } });
  } catch (error) {
    next(error);
  }
};
