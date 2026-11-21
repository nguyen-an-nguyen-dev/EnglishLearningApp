import type { RequestHandler } from 'express';
import { HttpError } from '../../middleware/error-handler';
import * as aiService from '../ai/ai.service';
import { parseAskInput } from '../ai/ai.validation';
import * as service from './buddy.service';
import { parseSuggestionInput } from './buddy.validation';

function requireUserId(request: Parameters<RequestHandler>[0]): number {
  if (!request.auth) throw new HttpError(401, 'Authentication required.');
  return request.auth.userId;
}

export const getNudges: RequestHandler = async (request, response, next) => {
  try {
    const feed = await service.getNudges(requireUserId(request));
    response.json({ success: true, data: feed });
  } catch (error) {
    next(error);
  }
};

export const ask: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const input = parseAskInput(request.body);
    const result = await aiService.askBuddy(userId, input.message, input.intent, input.context);
    response.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const acceptSuggestion: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const input = parseSuggestionInput(request.body);
    const reminder = await service.createFromSuggestion(userId, input);
    response.status(201).json({ success: true, data: { reminder } });
  } catch (error) {
    next(error);
  }
};
