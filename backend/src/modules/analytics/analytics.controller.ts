import type { RequestHandler } from 'express';
import { HttpError } from '../../middleware/error-handler';
import * as analyticsService from './analytics.service';
import * as reviewService from './review.service';

function requireUser(request: Parameters<RequestHandler>[0]): number {
  if (!request.auth) throw new HttpError(401, 'Authentication required.');
  return request.auth.userId;
}

export const getAnalytics: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUser(request);
    const analytics = await analyticsService.getAnalytics(userId);
    response.json({ success: true, data: analytics });
  } catch (error) {
    next(error);
  }
};

export const getReviewQueue: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUser(request);
    const queue = await reviewService.getQueue(userId);
    response.json({ success: true, data: queue });
  } catch (error) {
    next(error);
  }
};

export const syncReviewQueue: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUser(request);
    const result = await reviewService.sync(userId);
    response.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const addReviewItem: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUser(request);
    const body = typeof request.body === 'object' && request.body !== null
      ? request.body as Record<string, unknown>
      : {};
    const kind = body.kind;
    const refId = body.ref_id;
    if (kind !== 'word' && kind !== 'question') {
      throw new HttpError(422, 'Validation failed', ["kind must be 'word' or 'question'."]);
    }
    if (typeof refId !== 'number' || !Number.isInteger(refId) || refId < 1) {
      throw new HttpError(422, 'Validation failed', ['ref_id must be a positive integer.']);
    }
    await reviewService.addItem(userId, kind, refId);
    const queue = await reviewService.getQueue(userId);
    response.status(201).json({ success: true, data: queue });
  } catch (error) {
    next(error);
  }
};

export const answerReviewItem: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUser(request);
    const itemId = Number(request.params.itemId);
    if (!Number.isInteger(itemId) || itemId < 1) {
      throw new HttpError(400, 'Invalid review item id.');
    }
    const body = typeof request.body === 'object' && request.body !== null
      ? request.body as Record<string, unknown>
      : {};
    if (typeof body.answer !== 'string' || body.answer.trim().length === 0) {
      throw new HttpError(422, 'Validation failed', ['answer must be a non-empty string.']);
    }
    const result = await reviewService.answerItem(userId, itemId, {
      answer: body.answer.trim(),
      responseMs: typeof body.response_ms === 'number' ? body.response_ms : undefined,
    });
    response.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
