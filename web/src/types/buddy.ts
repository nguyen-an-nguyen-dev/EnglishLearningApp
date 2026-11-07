/** Mirrors backend/src/modules/buddy/buddy.types.ts and reminders.types.ts. */

export type NudgeKind =
  | 'reminder'
  | 'streak'
  | 'comeback'
  | 'next-lesson'
  | 'weak-topic'
  | 'saved-words'
  | 'next-video'
  | 'arena'

export type NudgeTone = 'calm' | 'push' | 'proud'

export interface BuddyTarget {
  tab?: 'study' | 'videos' | 'translate' | 'compete' | 'rankings' | 'profile'
  lessonId?: number
  videoId?: number
  /** Declared element to circle, e.g. `lesson:12`, `video:9`, `control:notebook`. */
  highlight?: string
}

export interface NudgeAction {
  label: string
  target: BuddyTarget
}

export interface Nudge {
  id: string
  kind: NudgeKind
  tone: NudgeTone
  title: string
  body: string
  action: NudgeAction
  highlight?: string
  due_at?: string
}

export interface BuddySummary {
  streak: number
  active_today: boolean
  days_since_activity: number | null
  completed_lessons: number
  total_lessons: number
  saved_words: number
  due_reminders: number
}

export interface BuddyFeed {
  nudges: Nudge[]
  summary: BuddySummary
  greeting: string
}

export interface StudyReminder {
  id: number
  title: string
  body: string | null
  due_at: string
  target: BuddyTarget | null
  created_at: string
  delivered_at: string | null
  dismissed_at: string | null
  is_due: boolean
}

export interface ReminderSuggestion {
  title: string
  in_minutes: number | null
  at_time: string | null
  body: string | null
}

export interface BuddyAnswer {
  reply: string
  followups: string[]
  action: {
    kind: 'open_video' | 'open_lesson' | 'open_tab' | 'open_notebook'
    label: string
    tab?: BuddyTarget['tab']
    videoId?: number
    lessonId?: number
    lessonTitle?: string
    highlight?: string
  } | null
  suggestion: ReminderSuggestion | null
}
