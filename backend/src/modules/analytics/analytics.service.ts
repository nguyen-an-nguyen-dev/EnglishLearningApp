import type { AnalyticsResponse } from './analytics.types';
import * as repo from './analytics.repository';
import { listLapsedWords } from './review.repository';
import { buildInsights } from './analytics.insights';

/**
 * Everything the learner's own history can say, assembled in one pass.
 *
 * All the ranking rules live in `analytics.insights` (pure, testable); this
 * function only fetches and hands the rows over.
 */
export async function getAnalytics(userId: number): Promise<AnalyticsResponse> {
  const [behavior, totals, vocabulary, questions, exercises, lessons, competition, contentFlags, lapsed] =
    await Promise.all([
      repo.getBehavior(userId),
      repo.getTotals(userId),
      repo.getVocabulary(userId),
      repo.getQuestionStats(userId),
      repo.getExerciseStats(userId),
      repo.getLessonStats(userId),
      repo.getCompetition(userId),
      repo.getContentFlags(),
      listLapsedWords(userId),
    ]);

  const insights = buildInsights({
    behavior,
    vocabulary,
    questions,
    exercises,
    lessons,
    competition,
    contentFlags,
    lapsed,
  });

  return {
    behavior,
    totals,
    vocabulary,
    questions,
    exercises,
    lessons,
    competition,
    insights,
    content_flags: contentFlags,
    generated_at: new Date().toISOString(),
  };
}
