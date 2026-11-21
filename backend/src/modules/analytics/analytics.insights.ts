// Pure functions over already-fetched rows; the ordering below is the product decision.

import type {
  BehaviorStats,
  CompetitionStats,
  ContentFlag,
  ExerciseStat,
  Insight,
  InsightSeverity,
  LessonStat,
  QuestionStat,
  VocabularyStat,
} from './analytics.types';

/** Below this many attempts a ratio is noise, not a weakness. */
const MIN_ATTEMPTS_TOPIC = 5;
const MIN_ATTEMPTS_VOCAB = 3;
const MIN_ATTEMPTS_QUESTION = 3;
const MIN_ATTEMPTS_EXERCISE = 5;
const WEAK_ACCURACY = 0.6;
const HARD_ACCURACY = 0.4;
const SLOW_RESPONSE_MS = 15_000;
const TREND_MIN_ATTEMPTS = 20;
const TREND_DELTA = 0.1;

export interface LapsedWord {
  word_id: number;
  word: string;
  lapses: number;
}

export interface InsightInput {
  behavior: Pick<
    BehaviorStats,
    'accuracy_30' | 'accuracy_prev_30' | 'answers_30' | 'active_days_30'
  >;
  vocabulary: VocabularyStat[];
  questions: QuestionStat[];
  exercises: ExerciseStat[];
  lessons: LessonStat[];
  competition: CompetitionStats;
  contentFlags: ContentFlag[];
  lapsed: LapsedWord[];
}

function severityFor(accuracy: number): InsightSeverity {
  if (accuracy <= 0.3) return 'high';
  if (accuracy <= 0.5) return 'medium';
  return 'low';
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function topicInsights(questions: QuestionStat[]): Insight[] {
  const byTopic = new Map<string, { attempts: number; correct: number }>();
  for (const question of questions) {
    const entry = byTopic.get(question.topic) ?? { attempts: 0, correct: 0 };
    entry.attempts += question.attempts;
    entry.correct += question.correct;
    byTopic.set(question.topic, entry);
  }

  const insights: Insight[] = [];
  for (const [topic, entry] of byTopic) {
    if (entry.attempts < MIN_ATTEMPTS_TOPIC) continue;
    const accuracy = entry.correct / entry.attempts;
    if (accuracy >= WEAK_ACCURACY) continue;
    insights.push({
      code: 'weak_topic',
      severity: severityFor(accuracy),
      label: topic,
      value: accuracy,
      ref_id: null,
    });
  }
  return insights;
}

export function vocabularyInsights(vocabulary: VocabularyStat[]): Insight[] {
  const insights: Insight[] = [];
  for (const word of vocabulary) {
    if (word.attempts < MIN_ATTEMPTS_VOCAB) continue;
    if (word.accuracy >= WEAK_ACCURACY) continue;
    insights.push({
      code: 'weak_vocabulary',
      severity: severityFor(word.accuracy),
      label: word.word,
      value: word.accuracy,
      ref_id: word.word_id,
    });
  }
  return insights;
}

export function questionInsights(questions: QuestionStat[]): Insight[] {
  const insights: Insight[] = [];
  for (const question of questions) {
    if (question.attempts >= MIN_ATTEMPTS_QUESTION && question.accuracy <= HARD_ACCURACY) {
      insights.push({
        code: 'hard_question',
        severity: severityFor(question.accuracy),
        label: question.prompt,
        value: question.accuracy,
        ref_id: question.question_id,
      });
    }
    if (
      question.attempts >= MIN_ATTEMPTS_QUESTION
      && question.avg_response_ms !== null
      && question.avg_response_ms >= SLOW_RESPONSE_MS
    ) {
      insights.push({
        code: 'slow_question',
        severity: question.avg_response_ms >= SLOW_RESPONSE_MS * 2 ? 'medium' : 'low',
        label: question.prompt,
        value: question.avg_response_ms,
        ref_id: question.question_id,
      });
    }
  }
  return insights;
}

export function exerciseInsights(exercises: ExerciseStat[]): Insight[] {
  const insights: Insight[] = [];
  for (const exercise of exercises) {
    if (exercise.attempts < MIN_ATTEMPTS_EXERCISE) continue;
    if (exercise.accuracy >= WEAK_ACCURACY) continue;
    insights.push({
      code: 'weak_exercise',
      severity: severityFor(exercise.accuracy),
      label: exercise.question_type,
      value: exercise.accuracy,
      ref_id: null,
    });
  }
  return insights;
}

export function lessonInsights(lessons: LessonStat[]): Insight[] {
  const insights: Insight[] = [];
  for (const lesson of lessons) {
    if (lesson.abandoned) {
      insights.push({
        code: 'abandoned_lesson',
        severity: 'medium',
        label: lesson.title,
        value: lesson.answered_questions / Math.max(1, lesson.total_questions),
        ref_id: lesson.lesson_id,
      });
    }
    if (lesson.status === 'completed' && lesson.attempts >= 2) {
      insights.push({
        code: 'retry_lesson',
        severity: lesson.attempts >= 4 ? 'medium' : 'low',
        label: lesson.title,
        value: lesson.attempts,
        ref_id: lesson.lesson_id,
      });
    }
  }
  return insights;
}

export function behaviorInsights(
  behavior: Pick<BehaviorStats, 'accuracy_30' | 'accuracy_prev_30' | 'answers_30' | 'active_days_30'>,
): Insight[] {
  const insights: Insight[] = [];
  const { accuracy_30: current, accuracy_prev_30: previous } = behavior;

  if (
    current !== null
    && previous !== null
    && behavior.answers_30 >= TREND_MIN_ATTEMPTS
    && Math.abs(current - previous) >= TREND_DELTA
  ) {
    const improved = current > previous;
    insights.push({
      code: improved ? 'accuracy_gain' : 'accuracy_drop',
      severity: improved ? 'low' : 'medium',
      label: `${percent(previous)} → ${percent(current)}`,
      value: current - previous,
      ref_id: null,
    });
  }

  if (behavior.active_days_30 <= 1 && behavior.answers_30 > 0) {
    insights.push({
      code: 'inactive',
      severity: 'low',
      label: String(behavior.active_days_30),
      value: behavior.active_days_30,
      ref_id: null,
    });
  }
  return insights;
}

export function forgottenInsights(lapsed: LapsedWord[]): Insight[] {
  return lapsed
    .filter((word) => word.lapses >= 2)
    .map((word) => ({
      code: 'forgotten_vocabulary' as const,
      severity: word.lapses >= 4 ? 'high' as const : 'medium' as const,
      label: word.word,
      value: word.lapses,
      ref_id: word.word_id,
    }));
}

export function repeatedMistakeInsights(questions: QuestionStat[]): Insight[] {
  return questions
    .filter((question) => question.attempts - question.correct >= 3)
    .slice(0, 3)
    .map((question) => ({
      code: 'repeated_mistake' as const,
      severity: question.attempts - question.correct >= 5 ? 'high' as const : 'medium' as const,
      label: question.prompt,
      value: question.attempts - question.correct,
      ref_id: question.question_id,
    }));
}

export function duelInsights(competition: CompetitionStats): Insight[] {
  return competition.accuracy !== null
    && competition.answers >= 10
    && competition.accuracy < 0.5
    ? [{
        code: 'duel_accuracy' as const,
        severity: severityFor(competition.accuracy),
        label: String(competition.answers),
        value: competition.accuracy,
        ref_id: null,
      }]
    : [];
}

// Content flags are about the exercise, not the learner: a broken item must not
// be reported as the learner's weakness.
export function contentInsights(contentFlags: ContentFlag[]): Insight[] {
  return contentFlags.slice(0, 4).map((flag) => ({
    code: flag.kind === 'too_many_learners_wrong' ? 'content_error' as const : 'content_missing_answer' as const,
    severity: flag.kind === 'too_many_learners_wrong' ? 'medium' as const : 'low' as const,
    label: flag.prompt,
    value: flag.accuracy ?? 0,
    ref_id: flag.question_id,
  }));
}

const SEVERITY_RANK: Record<InsightSeverity, number> = { high: 0, medium: 1, low: 2 };

// Knowledge gaps first (they drive practice), then habit and trend, then content
// health, so a UI showing only the first few insights shows actionable ones.
export function buildInsights(input: InsightInput): Insight[] {
  return [
    ...vocabularyInsights(input.vocabulary),
    ...forgottenInsights(input.lapsed),
    ...topicInsights(input.questions),
    ...exerciseInsights(input.exercises),
    ...questionInsights(input.questions),
    ...repeatedMistakeInsights(input.questions),
    ...lessonInsights(input.lessons),
    ...duelInsights(input.competition),
    ...behaviorInsights(input.behavior),
    ...contentInsights(input.contentFlags),
  ].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
