import type { RequestHandler } from 'express';
import { logger } from '../utils/logger';

export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = process.hrtime.bigint();
  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const path = request.originalUrl.split('?')[0] ?? request.originalUrl;
    logger.info('http_request', {
      request_id: request.requestId,
      method: request.method,
      path,
      status: response.statusCode,
      duration_ms: Math.round(durationMs * 10) / 10,
    });
  });
  next();
};
