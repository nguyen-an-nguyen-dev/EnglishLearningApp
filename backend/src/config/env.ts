import dotenv from 'dotenv';

dotenv.config();

function getPort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}

function splitList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((piece) => piece.trim())
    .filter(Boolean);
}

export interface CloudflareAccount {
  apiKey: string;
  apiUrl: string;
}

/**
 * Cloudflare Workers AI accounts, in try order: CF_API_KEYS / CF_API_URLS are
 * comma lists paired by index, and the single-account CF_API_KEY / CF_API_URL
 * pair is still honoured.
 */
function cloudflareAccounts(): CloudflareAccount[] {
  const keys = splitList(process.env.CF_API_KEYS);
  const urls = splitList(process.env.CF_API_URLS);
  const singleKey = (process.env.CF_API_KEY ?? '').trim();
  if (singleKey && !keys.includes(singleKey)) keys.push(singleKey);

  const defaultUrl = (process.env.CF_API_URL ?? '').trim() || urls[0] || '';
  return keys
    .map((apiKey, index) => ({ apiKey, apiUrl: (urls[index] ?? defaultUrl).trim() }))
    .filter((account) => account.apiUrl);
}

export const env = {
  port: getPort(process.env.PORT, 3000),
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: getPort(process.env.DB_PORT, 3306),
  dbUser: process.env.DB_USER || '',
  dbPassword: process.env.DB_PASSWORD || '',
  dbName: process.env.DB_NAME || 'english_learning',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  aiApiKey: process.env.AI_API_KEY || '',
  aiApiUrl: process.env.AI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  // Only two generative models are used, in this order: Sea-Lion on Workers AI,
  // then Gemini Flash. Adding a third provider means adding it to ai.provider.ts.
  aiFallbackModel: process.env.AI_FALLBACK_MODEL || 'gemini-3.5-flash',
  aiTimeoutMs: getPort(process.env.AI_TIMEOUT_MS, 40000),
  // Hard ceiling for one chat turn: generate -> decide -> repair all share it.
  // Kept below the web client's 35s request timeout so the browser never aborts
  // a turn the server is still working on.
  aiTurnBudgetMs: getPort(process.env.AI_TURN_BUDGET_MS, 30000),
  // Gemini Decision 1: closed-set scoring only (no text output). Both the intent
  // router and the answer review in front of the frontend use it.
  aiDecisionEnabled: (process.env.AI_DECISION_ENABLED ?? 'true').toLowerCase() !== 'false',
  aiDecisionUrl: process.env.AI_DECISION_URL || 'https://generativelanguage.googleapis.com/v1beta/decisions',
  aiDecisionModel: process.env.AI_DECISION_MODEL || 'gemini-decision-1',
  aiDecisionTimeoutMs: getPort(process.env.AI_DECISION_TIMEOUT_MS, 8000),
  cfAccounts: cloudflareAccounts(),
  cfModel: process.env.CF_MODEL || '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  facebookAppId: process.env.FACEBOOK_APP_ID || '',
  supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, ''),
  supabaseBucket: process.env.SUPABASE_BUCKET || '',
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || '',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:8081,http://127.0.0.1:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
