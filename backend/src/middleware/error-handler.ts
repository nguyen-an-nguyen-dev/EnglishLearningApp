import type { ErrorRequestHandler, RequestHandler } from 'express';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
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
      error: { message: error.message },
    });
    return;
  }

  console.error('Unhandled request error:', error instanceof Error ? error.message : 'Unknown error');
  response.status(500).json({
    success: false,
    error: { message: 'Internal server error' },
  });
};