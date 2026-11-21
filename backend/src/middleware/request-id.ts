import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Correlates every log line and error response with one request. A caller may
 * supply `X-Request-ID`; otherwise a UUID is generated and echoed back.
 */
export const requestId: RequestHandler = (request, response, next) => {
  const supplied = request.get('x-request-id')?.trim();
  const id = supplied && supplied.length <= 128 ? supplied : randomUUID();
  request.requestId = id;
  response.setHeader('X-Request-ID', id);
  next();
};
