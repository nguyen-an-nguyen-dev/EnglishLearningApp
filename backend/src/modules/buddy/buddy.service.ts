import * as aiRepository from '../ai/ai.repository';
import { pickNextLesson } from '../ai/ai.service';
import type { StudyStats } from '../ai/ai.repository';
import * as remindersRepository from '../reminders/reminders.repository';
import * as remindersService from '../reminders/reminders.service';
import type { CreateReminderInput, StudyReminder } from '../reminders/reminders.types';
import { getLastActivityAt } from './buddy.repository';
import type { BuddySummary, Nudge, NudgeFeed } from './buddy.types';

const MAX_NUDGES = 4;

function startOfToday(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((startOfToday(b).getTime() - startOfToday(a).getTime()) / 86_400_000);
}

function formatReminderTime(iso: string, now: Date): string {
  const due = new Date(iso);
  const time = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`;
  return daysBetween(due, now) === 0 ? `hôm nay ${time}` : `ngày ${due.getDate()}/${due.getMonth() + 1} ${time}`;
}

/**
 * Nudges are computed from database rows with fixed priorities, never written by
 * the model. That is what keeps them specific ("còn 1 bài ở chặng 2", "12 từ đã
 * lưu chưa ôn") instead of the empty encouragement a chatbot produces.
 */
export function buildNudges(
  stats: StudyStats,
  reminders: StudyReminder[],
  lastActivityAt: Date | null,
  now: Date = new Date(),
  weakTopics: Array<{ topic: string; mistakes: number }> = [],
): Nudge[] {
  const nudges: Nudge[] = [];
  const daysSince = lastActivityAt ? daysBetween(lastActivityAt, now) : null;

  // 1. A reminder the learner asked for outranks everything else.
  for (const reminder of reminders) {
    nudges.push({
      id: `reminder:${reminder.id}`,
      kind: 'reminder',
      tone: 'push',
      title: reminder.title,
      body: reminder.body ?? `Bạn đã hẹn học lúc ${formatReminderTime(reminder.due_at, now)}.`,
      action: {
        label: 'Học luôn',
        target: reminder.target ?? { tab: 'study' },
      },
      highlight: reminder.target?.highlight,
      due_at: reminder.due_at,
    });
  }

  // 2. Streak about to break: the learner has a streak and nothing done today.
  const activeToday = lastActivityAt !== null && daysBetween(lastActivityAt, now) === 0;
  if (stats.streak > 0 && !activeToday) {
    nudges.push({
      id: 'streak:today',
      kind: 'streak',
      tone: 'push',
      title: `Chuỗi ${stats.streak} ngày đang chờ hôm nay`,
      body: 'Một bài ngắn là đủ giữ chuỗi. Chưa có hoạt động nào từ hôm qua.',
      action: { label: 'Giữ chuỗi', target: { tab: 'study' } },
    });
  }

  // 3. Been away: no points for guilt-tripping, just name the gap.
  if (daysSince !== null && daysSince >= 3) {
    nudges.push({
      id: 'comeback:gap',
      kind: 'comeback',
      tone: 'calm',
      title: `Đã ${daysSince} ngày không mở bài`,
      body: stats.completedLessons > 0
        ? `Bạn dừng ở ${stats.completedLessons}/${stats.totalLessons} bài. Làm lại một bài đã học cũng tính là quay lại.`
        : 'Bắt đầu bằng đúng một bài, không cần học nhiều.',
      action: { label: 'Vào bài ngắn', target: { tab: 'study' } },
    });
  }

  const next = pickNextLesson(stats);

  // 4. The concrete next step in the roadmap.
  if (next) {
    const remaining = stats.totalLessons - stats.completedLessons;
    nudges.push({
      id: `next-lesson:${next.id}`,
      kind: 'next-lesson',
      tone: 'calm',
      title: `Bài đang mở: ${next.title}`,
      body: `Còn ${remaining} bài trong lộ trình. Bài này thuộc chủ đề ${next.topic}.`,
      action: {
        label: 'Mở bài này',
        target: { tab: 'study', lessonId: next.id, highlight: `lesson:${next.id}` },
      },
      highlight: `lesson:${next.id}`,
    });
  }

  // 5. Recurring mistakes beat generic suggestions.
  const weak = weakTopics[0];
  if (weak && weak.mistakes >= 3) {
    nudges.push({
      id: `weak-topic:${weak.topic}`,
      kind: 'weak-topic',
      tone: 'calm',
      title: `Chủ đề ${weak.topic} đang sai nhiều`,
      body: `${weak.mistakes} câu sai gần đây ở chủ đề này, nhiều hơn các chủ đề còn lại.`,
      action: { label: 'Ôn chủ đề này', target: { tab: 'study' } },
    });
  }

  // 6. Saved words nobody has reviewed.
  if (stats.savedWords >= 5) {
    nudges.push({
      id: 'saved-words:review',
      kind: 'saved-words',
      tone: 'calm',
      title: `${stats.savedWords} từ trong Sổ từ`,
      body: 'Sổ từ chỉ có ích khi mở lại. Đọc qua vài từ là đủ một lượt ôn.',
      action: {
        label: 'Mở Sổ từ',
        target: { tab: 'videos', highlight: 'control:notebook' },
      },
      highlight: 'control:notebook',
    });
  }

  // 7. Listening practice still untouched.
  if (stats.nextVideo) {
    nudges.push({
      id: `next-video:${stats.nextVideo.id}`,
      kind: 'next-video',
      tone: 'calm',
      title: `Chưa nghe: ${stats.nextVideo.title}`,
      body: `Đã xong ${stats.videosCompleted}/${stats.videosTotal} video trong thư viện.`,
      action: {
        label: 'Nghe thử',
        target: { tab: 'videos', videoId: stats.nextVideo.id, highlight: `video:${stats.nextVideo.id}` },
      },
      highlight: `video:${stats.nextVideo.id}`,
    });
  }

  // 8. Arena only once there is something to apply.
  if (stats.battlesPlayed === 0 && stats.completedLessons >= 3) {
    nudges.push({
      id: 'arena:first',
      kind: 'arena',
      tone: 'calm',
      title: 'Chưa đấu trận nào',
      body: `Bạn đã xong ${stats.completedLessons} bài. Một vòng đấu 1v1 kiểm tra phản xạ từ nhanh hơn đọc lại.`,
      action: { label: 'Vào đấu trường', target: { tab: 'compete', highlight: 'control:arena-start' } },
      highlight: 'control:arena-start',
    });
  }

  return nudges.slice(0, MAX_NUDGES);
}

/** The one line the car says before the learner opens anything. */
export function buildGreeting(
  stats: StudyStats,
  reminders: StudyReminder[],
  lastActivityAt: Date | null,
  now: Date = new Date(),
): string {
  if (reminders.length > 0) {
    const first = reminders[0];
    return `Tới giờ rồi: ${first.title.toLowerCase()}.`;
  }
  if (lastActivityAt === null) {
    return 'Bạn chưa mở bài nào. Mình mở bài đầu tiên nhé?';
  }
  const days = daysBetween(lastActivityAt, now);
  if (days === 0) {
    const next = pickNextLesson(stats);
    return next ? `Hôm nay bạn đã học. Bài tiếp theo là ${next.title}.` : 'Hôm nay bạn đã học. Ghi nhận rồi nhé.';
  }
  if (days === 1) {
    return stats.streak > 0 ? `Còn một bài nữa là giữ chuỗi ${stats.streak} ngày.` : 'Hôm qua bạn học. Hôm nay làm một bài ngắn nhé.';
  }
  return `${days} ngày rồi chưa mở bài. Quay lại bằng một bài ngắn thôi.`;
}

/** Saves a reminder the learner accepted from a suggestion. */
export async function createFromSuggestion(
  userId: number,
  input: CreateReminderInput,
): Promise<StudyReminder> {
  return remindersService.createReminderRecord(userId, input);
}

export async function getNudges(userId: number, now: Date = new Date()): Promise<NudgeFeed> {
  const [stats, dueReminders, lastActivityAt, learner] = await Promise.all([
    aiRepository.getStudyStats(userId),
    remindersRepository.listDueReminders(userId),
    getLastActivityAt(userId),
    aiRepository.getLearnerContext(userId),
  ]);

  // The list endpoint hands the client the same rows with their target parsed.
  const reminders: StudyReminder[] = dueReminders.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    due_at: new Date(row.due_at).toISOString(),
    target: row.target_json ? JSON.parse(row.target_json) : null,
    created_at: new Date(row.created_at).toISOString(),
    delivered_at: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
    dismissed_at: null,
    is_due: true,
  }));

  const summary: BuddySummary = {
    streak: stats.streak,
    active_today: lastActivityAt !== null && daysBetween(lastActivityAt, now) === 0,
    days_since_activity: lastActivityAt ? daysBetween(lastActivityAt, now) : null,
    completed_lessons: stats.completedLessons,
    total_lessons: stats.totalLessons,
    saved_words: stats.savedWords,
    due_reminders: reminders.length,
  };

  return {
    nudges: buildNudges(stats, reminders, lastActivityAt, now, learner.weakTopics),
    summary,
    greeting: buildGreeting(stats, reminders, lastActivityAt, now),
  };
}
