import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../db/pool';
import type { ActivityRow } from './buddy.types';

interface DateRow extends RowDataPacket {
  last_activity: Date | null;
}

/** The most recent moment the learner actually did something, across features. */
export async function getLastActivityAt(userId: number): Promise<Date | null> {
  const [rows] = await pool.execute<DateRow[]>(
    `SELECT GREATEST(
       COALESCE((SELECT MAX(completed_at) FROM progress WHERE user_id = ?), '1970-01-01'),
       COALESCE((SELECT MAX(updated_at) FROM video_progress WHERE user_id = ?), '1970-01-01'),
       COALESCE((SELECT MAX(created_at) FROM learning_answer_attempts WHERE user_id = ?), '1970-01-01'),
       COALESCE((SELECT MAX(created_at) FROM matches WHERE player_one_id = ? OR player_two_id = ?), '1970-01-01')
     ) AS last_activity`,
    [userId, userId, userId, userId, userId],
  );
  const value = rows[0]?.last_activity;
  if (!value || new Date(value).getTime() <= 0) return null;
  return new Date(value);
}

export type { ActivityRow };
