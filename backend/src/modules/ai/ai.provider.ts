import { env } from '../../config/env';
import { HttpError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';
import { isRecord } from '../../utils/validation';
import { parseAiReply, providerMessageContent } from './ai.parsing';
import { readAssistantStream } from './ai.streaming';
import type { AiReply, ProviderMessage } from './ai.types';

/**
 * The generative chain is Token Harbor (DeepSeek) first, then
 * `gemini-2.5-flash`. Speech recognition is handled by AssemblyAI, not by the
 * text providers.
 */
export interface ModelTarget {
  name: 'Token Harbor' | 'Gemini';
  apiUrl: string;
  apiKey: string;
  model: string;
  /** Env var named in operator-facing errors so the bad setting is findable. */
  keyHint: string;
  modelHint: string;
  /** DeepSeek thinking effort; omitted for providers that do not take it. */
  reasoningEffort?: 'low';
}

export interface GenerateOptions {
  timeoutMs: number;
  maxTokens?: number;
  temperature?: number;
  buddy?: boolean;
  brief?: boolean;
  signal?: AbortSignal;
  onDraft?: (text: string) => void;
}

function parseBuddyDraft(content: string, truncated: boolean): AiReply {
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    let draft: unknown;
    try {
      draft = JSON.parse(content.slice(firstBrace, lastBrace + 1));
    } catch {
      throw new HttpError(502, 'The AI returned incomplete JSON.');
    }
    if (isRecord(draft)) {
      const reply = parseAiReply({ ...draft, feedback: [] });
      for (const entry of Array.isArray(draft.feedback) ? draft.feedback.slice(0, 6) : []) {
        try {
          reply.feedback.push(...parseAiReply({ reply: reply.reply, feedback: [entry] }).feedback);
        } catch {
          // One unusable correction does not invalidate the answer or other corrections.
        }
      }
      return reply;
    }
  }
  if (!truncated && content.length <= 900 && /\p{L}/u.test(content) && !/[{}`]|^\s*[\["]/u.test(content)) {
    return parseAiReply({ reply: content, feedback: [] });
  }
  throw new HttpError(502, 'The AI returned an invalid response. Please try again.');
}

export const MAX_REPLY_TOKENS = 1500;
const BUDDY_PRIMARY_MS = 7_000;
const BUDDY_BACKUP_MS = 5_000;
const BUDDY_FIRST_CONTENT_MS = 4_000;
const TUTOR_FIRST_CONTENT_MS = 3_000;
const MIN_ATTEMPT_MS = 500;

function supportsStreaming(apiUrl: string): boolean {
  return /^https:\/\/(?:tokenharbor\.ai|generativelanguage\.googleapis\.com)\//i.test(apiUrl);
}

function supportsBriefReasoning(target: ModelTarget): boolean {
  return target.name === 'Token Harbor' && /^deepseek-v4\.1-flash-1017\b/.test(target.model);
}

function primaryTimeoutMs(remaining: number, buddy: boolean, hasFallback: boolean): number {
  if (buddy) return Math.min(remaining, BUDDY_PRIMARY_MS);
  return hasFallback && remaining >= 2_000 ? Math.floor(remaining * 0.6) : remaining;
}

function tokenCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function modelTargets(buddy: boolean): ModelTarget[] {
  const officialGeminiApi = /^https:\/\/generativelanguage\.googleapis\.com\//i.test(env.aiApiUrl);
  const fallbackModel = buddy
    ? env.buddyFallbackModel || (officialGeminiApi ? 'gemini-3.5-flash-lite' : env.aiFallbackModel)
    : env.aiFallbackModel;
  return [
    {
      name: 'Token Harbor',
      apiUrl: env.thApiUrl,
      apiKey: env.thApiKey,
      model: env.thModel,
      keyHint: 'TH_API_KEY',
      modelHint: 'TH_MODEL',
      reasoningEffort: 'low',
    },
    {
      name: 'Gemini',
      apiUrl: env.aiApiUrl,
      apiKey: env.aiApiKey,
      model: fallbackModel,
      keyHint: 'AI_API_KEY',
      modelHint: buddy && (env.buddyFallbackModel || officialGeminiApi) ? 'BUDDY_FALLBACK_MODEL' : 'AI_FALLBACK_MODEL',
    },
  ];
}

async function requestTarget(
  target: ModelTarget,
  messages: ProviderMessage[],
  options: GenerateOptions & { onFirstContent?: () => void },
): Promise<AiReply> {
  const { name, apiUrl, apiKey, model, keyHint, modelHint, reasoningEffort } = target;
  if (!apiKey.trim()) {
    throw new HttpError(503, `${name} is not configured. Set ${keyHint} in backend/.env and restart the server.`);
  }

  let response: Response;
  const fastDeepSeek = (options.buddy || options.brief) && supportsBriefReasoning(target);
  const stream = Boolean(options.onDraft) && supportsStreaming(apiUrl);
  const timeout = AbortSignal.timeout(options.timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const requestedAt = performance.now();
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
        ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
        ...(reasoningEffort ? { reasoning_effort: fastDeepSeek ? 'none' : reasoningEffort } : {}),
      }),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new HttpError(504, 'The AI response timed out. Please try again.');
    }
    throw new HttpError(503, 'The AI provider is unavailable. Check your connection and try again.');
  }

  if (response.status === 429) {
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
  let firstContentMs: number | undefined;
  try {
    if (options.onDraft && response.body && response.headers.get('content-type')?.includes('text/event-stream')) {
      const headerMs = performance.now() - requestedAt;
      ({ payload, firstContentMs } = await readAssistantStream(response.body, options.onDraft, options.onFirstContent));
      if (firstContentMs !== undefined) firstContentMs = Math.round(headerMs + firstContentMs);
    } else {
      payload = await response.json();
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new HttpError(504, 'The AI response timed out. Please try again.');
    }
    throw new HttpError(502, 'The AI provider returned an invalid response. Please try again.');
  }

  if (isRecord(payload) && isRecord(payload.usage)) {
    const usage = payload.usage;
    const details = isRecord(usage.prompt_tokens_details) ? usage.prompt_tokens_details : {};
    const promptTokens = tokenCount(usage.prompt_tokens);
    const cachedTokens = tokenCount(usage.prompt_cache_hit_tokens)
      ?? tokenCount(details.cached_tokens)
      ?? tokenCount(usage.cache_read_input_tokens);
    logger.debug('ai_provider_usage', {
      provider: name,
      model,
      prompt_tokens: promptTokens,
      cached_prompt_tokens: cachedTokens,
      completion_tokens: tokenCount(usage.completion_tokens),
      first_content_ms: firstContentMs,
    });
  }

  const content = providerMessageContent(payload)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  if (firstContentMs === undefined) options.onFirstContent?.();
  if (options.buddy) {
    const first = isRecord(payload) && Array.isArray(payload.choices) ? payload.choices[0] : null;
    return parseBuddyDraft(content, isRecord(first) && first.finish_reason === 'length');
  }
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

async function providerAttempt(
  target: ModelTarget,
  messages: ProviderMessage[],
  options: Parameters<typeof requestTarget>[2],
): Promise<AiReply> {
  const started = Date.now();
  try {
    return await requestTarget(target, messages, options);
  } catch (error) {
    if (target.apiKey.trim() && !options.signal?.aborted) {
      logger.warn('ai_provider_attempt_failed', {
        provider: target.name,
        model: target.model,
        status: error instanceof HttpError ? error.statusCode : 500,
        reason: error instanceof HttpError ? error.message : 'Unexpected provider failure',
        duration_ms: Date.now() - started,
      });
    }
    throw error;
  }
}

/** A single backup can start while the primary is silent. Keep each attempt
 * viable until a usable reply wins, and show previews from one source at a time. */
async function raceSilentPrimary(
  primary: ModelTarget,
  backup: ModelTarget,
  messages: ProviderMessage[],
  options: GenerateOptions,
  deadline: number,
): Promise<AiReply> {
  const primaryController = new AbortController();
  const backupController = new AbortController();
  let visibleSource: 'primary' | 'backup' | undefined;
  let startBackup!: (reason: 'silence' | 'failure') => void;
  const backupStart = new Promise<'silence' | 'failure'>((resolve) => { startBackup = resolve; });
  const firstContentMs = options.buddy ? BUDDY_FIRST_CONTENT_MS : TUTOR_FIRST_CONTENT_MS;
  const timer = setTimeout(() => startBackup('silence'), Math.min(firstContentMs, Math.floor(options.timeoutMs * 0.45)));
  let backupAttempted = false;

  function attempt(target: ModelTarget, controller: AbortController, source: 'primary' | 'backup', timeoutMs: number) {
    options.signal?.throwIfAborted();
    const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
    return providerAttempt(target, messages, {
      ...options, timeoutMs, signal,
      onFirstContent: source === 'primary' ? () => clearTimeout(timer) : undefined,
      onDraft: (text) => {
        if (signal.aborted || (visibleSource && visibleSource !== source)) return;
        visibleSource = source;
        options.onDraft?.(text);
      },
    }).then((reply) => ({ source, reply })).catch((error: unknown) => {
      if (!signal.aborted && visibleSource === source) {
        visibleSource = undefined;
        options.onDraft?.('');
      }
      if (source === 'primary') startBackup('failure');
      throw error;
    });
  }

  try {
    const primaryReply = attempt(primary, primaryController, 'primary', primaryTimeoutMs(options.timeoutMs, options.buddy === true, true));
    const backupReply = backupStart.then((reason) => {
      clearTimeout(timer);
      options.signal?.throwIfAborted();
      const remaining = deadline - Date.now();
      if (remaining < MIN_ATTEMPT_MS) throw new HttpError(504, 'The AI response timed out. Please try again.');
      backupAttempted = true;
      if (reason === 'silence') {
        logger.debug(options.buddy ? 'ai_buddy_silent_primary' : 'ai_tutor_silent_primary', { remaining_ms: remaining });
      }
      return attempt(backup, backupController, 'backup',
        options.buddy && reason === 'failure' ? Math.min(remaining, BUDDY_BACKUP_MS) : remaining);
    });
    const { source, reply } = await Promise.any([primaryReply, backupReply]);
    options.signal?.throwIfAborted();
    if (visibleSource && visibleSource !== source) options.onDraft?.('');
    return reply;
  } catch (error) {
    options.signal?.throwIfAborted();
    if (error instanceof AggregateError) throw error.errors[backupAttempted ? 1 : 0];
    throw error;
  } finally {
    clearTimeout(timer);
    primaryController.abort();
    backupController.abort();
  }
}

/**
 * The first usable reply wins. Short Buddy and brief tutor streams can start
 * their backup sooner when the primary is silent.
 * The chain shares one deadline.
 */
export async function generateReply(
  messages: ProviderMessage[],
  options: GenerateOptions,
): Promise<AiReply> {
  options.signal?.throwIfAborted();
  const deadline = Date.now() + options.timeoutMs;
  let lastError: unknown;
  const targets = modelTargets(options.buddy === true);
  const [primary, backup] = targets;
  const watchForSilence = options.buddy ? Boolean(options.maxTokens && options.maxTokens <= 480)
    : options.brief && supportsBriefReasoning(primary);
  if (watchForSilence && options.onDraft
    && options.timeoutMs >= 1_500 && primary.apiKey.trim() && backup.apiKey.trim()
    && primary.apiUrl !== backup.apiUrl && supportsStreaming(primary.apiUrl)) {
    return raceSilentPrimary(primary, backup, messages, options, deadline);
  }
  for (const [index, target] of targets.entries()) {
    options.signal?.throwIfAborted();
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) break;
    const timeoutMs = index === 0
      ? primaryTimeoutMs(remaining, options.buddy === true, Boolean(backup.apiKey.trim()))
      : options.buddy ? Math.min(remaining, BUDDY_BACKUP_MS) : remaining;
    let shownDraft = false;
    try {
      return await providerAttempt(target, messages, {
        ...options,
        timeoutMs,
        onDraft: options.onDraft && ((text) => {
          shownDraft = true;
          options.onDraft?.(text);
        }),
      });
    } catch (error) {
      options.signal?.throwIfAborted();
      if (shownDraft) options.onDraft?.('');
      lastError = error;
    }
  }
  if (lastError instanceof HttpError) throw lastError;
  throw new HttpError(503, 'The AI service is temporarily unavailable. Please try again later.');
}
