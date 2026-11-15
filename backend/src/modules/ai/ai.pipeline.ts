import { env } from '../../config/env';
import { HttpError } from '../../middleware/error-handler';
import { classifyChatIntent, reviewAnswer } from './ai.decisions';
import type { AnswerReview, ReplyFlavor } from './ai.decisions';
import { MAX_REPLY_TOKENS, generateReply } from './ai.provider';
import type { AiReply, ChatContext, ChatIntent, ProviderMessage } from './ai.types';

/**
 * One chat turn, three layers:
 *
 *   1. router   — Decisions model may re-read the intent (ai.decisions.ts),
 *   2. generate — Sea-Lion then Gemini (ai.provider.ts),
 *   3. gate     — Decisions model reviews the draft; ship, repair once, or
 *                 replace it with the deterministic answer (ai.decisions.ts).
 *
 * Nothing reaches the frontend without passing layer 3 when it is enabled.
 */

/** The buddy must stay responsive even when a provider is slow. */
const COACH_TIMEOUT_MS = 25_000;
const REPAIR_TIMEOUT_MS = 15_000;
/** Below this there is no point starting another provider call. */
const MIN_STEP_MS = 750;

const REPAIR_INSTRUCTION = [
  'Câu trả lời vừa rồi bị bộ kiểm tra đánh giá CHƯA ĐẠT.',
  'Viết lại đúng một lần, bám sát câu hỏi mới nhất:',
  '- Chỉ dùng dữ liệu có trong CURRENT_PAGE_JSON / LEARNER_DATA_JSON, không thêm con số hay tên bài/video mới.',
  '- Không chào hỏi, không câu động viên sáo rỗng, không nhắc lại câu hỏi của người học.',
  '- Nếu là tiếng Việt thì toàn bộ phải là tiếng Việt (chỉ giữ tiếng Anh cho từ hoặc một câu ví dụ).',
  '- Giữ nguyên định dạng JSON đã yêu cầu.',
].join('\n');

export interface TurnRequest {
  messages: ProviderMessage[];
  message: string;
  intent: ChatIntent;
  context: ChatContext | null;
  flavor: ReplyFlavor;
  /** Deterministic answer built from real rows; used when the gate rejects. */
  offline: AiReply | null;
  /** Learner/page data the generator received, so the reviewer can check it. */
  learnerData?: string | null;
  maxTokens?: number;
}

export interface TurnResult {
  reply: AiReply;
  /** Null when the gate is disabled or could not score the draft. */
  review: AnswerReview | null;
}

/**
 * The client sends `chat` when it has no specific intent (it is also the
 * default in validation). That is the only case worth asking the Decisions
 * model about: an explicit intent from the client is already a real signal and
 * is never overridden. Any failure keeps the incoming intent.
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

async function repairReply(
  request: TurnRequest,
  draft: AiReply,
  deadline: number,
): Promise<AiReply | null> {
  const timeoutMs = stepBudget(deadline, REPAIR_TIMEOUT_MS);
  if (timeoutMs === null) return null;
  return generateReply(
    [
      ...request.messages,
      { role: 'assistant', content: draft.reply },
      { role: 'user', content: REPAIR_INSTRUCTION },
    ],
    { timeoutMs, maxTokens: request.maxTokens ?? MAX_REPLY_TOKENS, temperature: 0.3 },
  );
}

export async function answerTurn(request: TurnRequest): Promise<TurnResult> {
  const deadline = Date.now() + env.aiTurnBudgetMs;
  const generationTimeoutMs = stepBudget(
    deadline,
    request.flavor === 'coach' ? COACH_TIMEOUT_MS : env.aiTimeoutMs,
  );
  if (generationTimeoutMs === null) {
    if (request.offline) return { reply: request.offline, review: null };
    throw new HttpError(504, 'The AI response timed out. Please try again.');
  }

  let draft: AiReply;
  try {
    draft = await generateReply(request.messages, {
      timeoutMs: generationTimeoutMs,
      maxTokens: request.maxTokens ?? MAX_REPLY_TOKENS,
    });
  } catch (error) {
    // A provider outage is exactly why the deterministic answer exists.
    if (request.offline) return { reply: request.offline, review: null };
    throw error;
  }

  if (!env.aiDecisionEnabled) return { reply: draft, review: null };

  const review = await reviewAnswer({
    message: request.message,
    intent: request.intent,
    reply: draft.reply,
    context: request.context,
    flavor: request.flavor,
    learnerData: request.learnerData,
  });
  if (!review || review.verdict === 'ship') return { reply: draft, review };

  if (review.verdict === 'repair') {
    const repaired = await repairReply(request, draft, deadline).catch(() => null);
    if (repaired) {
      // The gate still gets the last word: a repair that is rejected falls back.
      const second = await reviewAnswer({
        message: request.message,
        intent: request.intent,
        reply: repaired.reply,
        context: request.context,
        flavor: request.flavor,
        learnerData: request.learnerData,
      });
      if (!second || second.verdict !== 'reject') return { reply: repaired, review: second ?? review };
    }
  }

  // Rejected (or the repair failed): the rows-based answer is always safer.
  if (request.offline) return { reply: request.offline, review };
  return { reply: draft, review };
}
