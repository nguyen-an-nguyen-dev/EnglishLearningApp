import { HttpError } from '../../middleware/error-handler';
import * as repo from './learning.repository';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Given the user's full progress map and all lessons ordered globally,
 * compute the lock state of a specific lesson.
 *
 * Rules:
 *  - The very first lesson across all stages is always unlocked.
 *  - Any other lesson is unlocked iff its predecessor is completed.
 *  - A lesson is completed only when its stored score is 100%.
 */
function isPerfectlyCompleted(progress: { status: string; score: number | null }): boolean {
  return progress.status === 'completed' && Number(progress.score) === 100;
}

function computeLessonState(
  lessonId: number,
  firstLessonId: number,
  previousLessonId: number | undefined,
  completedLessonIds: Set<number>,
): LessonState {
  if (completedLessonIds.has(lessonId)) {
    return { status: 'completed', score: null };
  }
  if (lessonId === firstLessonId) {
    return { status: 'unlocked', score: null };
  }
  if (previousLessonId !== undefined && completedLessonIds.has(previousLessonId)) {
    return { status: 'unlocked', score: null };
  }
  return { status: 'locked', score: null };
}

// ─── Stages ───────────────────────────────────────────────────────────────────

export async function getStages(): Promise<Stage[]> {
  const rows = await repo.getAllStages();
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description,
    sort_order: r.sort_order,
  }));
}

export async function getStageById(stageId: number): Promise<Stage> {
  const row = await repo.getStageById(stageId);
  if (!row) throw new HttpError(404, 'Stage not found.');
  return { id: row.id, code: row.code, title: row.title, description: row.description, sort_order: row.sort_order };
}

// ─── Lessons ──────────────────────────────────────────────────────────────────

export async function getLessonsByStage(
  stageId: number,
  userId: number,
): Promise<Lesson[]> {
  const stage = await repo.getStageById(stageId);
  if (!stage) throw new HttpError(404, 'Stage not found.');

  const [lessonRows, progressRows, firstLesson] = await Promise.all([
    repo.getLessonsByStage(stageId),
    repo.getUserProgress(userId),
    repo.getFirstLesson(),
  ]);

  const completedIds = new Set(
    progressRows.filter(isPerfectlyCompleted).map((p) => p.lesson_id),
  );
  const firstLessonId = firstLesson?.id ?? 0;

  // For each lesson find its predecessor within this stage
  const lessons: Lesson[] = [];
  for (let i = 0; i < lessonRows.length; i++) {
    const l = lessonRows[i];
    const prevId = i === 0
      ? (await repo.getPreviousLesson(l.id))?.id
      : lessonRows[i - 1].id;

    const state = computeLessonState(l.id, firstLessonId, prevId, completedIds);
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

  const [progressRows, firstLesson, prevLesson] = await Promise.all([
    repo.getUserProgress(userId),
    repo.getFirstLesson(),
    repo.getPreviousLesson(lessonId),
  ]);

  const completedIds = new Set(
    progressRows.filter(isPerfectlyCompleted).map((p) => p.lesson_id),
  );

  const state = computeLessonState(lessonId, firstLesson?.id ?? 0, prevLesson?.id, completedIds);
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

// ─── Questions (for doing a lesson) ──────────────────────────────────────────

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

  // Group answers by question_id
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
    difficulty: q.difficulty,
    sort_order: q.sort_order,
    answers: answersMap.get(q.id) ?? [],
  }));
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export interface UserProgressResponse {
  completed_lesson_ids: number[];
  total_xp: number;
  stages: StageWithLessons[];
}

export async function getUserProgress(userId: number): Promise<UserProgressResponse> {
  const [stageRows, progressRows, firstLesson] = await Promise.all([
    repo.getAllStages(),
    repo.getUserProgress(userId),
    repo.getFirstLesson(),
  ]);

  const completedIds = new Set(
    progressRows.filter(isPerfectlyCompleted).map((p) => p.lesson_id),
  );

  const firstLessonId = firstLesson?.id ?? 0;
  const totalXp = progressRows.filter(isPerfectlyCompleted).length * 20;

  const stages: StageWithLessons[] = [];

  for (const stage of stageRows) {
    const lessonRows = await repo.getLessonsByStage(stage.id);
    const lessons: Lesson[] = [];

    for (let i = 0; i < lessonRows.length; i++) {
      const l = lessonRows[i];
      const prevId = i === 0
        ? (await repo.getPreviousLesson(l.id))?.id
        : lessonRows[i - 1].id;

      const state = computeLessonState(l.id, firstLessonId, prevId, completedIds);
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
      sort_order: stage.sort_order,
      lessons,
    });
  }

  return {
    completed_lesson_ids: Array.from(completedIds),
    total_xp: totalXp,
    stages,
  };
}

// ─── Completion ───────────────────────────────────────────────────────────────

/**
 * Normalize answer for fuzzy matching (fill_blank, translate, word_order).
 */
function normalizeAnswer(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,!?;:'"]/g, '');
}

/**
 * Check if a submitted answer is correct for a given question.
 * For MCQ: the submitted value should be the answer_id (as string).
 * For text types: fuzzy case-insensitive comparison.
 */
async function isAnswerCorrect(
  question: { id: number; question_type: string },
  submitted: SubmittedAnswer,
  answerRows: Array<{ id: number; question_id: number; answer_text: string; is_correct: boolean | 0 | 1 }>,
): Promise<boolean> {
  const qAnswers = answerRows.filter((a) => a.question_id === question.id);

  if (question.question_type === 'multiple_choice') {
    // submitted.answer should be the answer id as string, or the answer_text
    const submittedId = Number(submitted.answer);
    if (Number.isInteger(submittedId) && submittedId > 0) {
      const match = qAnswers.find((a) => a.id === submittedId);
      return match !== undefined && (match.is_correct === true || match.is_correct === 1);
    }
    // Fallback: match by text
    const match = qAnswers.find(
      (a) => normalizeAnswer(a.answer_text) === normalizeAnswer(submitted.answer),
    );
    return match !== undefined && (match.is_correct === true || match.is_correct === 1);
  }

  if (
    question.question_type === 'fill_blank' ||
    question.question_type === 'translate' ||
    question.question_type === 'word_order'
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
  const isCorrect = await isAnswerCorrect(question, submitted, answerRows);
  const correctAnswer = answerRows.find((answer) => answer.is_correct === true || answer.is_correct === 1);

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
  // 1. Verify lesson exists and is accessible
  const lesson = await getLessonDetail(lessonId, userId);
  if (lesson.state.status === 'locked') {
    throw new HttpError(403, 'This lesson is locked. Complete the previous lesson first.');
  }

  // 2. Load questions and answers
  const questionRows = await repo.getQuestionsByLesson(lessonId);
  const totalQuestions = questionRows.length;

  if (totalQuestions === 0) {
    throw new HttpError(400, 'This lesson has no questions.');
  }

  const questionIds = questionRows.map((q) => q.id);
  const answerRows = await repo.getAnswersByQuestions(questionIds);

  // 3. Validate submitted answer count
  const submittedMap = new Map(input.answers.map((a) => [a.questionId, a]));

  // 4. Calculate correct answers (backend is source of truth)
  let correctCount = 0;
  for (const question of questionRows) {
    const submitted = submittedMap.get(question.id);
    if (!submitted) continue; // No answer submitted = incorrect

    const correct = await isAnswerCorrect(question, submitted, answerRows as Array<{
      id: number;
      question_id: number;
      answer_text: string;
      is_correct: boolean | 0 | 1;
    }>);
    if (correct) correctCount++;
  }

  // 5. Calculate score (0-100)
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  if (correctCount !== totalQuestions) {
    return {
      score,
      correct_answers: correctCount,
      total_questions: totalQuestions,
      xp_earned: 0,
      lesson_status: 'retry',
      stage_completed: false,
    };
  }

  // 6. Persist with transaction (handles XP and duplicate completion)
  const previousStageLessons = await getLessonsByStage(lesson.stage_id, userId);
  const stageWasCompleted = previousStageLessons.length > 0
    && previousStageLessons.every((stageLesson) => stageLesson.state.status === 'completed');
  const result = await repo.completeLesson(userId, lessonId, correctCount, totalQuestions, score);
  const stageLessons = await getLessonsByStage(lesson.stage_id, userId);
  const stageCompleted = !stageWasCompleted
    && stageLessons.length > 0
    && stageLessons.every((stageLesson) => stageLesson.state.status === 'completed');

  return {
    score: result.score,
    correct_answers: result.correctAnswers,
    total_questions: result.totalQuestions,
    xp_earned: result.xpEarned,
    lesson_status: 'completed',
    stage_completed: stageCompleted,
  };
}
