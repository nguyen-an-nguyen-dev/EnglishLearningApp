import { alignWords } from '../speech/speech.practice';
import { MAX_TRANSCRIPT_CHARS } from '../speech/speech.validation';
import { HttpError } from '../../middleware/error-handler';
import { env } from '../../config/env';
import { enqueue as enqueueReviewItem } from '../analytics/review.repository';
import * as repo from './learning.repository';
import * as gamificationRepo from '../gamification/gamification.repository';
import { levelForXp } from '../gamification/gamification.levels';
import type {
  Answer,
  CheckAnswerInput,
  CheckAnswerResult,
  CompleteLessonInput,
  CompleteLessonResult,
  Lesson,
  LessonState,
  Question,
  Stage,
  StageWithLessons,
  SubmittedAnswer,
} from './learning.types';

function isPerfectlyCompleted(progress: { status: string; score: number | null }): boolean {
  return progress.status === 'completed' && Number(progress.score) === 100;
}

/**
 * The roadmap is a single ordered line of lessons, so gating has to follow the
 * learner's *frontier* — the slot right after the furthest lesson they finished
 * — instead of each lesson's immediate predecessor.
 *
 * The predecessor rule broke as soon as an admin inserted a lesson into an old
 * stage: the inserted lesson had no completed predecessor, so every lesson after
 * it locked, and a learner who was on stage 5 suddenly lost the road ahead.
 *
 * With the frontier rule:
 * - lessons past the frontier stay locked (nobody skips ahead),
 * - the lesson exactly on the frontier is the single `unlocked` one,
 * - lessons behind the frontier that are still unplayed stay `available`, so
 *   newly inserted content is open catch-up work and never re-locks anything.
 */
export function buildLessonStates(
  orderedLessonIds: number[],
  completedLessonIds: Set<number>,
): Map<number, LessonState> {
  let frontier = 0;
  orderedLessonIds.forEach((lessonId, index) => {
    if (completedLessonIds.has(lessonId)) frontier = Math.max(frontier, index + 1);
  });

  const states = new Map<number, LessonState>();
  orderedLessonIds.forEach((lessonId, index) => {
    if (completedLessonIds.has(lessonId)) {
      states.set(lessonId, { status: 'completed', score: null });
    } else if (index === frontier) {
      states.set(lessonId, { status: 'unlocked', score: null });
    } else if (index < frontier) {
      states.set(lessonId, { status: 'available', score: null });
    } else {
      states.set(lessonId, { status: 'locked', score: null });
    }
  });
  return states;
}

/** Reads the curriculum order and the learner's completions in one go. */
async function loadLessonStates(userId: number): Promise<Map<number, LessonState>> {
  const [orderedIds, progressRows] = await Promise.all([
    repo.getOrderedLessonIds(),
    repo.getUserProgress(userId),
  ]);
  const completedIds = new Set(
    progressRows.filter(isPerfectlyCompleted).map((p) => p.lesson_id),
  );
  return buildLessonStates(orderedIds, completedIds);
}

export async function getStages(): Promise<Stage[]> {
  const rows = await repo.getAllStages();
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description,
    theme_key: r.theme_key,
    accent_color: r.accent_color,
    sort_order: r.sort_order,
    lesson_count: Number(r.lesson_count),
    question_count: Number(r.question_count),
  }));
}

export async function getStageById(stageId: number): Promise<Stage> {
  const row = await repo.getStageById(stageId);
  if (!row) throw new HttpError(404, 'Stage not found.');
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    theme_key: row.theme_key,
    accent_color: row.accent_color,
    sort_order: row.sort_order,
    lesson_count: Number(row.lesson_count),
    question_count: Number(row.question_count),
  };
}

export async function getLessonsByStage(
  stageId: number,
  userId: number,
): Promise<Lesson[]> {
  const stage = await repo.getStageById(stageId);
  if (!stage) throw new HttpError(404, 'Stage not found.');

  const [lessonRows, states] = await Promise.all([
    repo.getLessonsByStage(stageId),
    loadLessonStates(userId),
  ]);

  const lessons: Lesson[] = [];
  for (const l of lessonRows) {
    const state = states.get(l.id) ?? { status: 'locked' as const, score: null };
    const totalQ = await repo.countQuestionsByLesson(l.id);

    lessons.push({
      id: l.id,
      stage_id: l.stage_id,
      code: l.code,
      title: l.title,
      topic: l.topic,
      sort_order: l.sort_order,
      state,
      total_questions: totalQ,
    });
  }

  return lessons;
}

export async function getLessonDetail(lessonId: number, userId: number): Promise<Lesson> {
  const lessonRow = await repo.getLessonById(lessonId);
  if (!lessonRow) throw new HttpError(404, 'Lesson not found.');

  const states = await loadLessonStates(userId);

  const state = states.get(lessonId) ?? { status: 'locked' as const, score: null };
  const totalQ = await repo.countQuestionsByLesson(lessonId);

  return {
    id: lessonRow.id,
    stage_id: lessonRow.stage_id,
    code: lessonRow.code,
    title: lessonRow.title,
    topic: lessonRow.topic,
    sort_order: lessonRow.sort_order,
    state,
    total_questions: totalQ,
  };
}

export function resolveAudioUrl(
  audioUrl: string | null,
  questionType: string,
  projectUrl = env.supabaseUrl,
  bucket = env.supabaseBucket,
): string | null {
  if (
    !audioUrl ||
    /^https?:\/\//i.test(audioUrl) ||
    (questionType !== 'listening' && questionType !== 'listen_choice' && questionType !== 'speaking')
  ) {
    return audioUrl;
  }

  if (!projectUrl || !bucket) {
    throw new HttpError(500, 'Supabase storage is not configured for listening questions.');
  }

  const objectPath = audioUrl
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  return `${projectUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath}`;
}

export async function getLessonQuestions(
  lessonId: number,
  userId: number,
): Promise<Question[]> {
  const lesson = await getLessonDetail(lessonId, userId);

  // Backend enforces: locked lessons cannot be loaded for answering
  if (lesson.state.status === 'locked') {
    throw new HttpError(403, 'This lesson is locked. Complete the previous lesson first.');
  }

  const questionRows = await repo.getQuestionsByLesson(lessonId);
  if (questionRows.length === 0) return [];

  const questionIds = questionRows.map((q) => q.id);
  const answerRows = await repo.getAnswersByQuestions(questionIds);

  const answersMap = new Map<number, Answer[]>();
  for (const a of answerRows) {
    const list = answersMap.get(a.question_id) ?? [];
    list.push({ id: a.id, answer_text: a.answer_text, sort_order: a.sort_order });
    answersMap.set(a.question_id, list);
  }

  return questionRows.map((q): Question => ({
    id: q.id,
    question_text: q.question_text,
    question_type: q.question_type,
    explanation: q.explanation,
    audio_url: resolveAudioUrl(q.audio_url, q.question_type),
    word_bank: Array.isArray(q.word_bank)
      ? q.word_bank
      : typeof q.word_bank === 'string'
        ? JSON.parse(q.word_bank) as string[]
        : [],
    difficulty: q.difficulty,
    sort_order: q.sort_order,
    answers: q.question_type === 'listening' || q.question_type === 'speaking' ? [] : answersMap.get(q.id) ?? [],
  }));
}

interface BalanceLike {
  xp: number;
  coins: number;
  streak: number;
}

/** Read the single source of XP/coin/streak without importing the economy service. */
async function fetchBalance(userId: number): Promise<BalanceLike | undefined> {
  return gamificationRepo.getBalance(userId);
}

export interface UserProgressResponse {
  completed_lesson_ids: number[];
  total_xp: number;
  coins: number;
  level: number;
  streak: number;
  stages: StageWithLessons[];
}

export async function getUserProgress(userId: number): Promise<UserProgressResponse> {
  const [stageRows, orderedIds, progressRows, balance] = await Promise.all([
    repo.getAllStages(),
    repo.getOrderedLessonIds(),
    repo.getUserProgress(userId),
    fetchBalance(userId),
  ]);

  const completedIds = new Set(
    progressRows.filter(isPerfectlyCompleted).map((p) => p.lesson_id),
  );
  const states = buildLessonStates(orderedIds, completedIds);

  const totalXp = Number(balance?.xp ?? 0);

  const stages: StageWithLessons[] = [];

  for (const stage of stageRows) {
    const lessonRows = await repo.getLessonsByStage(stage.id);
    const lessons: Lesson[] = [];

    for (const l of lessonRows) {
      const state = states.get(l.id) ?? { status: 'locked' as const, score: null };
      const totalQ = await repo.countQuestionsByLesson(l.id);

      lessons.push({
        id: l.id,
        stage_id: l.stage_id,
        code: l.code,
        title: l.title,
        topic: l.topic,
        sort_order: l.sort_order,
        state,
        total_questions: totalQ,
      });
    }

    stages.push({
      id: stage.id,
      code: stage.code,
      title: stage.title,
      description: stage.description,
      theme_key: stage.theme_key,
      accent_color: stage.accent_color,
      sort_order: stage.sort_order,
      lesson_count: Number(stage.lesson_count),
      question_count: Number(stage.question_count),
      lessons,
    });
  }

  return {
    completed_lesson_ids: Array.from(completedIds),
    total_xp: totalXp,
    coins: Number(balance?.coins ?? 0),
    level: levelForXp(totalXp),
    streak: Number(balance?.streak ?? 0),
    stages,
  };
}

function normalizeAnswer(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,!?;:'"]/g, '');
}

// For MCQ the submitted value is the answer_id as string; for text types it is a
// fuzzy case-insensitive comparison.
export function isAnswerCorrect(
  question: { id: number; question_type: string },
  submitted: SubmittedAnswer,
  answerRows: Array<{ id: number; question_id: number; answer_text: string; is_correct: boolean | 0 | 1 }>,
): boolean {
  const qAnswers = answerRows.filter((a) => a.question_id === question.id);

  if (
    question.question_type === 'multiple_choice' ||
    question.question_type === 'fill_choice' ||
    question.question_type === 'listen_choice'
  ) {
    // submitted.answer should be the answer id as string, or the answer_text
    const submittedId = Number(submitted.answer);
    if (Number.isInteger(submittedId) && submittedId > 0) {
      const match = qAnswers.find((a) => a.id === submittedId);
      return match !== undefined && (match.is_correct === true || match.is_correct === 1);
    }
    const match = qAnswers.find(
      (a) => normalizeAnswer(a.answer_text) === normalizeAnswer(submitted.answer),
    );
    return match !== undefined && (match.is_correct === true || match.is_correct === 1);
  }

  if (question.question_type === 'speaking') {
    const expected = qAnswers.find((answer) => answer.is_correct === true || answer.is_correct === 1);
    if (!expected || submitted.answer.length > MAX_TRANSCRIPT_CHARS) return false;
    const { matched, total } = alignWords(expected.answer_text, submitted.answer);
    return total > 0 && (total <= 3 ? matched === total : matched * 5 >= total * 4);
  }

  if (
    question.question_type === 'fill_blank' ||
    question.question_type === 'translate' ||
    question.question_type === 'word_order' ||
    question.question_type === 'listening'
  ) {
    const correctAnswer = qAnswers.find((a) => a.is_correct === true || a.is_correct === 1);
    if (!correctAnswer) return false;
    return normalizeAnswer(submitted.answer) === normalizeAnswer(correctAnswer.answer_text);
  }

  return false;
}

export async function checkLessonAnswer(
  lessonId: number,
  questionId: number,
  userId: number,
  input: CheckAnswerInput,
): Promise<CheckAnswerResult> {
  const lesson = await getLessonDetail(lessonId, userId);
  if (lesson.state.status === 'locked') {
    throw new HttpError(403, 'This lesson is locked. Complete the previous lesson first.');
  }

  const question = (await repo.getQuestionsByLesson(lessonId)).find((row) => row.id === questionId);
  if (!question) throw new HttpError(404, 'Question not found in this lesson.');

  const answerRows = await repo.getAnswersByQuestions([questionId]);
  const submitted = { questionId, answer: input.answer };
  const isCorrect = isAnswerCorrect(question, submitted, answerRows);
  const correctAnswer = answerRows.find((answer) => answer.is_correct === true || answer.is_correct === 1);

  if (question.question_type !== 'speaking') {
    await repo.recordAnswerAttempt(userId, questionId, input.answer, isCorrect, input.responseMs ?? null);
  }

  // A missed question joins the review queue right away. The queue is the
  // learner's own practice space; the roadmap itself is never touched.
  if (!isCorrect && question.question_type !== 'speaking') {
    await enqueueReviewItem(userId, 'question', questionId, 'mistake').catch(() => {
      /* review scheduling must never fail the answer check */
    });
  }

  return {
    is_correct: isCorrect,
    correct_answer: correctAnswer?.answer_text ?? '',
    meaning_vi: question.explanation,
  };
}

export async function completeLesson(
  lessonId: number,
  userId: number,
  input: CompleteLessonInput,
): Promise<CompleteLessonResult> {
  const lesson = await getLessonDetail(lessonId, userId);
  if (lesson.state.status === 'locked') {
    throw new HttpError(403, 'This lesson is locked. Complete the previous lesson first.');
  }

  const questionRows = await repo.getQuestionsByLesson(lessonId);
  const totalQuestions = questionRows.length;

  if (totalQuestions === 0) {
    throw new HttpError(400, 'This lesson has no questions.');
  }

  const questionIds = questionRows.map((q) => q.id);
  const answerRows = await repo.getAnswersByQuestions(questionIds);

  const submittedMap = new Map(input.answers.map((a) => [a.questionId, a]));

  // The backend is the source of truth for correctness.
  let correctCount = 0;
  for (const question of questionRows) {
    const submitted = submittedMap.get(question.id);
    if (!submitted) continue;

    const correct = isAnswerCorrect(question, submitted, answerRows as Array<{
      id: number;
      question_id: number;
      answer_text: string;
      is_correct: boolean | 0 | 1;
    }>);
    if (correct) correctCount++;
  }

  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  if (correctCount !== totalQuestions) {
    return {
      score,
      correct_answers: correctCount,
      total_questions: totalQuestions,
      xp_earned: 0,
      rc_earned: 0,
      is_first_completion: false,
      lesson_status: 'retry',
      stage_completed: false,
      stage_reward: null,
      level_before: 0,
      level_after: 0,
      badges_awarded: [],
    };
  }

  // XP, RC, the stage bonus, badges, the streak and the weekly standing are all
  // written in one transaction. The first completion pays full rewards; a
  // replay pays half XP and cannot claim the one-time lesson/stage rewards.
  const result = await repo.completeLesson(
    userId,
    lessonId,
    correctCount,
    totalQuestions,
    score,
    input.practiceSeconds ?? null,
  );

  return {
    score: result.score,
    correct_answers: result.correctAnswers,
    total_questions: result.totalQuestions,
    xp_earned: result.xpEarned,
    rc_earned: result.rcEarned,
    is_first_completion: result.isFirstCompletion,
    lesson_status: 'completed',
    stage_completed: result.stageCompleted,
    stage_reward: result.stageReward,
    level_before: result.levelBefore,
    level_after: result.levelAfter,
    badges_awarded: result.badgesAwarded,
  };
}
