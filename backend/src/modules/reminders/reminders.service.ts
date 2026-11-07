import { HttpError } from '../../middleware/error-handler';
import * as repo from './reminders.repository';
import { parseBuddyTarget, parseReminderInput } from './reminders.validation';
import type { CreateReminderInput, ReminderRow, StudyReminder } from './reminders.types';

function mapReminder(row: ReminderRow, now = Date.now()): StudyReminder {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    due_at: new Date(row.due_at).toISOString(),
    target: row.target_json ? parseBuddyTarget(JSON.parse(row.target_json)) : null,
    created_at: new Date(row.created_at).toISOString(),
    delivered_at: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
    dismissed_at: row.dismissed_at ? new Date(row.dismissed_at).toISOString() : null,
    is_due: new Date(row.due_at).getTime() <= now,
  };
}

export async function listReminders(userId: number): Promise<StudyReminder[]> {
  const rows = await repo.listReminders(userId);
  const now = Date.now();
  return rows.map((row) => mapReminder(row, now));
}

export async function createReminder(userId: number, input: unknown): Promise<StudyReminder> {
  const parsed = parseReminderInput(input);
  return createReminderRecord(userId, parsed);
}

/** Used when the instant is already resolved (e.g. accepting a suggestion). */
export async function createReminderRecord(
  userId: number,
  input: CreateReminderInput,
): Promise<StudyReminder> {
  const id = await repo.insertReminder(userId, input);
  const row = await repo.getReminder(userId, id);
  if (!row) throw new HttpError(500, 'Created reminder could not be loaded.');
  return mapReminder(row);
}

export async function dismissReminder(userId: number, reminderId: number): Promise<void> {
  const dismissed = await repo.dismissReminder(userId, reminderId);
  if (!dismissed) throw new HttpError(404, 'Reminder not found.');
}

/** Called when the client has actually shown a due reminder. */
export async function acknowledgeReminder(userId: number, reminderId: number): Promise<void> {
  const row = await repo.getReminder(userId, reminderId);
  if (!row) throw new HttpError(404, 'Reminder not found.');
  await repo.markDelivered(userId, reminderId);
}

export function mapDueReminders(rows: ReminderRow[], now = Date.now()): StudyReminder[] {
  return rows.map((row) => mapReminder(row, now));
}
