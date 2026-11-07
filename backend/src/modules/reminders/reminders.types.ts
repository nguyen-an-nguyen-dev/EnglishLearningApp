import type { RowDataPacket } from 'mysql2';

/** Where the buddy should take the learner when a nudge or reminder is opened. */
export interface BuddyTarget {
  tab?: 'study' | 'videos' | 'translate' | 'compete' | 'rankings' | 'profile';
  lessonId?: number;
  videoId?: number;
  /** A declared on-screen element, e.g. `lesson:12`, `video:9`, `control:arena-start`. */
  highlight?: string;
}

export interface StudyReminder {
  id: number;
  title: string;
  body: string | null;
  due_at: string;
  target: BuddyTarget | null;
  created_at: string;
  delivered_at: string | null;
  dismissed_at: string | null;
  /** True once `due_at` has passed and it has not been dismissed. */
  is_due: boolean;
}

export interface ReminderRow extends RowDataPacket {
  id: number;
  user_id: number;
  title: string;
  body: string | null;
  due_at: Date;
  target_json: string | null;
  created_at: Date;
  delivered_at: Date | null;
  dismissed_at: Date | null;
}

export interface CreateReminderInput {
  title: string;
  body: string | null;
  dueAt: Date;
  target: BuddyTarget | null;
}
