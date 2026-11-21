import type { RequestHandler } from 'express';

/**
 * Baseline security headers with no third-party dependency. HSTS is only sent
 * in production because local HTTP development must stay reachable.
 */
export const securityHeaders: RequestHandler = (_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
};
