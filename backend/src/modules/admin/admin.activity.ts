// Every learner action that counts as "activity" lives here once so overview
// stats, inactive reports and admin lists can't disagree on "last active".
// `progress`/`video_progress` use `updated_at`; the rest are append-only.
export function activityEventRows(): string {
  return `(
    SELECT user_id, updated_at AS ts FROM progress
    UNION ALL SELECT user_id, updated_at FROM video_progress
    UNION ALL SELECT user_id, created_at FROM learning_answer_attempts
    UNION ALL SELECT player_one_id AS user_id, created_at AS ts FROM matches
    UNION ALL SELECT player_two_id AS user_id, created_at AS ts FROM matches
    UNION ALL SELECT user_id, created_at FROM translations WHERE user_id IS NOT NULL
    UNION ALL SELECT user_id, updated_at FROM chats
    UNION ALL SELECT user_id, created_at FROM saved_words
  )`;
}

/** Active learner ids matching a timestamp predicate, e.g. `ts >= ...`. */
export function activeUserIds(timestampCondition: string): string {
  return `(
    SELECT DISTINCT user_id AS uid FROM ${activityEventRows()} ev
    WHERE ${timestampCondition}
  )`;
}

export const LAST_ACTIVITY_JOIN = `LEFT JOIN (
  SELECT user_id, MAX(ts) AS last_activity_at
  FROM ${activityEventRows()} ev
  GROUP BY user_id
) activity ON activity.user_id = u.id`;
