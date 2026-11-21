import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../utils/logger';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errors: string[] = [],
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new HttpError(404, 'Route not found'));
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.errors,
      requestId: request.requestId,
    });
    return;
  }

  // Express's router/body-parser throw their own errors (malformed URI, oversized
  // body, bad JSON) tagged with a 4xx status. Those are client mistakes, so honour
  // the status instead of masking them as a 500.
  const status = (error as { status?: unknown; statusCode?: unknown })?.status
    ?? (error as { statusCode?: unknown })?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    response.status(status).json({
      success: false,
      message: status === 400 ? 'Bad request.' : 'Request rejected.',
      errors: [],
      requestId: request.requestId,
    });
    return;
  }

  logger.error('unhandled_request_error', {
    request_id: request.requestId,
    method: request.method,
    path: request.originalUrl.split('?')[0],
    message: error instanceof Error ? error.message : 'Unknown error',
  });
  response.status(500).json({
    success: false,
    message: 'Internal server error',
    errors: [],
    requestId: request.requestId,
  });
};