import { env } from './env';

export interface RuntimeConfigIssue {
  field: string;
  message: string;
}

/**
 * Fail fast on configuration that would break a production deployment. Called
 * from server.ts only, so tests and tooling can import `app` without every
 * external provider being configured.
 */
export function validateRuntimeConfig(): RuntimeConfigIssue[] {
  const issues: RuntimeConfigIssue[] = [];
  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    issues.push({ field: 'JWT_SECRET', message: 'must be at least 32 characters' });
  }
  if (!env.dbUser) issues.push({ field: 'DB_USER', message: 'is required' });
  if (!env.dbName) issues.push({ field: 'DB_NAME', message: 'is required' });
  const cloudinaryValues = [env.cloudinaryCloudName, env.cloudinaryApiKey, env.cloudinaryApiSecret];
  if (cloudinaryValues.some(Boolean) && !env.cloudinaryConfigured) {
    issues.push({
      field: 'CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET',
      message: 'must be configured together or all left empty',
    });
  }
  if (env.corsOrigins.length === 0) {
    issues.push({ field: 'CORS_ORIGINS', message: 'needs at least one origin in production' });
  }
  return issues;
}
