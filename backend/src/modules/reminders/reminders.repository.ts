import type { ResultSetHeader } from 'mysql2/promise';
import { pool } from '../../db/pool';
import type { CreateReminderInput, ReminderRow } from './reminders.types';

const REMINDER_COLUMNS = 'id, user_id, title, body, due_at, target_json, created_at, delivered_at, dismissed_at';

export async function listReminders(userId: number): Promise<ReminderRow[]> {
  const [rows] = await pool.execute<ReminderRow[]>(
    `SELECT ${REMINDER_COLUMNS} FROM study_reminders
      WHERE user_id = ? AND dismissed_at IS NULL
      ORDER BY due_at ASC
      LIMIT 50`,
    [userId],
  );
  return rows;
}

export async function getReminder(userId: number, reminderId: number): Promise<ReminderRow | undefined> {
  const [rows] = await pool.execute<ReminderRow[]>(
    `SELECT ${REMINDER_COLUMNS} FROM study_reminders WHERE id = ? AND user_id = ? LIMIT 1`,
    [reminderId, userId],
  );
  return rows[0];
}

export async function insertReminder(userId: number, input: CreateReminderInput): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO study_reminders (user_id, title, body, due_at, target_json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      userId,
      input.title,
      input.body,
      input.dueAt,
      input.target ? JSON.stringify(input.target) : null,
    ],
  );
  return result.insertId;
}

export async function markDelivered(userId: number, reminderId: number): Promise<void> {
  await pool.execute(
    'UPDATE study_reminders SET delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP) WHERE id = ? AND user_id = ?',
    [reminderId, userId],
  );
}

export async function dismissReminder(userId: number, reminderId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE study_reminders SET dismissed_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND dismissed_at IS NULL',
    [reminderId, userId],
  );
  return result.affectedRows > 0;
}

/** Due reminders that have not been shown yet; the client turns these into nudges. */
export async function listDueReminders(userId: number): Promise<ReminderRow[]> {
  const [rows] = await pool.execute<ReminderRow[]>(
    `SELECT ${REMINDER_COLUMNS} FROM study_reminders
      WHERE user_id = ? AND dismissed_at IS NULL AND delivered_at IS NULL AND due_at <= CURRENT_TIMESTAMP
      ORDER BY due_at ASC
      LIMIT 5`,
    [userId],
  );
  return rows;
}
