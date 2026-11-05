import { HttpError } from '../../middleware/error-handler';
import {
  AI_TOPICS,
  CHAT_INTENTS,
  CHAT_TABS,
  type AiTopic,
  type ChatContext,
  type ChatIntent,
  type ChatTab,
  type ChatTurn,
} from './ai.types';

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
}

export function parseAiTopic(value: unknown): AiTopic {
  if (typeof value !== 'string' || !AI_TOPICS.includes(value as AiTopic)) {
    throw new HttpError(422, 'Validation failed', [`topic must be one of: ${AI_TOPICS.join(', ')}.`]);
  }
  return value as AiTopic;
}

export function parseChatId(value: string | string[]): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'Invalid chat ID.');
  return id;
}

export function parseUserMessage(value: unknown): string {
  const body = asObject(value);
  if (typeof body.message !== 'string' || !body.message.trim()) {
    throw new HttpError(422, 'Validation failed', ['message must be a non-empty string.']);
  }
  const message = body.message.trim();
  if (message.length > 2000) {
    throw new HttpError(422, 'Validation failed', ['message must be 2000 characters or fewer.']);
  }
  return message;
}

function shortText(value: unknown, limit: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().slice(0, limit);
  return text || undefined;
}

function parseIntent(value: unknown): ChatIntent {
  if (value === undefined || value === null || value === '') return 'chat';
  if (typeof value !== 'string' || !CHAT_INTENTS.includes(value as ChatIntent)) {
    throw new HttpError(422, 'Validation failed', [`intent must be one of: ${CHAT_INTENTS.join(', ')}.`]);
  }
  return value as ChatIntent;
}

function parseContext(value: unknown): ChatContext | null {
  if (value === undefined || value === null) return null;
  const raw = asObject(value);
  const tab = typeof raw.tab === 'string' && CHAT_TABS.includes(raw.tab as ChatTab)
    ? raw.tab as ChatTab
    : 'study';
  return {
    tab,
    focus: shortText(raw.focus, 240),
    detail: shortText(raw.detail, 1000),
  };
}

/** A chat turn = message + optional study intent + untrusted page context. */
export function parseChatTurn(value: unknown): ChatTurn {
  return {
    message: parseUserMessage(value),
    intent: parseIntent(asObject(value).intent),
    context: parseContext(asObject(value).context),
  };
}
