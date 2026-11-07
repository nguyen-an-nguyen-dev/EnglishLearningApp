import { HttpError } from '../../middleware/error-handler';
import type { BuddyTarget } from './reminders.types';

/** Elements a screen can expose for the buddy to point at. */
export const HIGHLIGHT_PATTERN = /^(lesson|video|word|tab|control|page):[A-Za-z0-9_-]{1,60}$/;
const TABS = ['study', 'videos', 'translate', 'compete', 'rankings', 'profile'] as const;

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function parseReminderId(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Invalid reminder ID.');
  return id;
}

/** Turns whatever the model produced into a target the client can act on. */
export function parseBuddyTarget(value: unknown): BuddyTarget | null {
  const raw = asObject(value);
  const target: BuddyTarget = {};

  if (typeof raw.tab === 'string' && (TABS as readonly string[]).includes(raw.tab)) {
    target.tab = raw.tab as BuddyTarget['tab'];
  }

  for (const key of ['lessonId', 'videoId'] as const) {
    const id = Number(raw[key]);
    if (Number.isInteger(id) && id > 0) target[key] = id;
  }

  if (typeof raw.highlight === 'string' && HIGHLIGHT_PATTERN.test(raw.highlight.trim())) {
    target.highlight = raw.highlight.trim();
  }

  return Object.keys(target).length > 0 ? target : null;
}

/**
 * Resolves when a reminder should fire. The model resolves "8 giờ tối" to a
 * clock time using the `now_local` value it is given, and the server turns that
 * into a real instant, so a model that misreads the clock cannot schedule
 * something months away.
 */
export function parseReminderTiming(
  value: unknown,
  now: Date = new Date(),
): Date {
  const body = asObject(value);
  const minutes = Number(body.in_minutes ?? body.inMinutes);
  if (Number.isFinite(minutes) && minutes > 0) {
    const clamped = Math.min(Math.max(Math.round(minutes), 1), 60 * 24 * 30);
    return new Date(now.getTime() + clamped * 60_000);
  }

  const clock = body.at_time ?? body.atTime;
  if (typeof clock === 'string' && /^\d{1,2}:\d{2}$/.test(clock.trim())) {
    const [hours, mins] = clock.trim().split(':').map(Number);
    if (hours <= 23 && mins <= 59) {
      const due = new Date(now);
      due.setHours(hours, mins, 0, 0);
      // A clock time already gone today means the learner means tomorrow.
      if (due.getTime() <= now.getTime()) due.setDate(due.getDate() + 1);
      return due;
    }
  }

  throw new HttpError(
    422,
    'Tell the buddy when to remind you, for example "in 30 minutes" or "at 20:00".',
    ['REMINDER_TIME_MISSING'],
  );
}

export function parseReminderInput(
  value: unknown,
  now: Date = new Date(),
): { title: string; body: string | null; dueAt: Date; target: BuddyTarget | null } {
  const raw = asObject(value);
  const errors: string[] = [];

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (title.length === 0 || title.length > 160) {
    errors.push('title must contain between 1 and 160 characters.');
  }

  let body: string | null = null;
  if (raw.body !== undefined && raw.body !== null && raw.body !== '') {
    if (typeof raw.body !== 'string' || raw.body.trim().length > 500) {
      errors.push('body must be a string of at most 500 characters.');
    } else {
      body = raw.body.trim();
    }
  }

  let dueAt: Date | null = null;
  try {
    dueAt = parseReminderTiming(raw, now);
  } catch (error) {
    if (error instanceof HttpError) errors.push(...error.errors.map(() => 'Provide "in_minutes" or "at_time".'));
    else throw error;
  }

  if (errors.length) throw new HttpError(422, 'Validation failed', [...new Set(errors)]);

  return {
    title,
    body,
    dueAt: dueAt as Date,
    target: parseBuddyTarget(raw.target),
  };
}
