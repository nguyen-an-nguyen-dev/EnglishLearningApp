import { env } from '../../config/env';
import { HttpError } from '../../middleware/error-handler';
import {
  cfAccountTargets,
  isDailyQuotaError,
  markCfAccountExhausted,
} from '../../utils/cf-rotate';
import { isRecord, parseAiReply, providerMessageContent } from './ai.parsing';
import type { AiReply, ProviderMessage } from './ai.types';

/**
 * The generative chain. There are exactly two models, in this order:
 *
 *   1. `@cf/aisingapore/gemma-sea-lion-v4-27b-it` on Cloudflare Workers AI
 *      (SEA-tuned, no reasoning budget burned before the answer),
 *   2. `gemini-3.5-flash` through the Gemini OpenAI-compatible endpoint.
 *
 * Every configured Workers AI account is tried before the Gemini fallback, so a
 * daily quota on one account does not change the model the learner sees.
 */
export interface ModelTarget {
  name: 'Cloudflare Workers AI' | 'Gemini';
  apiUrl: string;
  apiKey: string;
  model: string;
  /** Env var named in operator-facing errors so the bad setting is findable. */
  keyHint: string;
  modelHint: string;
}

export interface GenerateOptions {
  timeoutMs: number;
  maxTokens?: number;
  temperature?: number;
}

export const MAX_REPLY_TOKENS = 1500;

function modelTargets(): ModelTarget[] {
  return [
    ...cfAccountTargets<Omit<ModelTarget, 'apiKey' | 'apiUrl'>>({
      name: 'Cloudflare Workers AI',
      model: env.cfModel,
      keyHint: 'CF_API_KEYS',
      modelHint: 'CF_MODEL',
    }),
    {
      name: 'Gemini',
      apiUrl: env.aiApiUrl,
      apiKey: env.aiApiKey,
      model: env.aiFallbackModel,
      keyHint: 'AI_API_KEY',
      modelHint: 'AI_FALLBACK_MODEL',
    },
  ];
}

/** One request to one target; the JSON contract is the same on both providers. */
async function requestTarget(
  target: ModelTarget,
  messages: ProviderMessage[],
  options: GenerateOptions,
): Promise<AiReply> {
  const { name, apiUrl, apiKey, model, keyHint, modelHint } = target;
  if (!apiKey.trim()) {
    throw new HttpError(503, `${name} is not configured. Set ${keyHint} in backend/.env and restart the server.`);
  }

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' },
        temperature: options.temperature ?? 0.6,
        max_tokens: options.maxTokens ?? MAX_REPLY_TOKENS,
      }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new HttpError(504, 'The AI response timed out. Please try again.');
    }
    throw new HttpError(503, 'The AI provider is unavailable. Check your connection and try again.');
  }

  if (response.status === 429) {
    const detail = await response.text().catch(() => '');
    if (isDailyQuotaError(detail)) markCfAccountExhausted(apiKey);
    throw new HttpError(429, 'The AI service is busy. Please wait a moment and try again.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(503, `The ${name} provider rejected the backend API key or its permissions. Check the ${keyHint}.`);
  }
  if (response.status === 400 || response.status === 404) {
    throw new HttpError(503, `The ${name} provider rejected the model or request format. Check the ${modelHint} settings.`);
  }
  if (!response.ok) {
    throw new HttpError(503, 'The AI service is temporarily unavailable. Please try again later.');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new HttpError(504, 'The AI response timed out. Please try again.');
    }
    throw new HttpError(502, 'The AI provider returned an invalid response. Please try again.');
  }

  const content = providerMessageContent(payload)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new HttpError(502, 'The AI returned an invalid response. Please try again.');
  }
  // Some OpenAI-compatible models omit `feedback` entirely on a clean reply.
  if (isRecord(parsed) && typeof parsed.reply === 'string' && parsed.reply.trim()
    && !Array.isArray(parsed.feedback)) {
    parsed = { reply: parsed.reply, feedback: [] };
  }
  return parseAiReply(parsed);
}

/**
 * Try each target in order; the first success wins and the last error is
 * rethrown when every target fails.
 */
export async function generateReply(
  messages: ProviderMessage[],
  options: GenerateOptions,
): Promise<AiReply> {
  let lastError: unknown;
  for (const target of modelTargets()) {
    try {
      return await requestTarget(target, messages, options);
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof HttpError) throw lastError;
  throw new HttpError(503, 'The AI service is temporarily unavailable. Please try again later.');
}
