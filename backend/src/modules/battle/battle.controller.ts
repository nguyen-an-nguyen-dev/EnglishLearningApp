import type { RequestHandler } from 'express';
import { HttpError } from '../../middleware/error-handler';
import * as battleService from './battle.service';

function requireUserId(request: Parameters<RequestHandler>[0]): number {
  if (!request.auth) throw new HttpError(401, 'Authentication required.');
  return request.auth.userId;
}

export const getSummary: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const summary = await battleService.getBattleSummary(userId);
    response.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

export const getPractice: RequestHandler = async (request, response, next) => {
  try {
    requireUserId(request);
    const count = battleService.parsePracticeCount(request.query.count);
    const levels = battleService.parsePracticeLevels(request.query.levels);
    const questions = await battleService.getPracticeQuestions(count, levels);
    response.json({ success: true, data: { questions } });
  } catch (error) {
    next(error);
  }
};
