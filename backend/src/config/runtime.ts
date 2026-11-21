import { env } from './env';

export interface RuntimeConfigIssue {
  field: string;
  message: string;
}

/**
 * Fail fast on configuration that would break a production deployment. Called
 * from server.ts only, so tests and tooling can import `app` without requiring
 * every external provider to be configured.
 */
export function validateRuntimeConfig(): RuntimeConfigIssue[] {
  const issues: RuntimeConfigIssue[] = [];
  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    issues.push({ field: 'JWT_SECRET', message: 'must be at least 32 characters' });
  }
  if (!env.dbUser) issues.push({ field: 'DB_USER', message: 'is required' });
  if (!env.dbName) issues.push({ field: 'DB_NAME', message: 'is required' });
  if (env.corsOrigins.length === 0) {
    issues.push({ field: 'CORS_ORIGINS', message: 'needs at least one origin in production' });
  }
  return issues;
}
