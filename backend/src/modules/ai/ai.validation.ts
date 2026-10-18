import { HttpError } from '../../middleware/error-handler';
import { AI_TOPICS, type AiTopic } from './ai.types';

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
