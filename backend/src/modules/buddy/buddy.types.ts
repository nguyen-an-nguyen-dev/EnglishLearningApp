import type { RowDataPacket } from 'mysql2';
import type { BuddyTarget } from '../reminders/reminders.types';

export type NudgeKind =
  | 'reminder'
  | 'streak'
  | 'comeback'
  | 'next-lesson'
  | 'review-due'
  | 'weak-topic'
  | 'saved-words'
  | 'next-video'
  | 'arena';

export type NudgeTone = 'calm' | 'push' | 'proud';

export interface NudgeAction {
  label: string;
  target: BuddyTarget;
}

export interface Nudge {
  /** Stable per nudge, so the client can remember "đã bỏ qua" without re-asking. */
  id: string;
  kind: NudgeKind;
  tone: NudgeTone;
  title: string;
  body: string;
  action: NudgeAction;
  /** Element on the destination screen worth circling, e.g. `lesson:12`. */
  highlight?: string;
  /** Only for reminders: the instant it fires. */
  due_at?: string;
}

export interface BuddySummary {
  streak: number;
  active_today: boolean;
  days_since_activity: number | null;
  completed_lessons: number;
  total_lessons: number;
  saved_words: number;
  due_reminders: number;
}

export interface NudgeFeed {
  nudges: Nudge[];
  summary: BuddySummary;
  greeting: string;
}

export interface ActivityRow extends RowDataPacket {
  last_activity: Date | null;
}
