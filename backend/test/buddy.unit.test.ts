import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNudges, buildGreeting } from '../src/modules/buddy/buddy.service';
import type { StudyStats } from '../src/modules/ai/ai.repository';
import type { StudyReminder } from '../src/modules/reminders/reminders.types';
import { parseBuddyTarget, parseReminderTiming } from '../src/modules/reminders/reminders.validation';
import { parseReminderSuggestion } from '../src/modules/ai/ai.service';
import { parseSuggestionInput } from '../src/modules/buddy/buddy.validation';

function stats(overrides: Partial<StudyStats> = {}): StudyStats {
  return {
    totalLessons: 36,
    completedLessons: 35,
    completedLessonIds: [1, 2],
    lessons: [
      { id: 1, title: 'Greetings', topic: 'Greetings', stageTitle: 'A1' },
      { id: 36, title: 'Literature', topic: 'Literature', stageTitle: 'C2' },
    ],
    videoCatalog: [],
    videosTotal: 4,
    videosCompleted: 0,
    nextVideo: { id: 9, title: 'Small Talk' },
    savedWords: 0,
    translations: 0,
    battlesPlayed: 0,
    battleWins: 0,
    badges: 0,
    xp: 900,
    streak: 7,
    ownedVideos: 0,
    ownedVideoTitles: [],
    ...overrides,
  };
}

function reminder(overrides: Partial<StudyReminder> = {}): StudyReminder {
  return {
    id: 5,
    title: 'Ôn Sổ từ',
    body: null,
    due_at: '2026-11-07T13:00:00.000Z',
    target: { tab: 'videos', highlight: 'control:notebook' },
    created_at: '2026-11-07T12:00:00.000Z',
    delivered_at: null,
    dismissed_at: null,
    is_due: true,
    ...overrides,
  };
}

const now = new Date('2026-11-07T14:00:00.000Z');

test('nudges quote real numbers instead of generic encouragement', () => {
  const nudges = buildNudges(stats(), [], new Date('2026-11-06T10:00:00.000Z'), now);
  const streak = nudges.find((nudge) => nudge.kind === 'streak');
  assert.ok(streak, 'a streak at risk must produce a nudge');
  assert.match(streak.title, /7/);
  assert.equal(streak.tone, 'push');

  const next = nudges.find((nudge) => nudge.kind === 'next-lesson');
  assert.ok(next);
  assert.match(next.body, /1 bài/, 'the body must quote the remaining lesson count');
  assert.equal(next.highlight, 'lesson:36');

  const banned = /cố lên|bạn làm tốt lắm|kiên trì|practice makes/i;
  for (const nudge of nudges) {
    assert.doesNotMatch(`${nudge.title} ${nudge.body}`, banned, 'no empty encouragement');
  }
});

test('a due reminder outranks every other nudge', () => {
  const nudges = buildNudges(stats(), [reminder()], new Date('2026-11-07T12:00:00.000Z'), now);
  assert.equal(nudges[0].kind, 'reminder');
  assert.equal(nudges[0].action.target.tab, 'videos');
  assert.equal(nudges[0].highlight, 'control:notebook');
});

test('an inactive learner gets the streak nudge; an active one does not', () => {
  const inactive = buildNudges(stats(), [], new Date('2026-11-06T10:00:00.000Z'), now);
  assert.ok(inactive.some((nudge) => nudge.kind === 'streak'));

  const active = buildNudges(stats(), [], new Date('2026-11-07T11:00:00.000Z'), now);
  assert.equal(active.some((nudge) => nudge.kind === 'streak'), false);
});

test('a long gap produces a comeback nudge that names the gap', () => {
  const nudges = buildNudges(stats({ streak: 0 }), [], new Date('2026-11-02T10:00:00.000Z'), now);
  const comeback = nudges.find((nudge) => nudge.kind === 'comeback');
  assert.ok(comeback);
  assert.match(comeback.title, /5 ngày/);
});

test('the greeting changes with the learner state', () => {
  assert.match(
    buildGreeting(stats(), [reminder({ title: 'Ôn Sổ từ' })], new Date('2026-11-07T11:00:00.000Z'), now),
    /Tới giờ/,
  );
  assert.match(buildGreeting(stats(), [], null, now), /chưa mở bài nào/);
  assert.match(buildGreeting(stats(), [], new Date('2026-11-06T10:00:00.000Z'), now), /giữ chuỗi 7 ngày/);
});

test('reminder timing resolves "in minutes" and clock times safely', () => {
  const inThirty = parseReminderTiming({ in_minutes: 30 }, now);
  assert.equal(inThirty.getTime() - now.getTime(), 30 * 60_000);

  const laterToday = parseReminderTiming({ at_time: '20:00' }, now);
  assert.equal(laterToday.getHours(), 20);
  assert.ok(laterToday.getTime() > now.getTime());

  // A clock time already gone means tomorrow, never the past.
  const alreadyGone = parseReminderTiming({ at_time: '08:00' }, now);
  assert.ok(alreadyGone.getTime() > now.getTime(), 'must never schedule in the past');
  assert.ok(
    alreadyGone.getTime() - now.getTime() <= 24 * 3_600_000,
    'must stay within the next day',
  );
  assert.equal(alreadyGone.getHours(), 8);

  assert.throws(() => parseReminderTiming({}, now));
});

test('only declared targets and highlight tokens are accepted', () => {
  assert.deepEqual(parseBuddyTarget({ tab: 'videos', highlight: 'video:9' }), {
    tab: 'videos',
    highlight: 'video:9',
  });
  // Anything not declared in a screen is dropped rather than trusted.
  assert.equal(parseBuddyTarget({ highlight: 'body' }), null);
  assert.equal(parseBuddyTarget({ highlight: 'lesson:12) ; drop table' }), null);
  assert.equal(parseBuddyTarget({ tab: 'admin' }), null);
  assert.deepEqual(parseBuddyTarget({ lessonId: 12 }), { lessonId: 12 });
});

test('a reminder suggestion needs a title and one unambiguous time', () => {
  assert.equal(parseReminderSuggestion({ title: 'Ôn từ' }), null);
  assert.equal(parseReminderSuggestion({ in_minutes: 20 }), null, 'title is required');

  const ok = parseReminderSuggestion({ title: 'Ôn từ', in_minutes: 20, body: 'Ôn Sổ từ' });
  assert.deepEqual(ok, { title: 'Ôn từ', in_minutes: 20, at_time: null, body: 'Ôn Sổ từ' });

  // The learner still confirms: the suggestion becomes a real instant server-side.
  const created = parseSuggestionInput({ suggestion: ok, target: { tab: 'videos' } }, now);
  assert.equal(created.dueAt.getTime() - now.getTime(), 20 * 60_000);
  assert.equal(created.title, 'Ôn từ');
});
