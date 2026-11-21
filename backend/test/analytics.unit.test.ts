import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  behaviorInsights,
  buildInsights,
  contentInsights,
  duelInsights,
  forgottenInsights,
  lessonInsights,
  repeatedMistakeInsights,
  vocabularyInsights,
} from '../src/modules/analytics/analytics.insights';
import type {
  BehaviorStats,
  CompetitionStats,
  ContentFlag,
  ExerciseStat,
  LessonStat,
  QuestionStat,
  VocabularyStat,
} from '../src/modules/analytics/analytics.types';

function vocabulary(overrides: Partial<VocabularyStat> = {}): VocabularyStat {
  return {
    word_id: 1,
    word: 'serendipity',
    translation: 'sự tình cờ may mắn',
    ipa: null,
    part_of_speech: 'noun',
    cefr_level: 'B2',
    attempts: 6,
    correct: 1,
    accuracy: 1 / 6,
    avg_response_ms: 4000,
    last_seen: null,
    saved: false,
    review_due_at: null,
    review_repetitions: null,
    ...overrides,
  };
}

function question(overrides: Partial<QuestionStat> = {}): QuestionStat {
  return {
    question_id: 10,
    prompt: 'Phương tiện nào di chuyển trên đường ray?',
    question_type: 'multiple_choice',
    difficulty: 'A2',
    lesson_id: 3,
    lesson_title: 'Transport',
    topic: 'Travel',
    attempts: 5,
    correct: 1,
    accuracy: 1 / 5,
    avg_response_ms: 3000,
    wrong_answers: [],
    ...overrides,
  };
}

function lesson(overrides: Partial<LessonStat> = {}): LessonStat {
  return {
    lesson_id: 3,
    title: 'Transport',
    topic: 'Travel',
    stage_title: 'Chặng 1',
    total_questions: 10,
    answered_questions: 10,
    status: 'completed',
    score: 100,
    attempts: 1,
    practice_seconds: 240,
    accuracy: 1,
    abandoned: false,
    ...overrides,
  };
}

const calmBehavior: BehaviorStats = {
  streak: 3,
  active_days_30: 12,
  answers_30: 60,
  accuracy_30: 0.8,
  accuracy_prev_30: 0.78,
  study_minutes_30: 90,
  daily: [],
};

const noCompetition: CompetitionStats = {
  matches: 0,
  wins: 0,
  answers: 0,
  correct: 0,
  accuracy: null,
  avg_response_ms: null,
};

test('a word needs enough attempts before it counts as weak', () => {
  // Two misses out of two is bad luck, not a pattern.
  assert.deepEqual(vocabularyInsights([vocabulary({ attempts: 2, correct: 0, accuracy: 0 })]), []);

  const weak = vocabularyInsights([vocabulary()]);
  assert.equal(weak.length, 1);
  assert.equal(weak[0].code, 'weak_vocabulary');
  assert.equal(weak[0].ref_id, 1, 'the insight points back at the real word');
  assert.equal(weak[0].severity, 'high', 'one in six is a severe gap');

  // A word the learner mostly knows is not a weakness.
  assert.deepEqual(vocabularyInsights([vocabulary({ attempts: 6, correct: 5, accuracy: 5 / 6 })]), []);
});

test('forgotten words surface only after repeated lapses', () => {
  const once = forgottenInsights([{ word_id: 1, word: 'apple', lapses: 1 }]);
  assert.equal(once.length, 0, 'a single lapse is normal forgetting');

  const twice = forgottenInsights([{ word_id: 2, word: 'book', lapses: 2 }]);
  assert.equal(twice[0].code, 'forgotten_vocabulary');
  assert.equal(twice[0].severity, 'medium');

  const often = forgottenInsights([{ word_id: 3, word: 'water', lapses: 5 }]);
  assert.equal(often[0].severity, 'high', 'lapsing five times outranks everything else');
});

test('a hard question and a slow question are different findings', () => {
  const hard = buildInsights({
    behavior: calmBehavior,
    vocabulary: [],
    questions: [question({ accuracy: 0.2, avg_response_ms: 2000 })],
    exercises: [],
    lessons: [],
    competition: noCompetition,
    contentFlags: [],
    lapsed: [],
  });
  assert.ok(hard.some((insight) => insight.code === 'hard_question'));
  assert.equal(hard.some((insight) => insight.code === 'slow_question'), false);

  const slow = buildInsights({
    behavior: calmBehavior,
    vocabulary: [],
    // Answered correctly but agonised over: a fluency problem, not a knowledge gap.
    questions: [question({ accuracy: 1, avg_response_ms: 32_000 })],
    exercises: [],
    lessons: [],
    competition: noCompetition,
    contentFlags: [],
    lapsed: [],
  });
  assert.ok(slow.some((insight) => insight.code === 'slow_question'));
  assert.equal(slow.some((insight) => insight.code === 'hard_question'), false);
});

test('a question answered wrong three times is called out as a repeat mistake', () => {
  const repeats = repeatedMistakeInsights([
    question({ question_id: 4, attempts: 5, correct: 1, accuracy: 0.2 }),
    // Only one miss: not a repeat yet.
    question({ question_id: 5, attempts: 5, correct: 4, accuracy: 0.8 }),
  ]);
  assert.equal(repeats.length, 1);
  assert.equal(repeats[0].ref_id, 4);
  assert.equal(repeats[0].value, 4, 'the value is the number of misses');
  assert.equal(repeats[0].severity, 'medium');
});

test('abandoned and retried lessons are reported separately', () => {
  const abandoned = lessonInsights([
    lesson({ lesson_id: 7, title: 'Weather', status: 'in_progress', abandoned: true, answered_questions: 4 }),
  ]);
  assert.equal(abandoned[0].code, 'abandoned_lesson');
  assert.equal(abandoned[0].ref_id, 7);

  const retried = lessonInsights([lesson({ attempts: 3 })]);
  assert.equal(retried[0].code, 'retry_lesson');
  assert.equal(retried[0].value, 3);

  // Finished first try: nothing to report.
  assert.deepEqual(lessonInsights([lesson({ attempts: 1 })]), []);
});

test('a trend needs both volume and a real change to be worth mentioning', () => {
  const drop = behaviorInsights({ ...calmBehavior, accuracy_30: 0.6, accuracy_prev_30: 0.85 });
  assert.equal(drop[0].code, 'accuracy_drop');
  assert.equal(drop[0].label, '85% → 60%');

  const gain = behaviorInsights({ ...calmBehavior, accuracy_30: 0.9, accuracy_prev_30: 0.6 });
  assert.equal(gain[0].code, 'accuracy_gain');

  // A 2-point wobble is noise.
  assert.deepEqual(behaviorInsights({ ...calmBehavior, accuracy_30: 0.81, accuracy_prev_30: 0.8 }), []);

  // Too few answers to compare.
  assert.deepEqual(
    behaviorInsights({ ...calmBehavior, answers_30: 4, accuracy_30: 0.2, accuracy_prev_30: 0.9 }),
    [],
  );
});

test('a learner active on one day is told about consistency, not accuracy', () => {
  const insights = behaviorInsights({ ...calmBehavior, active_days_30: 1 });
  assert.equal(insights[0].code, 'inactive');

  // Someone who never answered anything is not "inactive": they are new.
  assert.deepEqual(behaviorInsights({ ...calmBehavior, active_days_30: 0, answers_30: 0 }), []);
});

test('duel accuracy needs a real sample before it is judged', () => {
  const thin: CompetitionStats = { ...noCompetition, matches: 2, answers: 4, accuracy: 0.2 };
  assert.deepEqual(duelInsights(thin), []);

  const poor: CompetitionStats = { ...noCompetition, matches: 6, answers: 30, accuracy: 0.35 };
  assert.equal(duelInsights(poor)[0].code, 'duel_accuracy');

  const fine: CompetitionStats = { ...noCompetition, matches: 6, answers: 30, accuracy: 0.7 };
  assert.deepEqual(duelInsights(fine), []);
});

test('content problems are attributed to the item, not the learner', () => {
  const flags: ContentFlag[] = [
    {
      question_id: 9,
      prompt: 'Chọn đáp án đúng',
      lesson_title: 'Transport',
      kind: 'no_correct_answer',
      attempts: 12,
      correct: 0,
      accuracy: 0,
    },
    {
      question_id: 11,
      prompt: 'Điền từ còn thiếu',
      lesson_title: 'Transport',
      kind: 'too_many_learners_wrong',
      attempts: 20,
      correct: 1,
      accuracy: 0.05,
    },
  ];
  const insights = contentInsights(flags);
  assert.equal(insights[0].code, 'content_missing_answer');
  assert.equal(insights[1].code, 'content_error');
  assert.equal(insights[1].ref_id, 11);
});

test('insights are ordered so the most severe gap is shown first', () => {
  const insights = buildInsights({
    behavior: { ...calmBehavior, accuracy_30: 0.5, accuracy_prev_30: 0.8 },
    vocabulary: [vocabulary({ attempts: 6, correct: 0, accuracy: 0 })],
    questions: [question()],
    exercises: [
      { question_type: 'listen_choice', attempts: 10, correct: 5, accuracy: 0.5, avg_response_ms: 3000 },
    ],
    lessons: [lesson({ attempts: 3 })],
    competition: { ...noCompetition, matches: 6, answers: 30, accuracy: 0.3 },
    contentFlags: [],
    lapsed: [],
  });

  assert.ok(insights.length >= 5);
  const severities = insights.map((insight) => insight.severity);
  const rank = { high: 0, medium: 1, low: 2 } as const;
  for (let i = 1; i < severities.length; i += 1) {
    assert.ok(
      rank[severities[i]] >= rank[severities[i - 1]],
      `insight ${i} (${severities[i]}) must not outrank ${severities[i - 1]}`,
    );
  }
  assert.equal(insights[0].severity, 'high', 'the zero-accuracy word leads');
});

test('an empty history produces no insights at all', () => {
  const insights = buildInsights({
    behavior: {
      streak: 0,
      active_days_30: 0,
      answers_30: 0,
      accuracy_30: null,
      accuracy_prev_30: null,
      study_minutes_30: 0,
      daily: [],
    },
    vocabulary: [],
    questions: [],
    exercises: [] as ExerciseStat[],
    lessons: [lesson({ status: 'not_started', answered_questions: 0, attempts: 0, accuracy: null })],
    competition: noCompetition,
    contentFlags: [],
    lapsed: [],
  });
  assert.deepEqual(insights, [], 'a brand-new learner must not be told they are failing');
});
