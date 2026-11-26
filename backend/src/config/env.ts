import dotenv from 'dotenv';

dotenv.config();

function getPort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}

function getInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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
  // Token Harbor is the primary generative provider (OpenAI-compatible gateway).
  thApiKey: (process.env.TH_API_KEY || '').trim(),
  thApiUrl: process.env.TH_API_URL || 'https://tokenharbor.ai/v1/chat/completions',
  thModel: process.env.TH_MODEL || 'deepseek-v4.1-flash-1017',
  aiApiKey: process.env.AI_API_KEY || '',
  aiApiUrl: process.env.AI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  // Fallback chain after Token Harbor: Gemini Flash. Llama is no longer used
  // for text generation. A new provider must also be wired up in ai.provider.ts.
  aiFallbackModel: process.env.AI_FALLBACK_MODEL || 'gemini-2.5-flash',
  aiTimeoutMs: getPort(process.env.AI_TIMEOUT_MS, 40000),
  // Hard ceiling for one chat turn (generate -> decide -> repair). Kept below the
  // web client's 35s request timeout so the browser never aborts a live turn.
  aiTurnBudgetMs: getPort(process.env.AI_TURN_BUDGET_MS, 30000),
  // Gemini Decision 1: closed-set scoring only (no text output). Both the intent
  // router and the answer review in front of the frontend use it.
  aiDecisionEnabled: (process.env.AI_DECISION_ENABLED ?? 'true').toLowerCase() !== 'false',
  aiDecisionUrl: process.env.AI_DECISION_URL || 'https://generativelanguage.googleapis.com/v1beta/decisions',
  aiDecisionModel: process.env.AI_DECISION_MODEL || 'gemini-decision-1',
  aiDecisionTimeoutMs: getPort(process.env.AI_DECISION_TIMEOUT_MS, 8000),
  // AssemblyAI speech-to-text. Pre-recorded models go through the async REST
  // flow (upload -> submit -> poll); realtime models are WebSocket-only.
  assemblyAiApiKey: (process.env.ASSEMBLYAI_API_KEY || '').trim(),
  assemblyAiBaseUrl: (process.env.ASSEMBLYAI_BASE_URL || 'https://api.assemblyai.com').replace(/\/+$/, ''),
  // Speech-to-text for when the browser's Web Speech API fails (Chrome
  // "network" error): SPEECH_MODEL first, then Gemini audio input.
  speechModel: process.env.SPEECH_MODEL || 'assemblyai-stt-3-7',
  // Kept below the web client's 45s abort. A 30s clip usually finishes in 2-6s.
  speechTimeoutMs: getPort(process.env.SPEECH_TIMEOUT_MS, 40000),
  speechPollIntervalMs: getPort(process.env.SPEECH_POLL_INTERVAL_MS, 500),
  // express.raw limit for one recorded clip, in bytes (default 4 MiB).
  speechMaxBytes: getInt(process.env.SPEECH_MAX_BYTES, 4 * 1024 * 1024),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  facebookAppId: process.env.FACEBOOK_APP_ID || '',
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET || '',
  cloudinaryCloudName: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
  cloudinaryApiKey: (process.env.CLOUDINARY_API_KEY || '').trim(),
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  cloudinaryConfigured: Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim()
    && process.env.CLOUDINARY_API_KEY?.trim()
    && process.env.CLOUDINARY_API_SECRET,
  ),
  // Transactional mail for the web registration OTP. SMTP is optional in
  // development: `otpDebug` logs the code and echoes it to the caller instead.
  smtpHost: (process.env.SMTP_HOST || '').trim(),
  smtpPort: getPort(process.env.SMTP_PORT, 587),
  smtpSecure: (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  smtpUser: (process.env.SMTP_USER || '').trim(),
  smtpPass: process.env.SMTP_PASS || '',
  mailFrom: (process.env.MAIL_FROM || 'Engorace <no-reply@engorace.local>').trim(),
  otpExpiryMinutes: getInt(process.env.OTP_EXPIRY_MINUTES, 10),
  otpResendSeconds: getInt(process.env.OTP_RESEND_SECONDS, 60),
  otpMaxAttempts: getInt(process.env.OTP_MAX_ATTEMPTS, 6),
  otpDebug: (process.env.OTP_DEBUG
    ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true')).toLowerCase() === 'true',
  supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, ''),
  supabaseBucket: process.env.SUPABASE_BUCKET || '',
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || '',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:8081,http://127.0.0.1:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
