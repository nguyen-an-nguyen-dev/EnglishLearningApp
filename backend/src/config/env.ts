import dotenv from 'dotenv';

dotenv.config();

function getPort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
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
  aiModel: process.env.AI_MODEL || 'gemini-flash-lite-latest',
  aiFallbackModel: process.env.AI_FALLBACK_MODEL || 'gemini-3.5-flash',
  aiTimeoutMs: getPort(process.env.AI_TIMEOUT_MS, 40000),
  supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, ''),
  supabaseBucket: process.env.SUPABASE_BUCKET || '',
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || '',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:8081,http://127.0.0.1:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};