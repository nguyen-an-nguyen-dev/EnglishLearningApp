import { HttpError } from '../../middleware/error-handler';
import { parseReminderTiming } from '../reminders/reminders.validation';
import type { ReminderSuggestion } from '../ai/ai.service';
import type { CreateReminderInput } from '../reminders/reminders.types';
import { parseBuddyTarget } from '../reminders/reminders.validation';

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/**
 * The learner taps "Đặt nhắc" on a suggestion the buddy made. The server
 * re-resolves the instant from `in_minutes` / `at_time`, so accepting a
 * suggestion can never schedule something the model simply made up.
 */
export function parseSuggestionInput(value: unknown, now: Date = new Date()): CreateReminderInput {
  const body = asObject(value);
  const suggestion = asObject(body.suggestion) as unknown as ReminderSuggestion;

  const title = typeof suggestion.title === 'string' ? suggestion.title.trim() : '';
  if (!title || title.length > 160) {
    throw new HttpError(422, 'Validation failed', ['suggestion.title must contain between 1 and 160 characters.']);
  }

  const dueAt = parseReminderTiming({
    in_minutes: suggestion.in_minutes,
    at_time: suggestion.at_time,
  }, now);

  const rawBody = typeof suggestion.body === 'string' ? suggestion.body.trim().slice(0, 500) : '';

  return {
    title,
    body: rawBody || null,
    dueAt,
    target: parseBuddyTarget(body.target),
  };
}
