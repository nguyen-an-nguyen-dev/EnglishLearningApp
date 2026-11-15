import type { ErrorRequestHandler, RequestHandler } from 'express';

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

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.errors,
    });
    return;
  }

  // Express's router/body-parser throw their own errors (a malformed URI in a
  // route param, an oversized body, a bad JSON payload) and tag them with a 4xx
  // `status`/`statusCode`. Those are client mistakes, not server faults, so honour
  // the status instead of masking them as a 500.
  const status = (error as { status?: unknown; statusCode?: unknown })?.status
    ?? (error as { statusCode?: unknown })?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    response.status(status).json({
      success: false,
      message: status === 400 ? 'Bad request.' : 'Request rejected.',
      errors: [],
    });
    return;
  }

  console.error('Unhandled request error:', error instanceof Error ? error.message : 'Unknown error');
  response.status(500).json({
    success: false,
    message: 'Internal server error',
    errors: [],
  });
};