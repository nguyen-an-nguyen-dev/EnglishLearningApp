import { env } from '../../config/env';
import { HttpError } from '../../middleware/error-handler';
import { classifyChatIntent } from './ai.decisions';
import type { ReplyFlavor } from './ai.decisions';
import { MAX_REPLY_TOKENS, generateReply } from './ai.provider';
import type { AiReply, ChatContext, ChatIntent, ProviderMessage } from './ai.types';

/**
 * One chat turn: the router (ai.decisions.ts) may re-read the intent, then one
 * model call (ai.provider.ts: Token Harbor DeepSeek, then Gemini Flash) writes
 * the reply. There is no review or repair step. The deterministic answer is
 * used only when every provider fails.
 */

/** The buddy must stay responsive even when a provider is slow. */
const COACH_TIMEOUT_MS = 25_000;
/** Below this there is no point starting another provider call. */
const MIN_STEP_MS = 750;

export interface TurnRequest {
  messages: ProviderMessage[];
  flavor: ReplyFlavor;
  /** Deterministic answer built from real rows; used when every provider fails. */
  offline: AiReply | null;
  maxTokens?: number;
}

/**
 * Only the client's default `chat` intent is worth re-routing: an explicit
 * intent is already a real signal and is never overridden. Any failure keeps the
 * incoming intent.
 */
export async function resolveTurnIntent(
  message: string,
  intent: ChatIntent,
  context: ChatContext | null,
): Promise<ChatIntent> {
  if (intent !== 'chat') return intent;
  const decision = await classifyChatIntent(message, context);
  return decision?.confident ? decision.intent : intent;
}

/** Time left for one step, or null when the turn budget is spent. */
function stepBudget(deadline: number, stepTimeoutMs: number): number | null {
  const left = Math.min(stepTimeoutMs, deadline - Date.now());
  return left >= MIN_STEP_MS ? left : null;
}

export async function answerTurn(request: TurnRequest): Promise<AiReply> {
  const deadline = Date.now() + env.aiTurnBudgetMs;
  const timeoutMs = stepBudget(
    deadline,
    request.flavor === 'coach' ? COACH_TIMEOUT_MS : env.aiTimeoutMs,
  );
  if (timeoutMs === null) {
    if (request.offline) return request.offline;
    throw new HttpError(504, 'The AI response timed out. Please try again.');
  }

  try {
    return await generateReply(request.messages, {
      timeoutMs,
      maxTokens: request.maxTokens ?? MAX_REPLY_TOKENS,
    });
  } catch (error) {
    // A provider outage is exactly why the deterministic answer exists.
    if (request.offline) return request.offline;
    throw error;
  }
}
