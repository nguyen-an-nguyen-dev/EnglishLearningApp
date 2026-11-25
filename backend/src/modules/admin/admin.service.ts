import { HttpError } from '../../middleware/error-handler';
import * as videoRepo from '../video/video.repository';
import { refineSegmentsWithAi } from '../video/video.segmentation';
import {
  canonicalYouTubeUrl,
  extractYouTubeId,
  fetchYouTubeImportSource,
  videoCodeForShared,
} from '../video/video.youtube';
import * as repo from './admin.repository';
import {
  nextAvailableCode,
  type QuestionPatchInput,
} from './admin.validation';
import {
  THEME_ACCENTS,
  type AdminAnswerRow,
  type AdminLessonRow,
  type AdminLessonSummary,
  type AdminQuestion,
  type AdminQuestionRow,
  type AdminSharedVideo,
  type AdminSharedVideoRow,
  type AdminVideoSegment,
  type SharedVideoSegmentInput,
  type AdminStage,
  type AdminStageRow,
  type LessonInput,
  type LessonPatch,
  type MoveDirection,
  type QuestionInput,
  type SharedVideoImportInput,
  type SharedVideoPatch,
  type StagePatch,
} from './admin.types';
import { isDuplicateKeyError } from '../../utils/db-errors';

export const DEFAULT_SHARED_TOPIC = 'Thư viện chung';
export const SHARED_VIDEO_XP = 20;

function isRoadmapStage(code: string): boolean {
  return /^stage-[1-6]$/.test(code);
}

function mapLesson(row: AdminLessonRow): AdminLessonSummary {
  return {
    id: row.id,
    stage_id: row.stage_id,
    code: row.code,
    title: row.title,
    topic: row.topic,
    sort_order: Number(row.sort_order),
    question_count: Number(row.question_count),
  };
}

function mapStage(row: AdminStageRow, lessons: AdminLessonSummary[]): AdminStage {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    theme_key: row.theme_key,
    accent_color: row.accent_color,
    sort_order: Number(row.sort_order),
    lesson_count: Number(row.lesson_count),
    question_count: Number(row.question_count),
    lessons,
  };
}

function parseWordBank(raw: AdminQuestionRow['word_bank']): string[] {
  if (Array.isArray(raw)) return raw.filter((entry): entry is string => typeof entry === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === 'string')
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapQuestion(row: AdminQuestionRow, answers: AdminAnswerRow[]): AdminQuestion {
  return {
    id: row.id,
    lesson_id: row.lesson_id,
    question_text: row.question_text,
    question_type: row.question_type,
    explanation: row.explanation,
    audio_url: row.audio_url,
    word_bank: parseWordBank(row.word_bank),
    difficulty: row.difficulty,
    sort_order: Number(row.sort_order),
    answers: answers
      .filter((answer) => answer.question_id === row.id)
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
      .map((answer) => ({
        id: answer.id,
        answer_text: answer.answer_text,
        is_correct: answer.is_correct === true || answer.is_correct === 1,
        sort_order: Number(answer.sort_order),
      })),
  };
}

function mapSharedVideo(row: AdminSharedVideoRow): AdminSharedVideo {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    topic: row.topic,
    cefr_level: row.cefr_level,
    provider: row.provider,
    video_url: row.video_url,
    thumbnail_url: row.thumbnail_url,
    duration_seconds: Number(row.duration_seconds),
    xp_reward: Number(row.xp_reward),
    sort_order: Number(row.sort_order),
    segment_count: Number(row.segment_count),
    created_at: new Date(row.created_at).toISOString(),
    published_at: row.published_at ? new Date(row.published_at).toISOString() : null,
  };
}

function mapAdminSegment(row: Awaited<ReturnType<typeof videoRepo.getSegmentsByVideo>>[number]): AdminVideoSegment {
  return {
    id: row.id,
    start_ms: Number(row.start_ms),
    end_ms: Number(row.end_ms),
    text_en: row.text_en,
    text_vi: row.text_vi,
  };
}

export async function getContent(): Promise<AdminStage[]> {
  const [stageRows, lessonRows] = await Promise.all([
    repo.getStageRows(),
    repo.getLessonRows(),
  ]);
  const lessonsByStage = new Map<number, AdminLessonSummary[]>();
  for (const row of lessonRows) {
    const list = lessonsByStage.get(row.stage_id) ?? [];
    list.push(mapLesson(row));
    lessonsByStage.set(row.stage_id, list);
  }
  return stageRows.map((row) => mapStage(row, lessonsByStage.get(row.id) ?? []));
}

export async function getStageDetail(stageId: number): Promise<AdminStage> {
  const [stageRow, lessonRows] = await Promise.all([
    repo.getStageRow(stageId),
    repo.getLessonRows(),
  ]);
  if (!stageRow) throw new HttpError(404, 'Stage not found.');
  return mapStage(
    stageRow,
    lessonRows.filter((row) => row.stage_id === stageId).map(mapLesson),
  );
}

export async function getLessonQuestions(lessonId: number): Promise<AdminQuestion[]> {
  const lesson = await repo.getLessonRow(lessonId);
  if (!lesson) throw new HttpError(404, 'Lesson not found.');
  const questionRows = await repo.getQuestionRows(lessonId);
  const answers = await repo.getAnswerRows(questionRows.map((row) => row.id));
  return questionRows.map((row) => mapQuestion(row, answers));
}

export async function updateStage(stageId: number, patch: StagePatch): Promise<AdminStage> {
  const existing = await repo.getStageRow(stageId);
  if (!existing) throw new HttpError(404, 'Stage not found.');
  await repo.updateStage(stageId, {
    title: patch.title,
    description: patch.description,
    themeKey: patch.themeKey,
    accentColor: patch.themeKey ? THEME_ACCENTS[patch.themeKey] : undefined,
  });
  return getStageDetail(stageId);
}

export async function deleteStage(stageId: number): Promise<void> {
  const existing = await repo.getStageRow(stageId);
  if (!existing) throw new HttpError(404, 'Stage not found.');
  if (isRoadmapStage(existing.code)) {
    throw new HttpError(409, 'Đây là một trong sáu chặng cố định của lộ trình.', ['FIXED_ROADMAP_STAGES']);
  }
  const lessonCount = await repo.countLessonsByStage(stageId);
  if (lessonCount > 0) {
    throw new HttpError(
      409,
      'Xoá các bài học trong chặng này trước khi xoá chặng.',
      ['STAGE_NOT_EMPTY'],
    );
  }
  await repo.deleteStageRow(stageId);
}

export async function moveStage(stageId: number, direction: MoveDirection): Promise<void> {
  const moved = await repo.moveStage(stageId, direction);
  if (!moved) throw new HttpError(404, 'Stage not found.');
}

async function requireLessonStage(stageId: number): Promise<void> {
  const stage = await repo.getStageRow(stageId);
  if (!stage) throw new HttpError(404, 'Stage not found.');
  if (!isRoadmapStage(stage.code)) {
    throw new HttpError(409, 'Chọn một trong sáu chặng của lộ trình cho bài học này.', ['FIXED_ROADMAP_STAGES']);
  }
}

export async function createLesson(input: LessonInput): Promise<AdminLessonSummary> {
  await requireLessonStage(input.stageId);
  const code = nextAvailableCode(input.title, new Set(await repo.listLessonCodes()), 'bai');
  const sortOrder = await repo.nextLessonSortOrder(input.stageId);
  try {
    const lessonId = await repo.insertLesson({
      stageId: input.stageId,
      code,
      title: input.title,
      topic: input.topic,
      sortOrder,
    });
    const row = await repo.getLessonRow(lessonId);
    if (!row) throw new HttpError(500, 'Created lesson could not be loaded.');
    return mapLesson(row);
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new HttpError(409, 'Lesson code already exists.', ['CODE_TAKEN']);
    throw error;
  }
}

export async function updateLesson(lessonId: number, patch: LessonPatch): Promise<AdminLessonSummary> {
  const existing = await repo.getLessonRow(lessonId);
  if (!existing) throw new HttpError(404, 'Lesson not found.');

  let sortOrder: number | undefined;
  if (patch.stageId !== undefined && patch.stageId !== Number(existing.stage_id)) {
    await requireLessonStage(patch.stageId);
    sortOrder = await repo.nextLessonSortOrder(patch.stageId);
  }

  await repo.updateLesson(lessonId, {
    title: patch.title,
    topic: patch.topic,
    stageId: patch.stageId,
    sortOrder,
  });
  const row = await repo.getLessonRow(lessonId);
  if (!row) throw new HttpError(404, 'Lesson not found.');
  return mapLesson(row);
}

export async function deleteLesson(lessonId: number): Promise<void> {
  const deleted = await repo.deleteLessonTx(lessonId);
  if (!deleted) throw new HttpError(404, 'Lesson not found.');
}

export async function moveLesson(lessonId: number, direction: MoveDirection): Promise<void> {
  const moved = await repo.moveLesson(lessonId, direction);
  if (!moved) throw new HttpError(404, 'Lesson not found.');
}

export async function getQuestion(questionId: number): Promise<AdminQuestion> {
  const row = await repo.getQuestionRow(questionId);
  if (!row) throw new HttpError(404, 'Question not found.');
  const answers = await repo.getAnswerRows([questionId]);
  return mapQuestion(row, answers);
}

export async function createQuestion(lessonId: number, input: QuestionInput): Promise<AdminQuestion> {
  const lesson = await repo.getLessonRow(lessonId);
  if (!lesson) throw new HttpError(404, 'Lesson not found.');
  const sortOrder = await repo.nextQuestionSortOrder(lessonId);
  const questionId = await repo.insertQuestionTx(lessonId, {
    questionText: input.questionText,
    questionType: input.questionType,
    explanation: input.explanation,
    audioUrl: input.audioUrl,
    wordBank: input.wordBank,
    difficulty: input.difficulty,
    sortOrder,
    answers: input.answers,
  });
  return getQuestion(questionId);
}

export async function updateQuestion(
  questionId: number,
  patch: QuestionPatchInput,
): Promise<AdminQuestion> {
  const existing = await repo.getQuestionRow(questionId);
  if (!existing) throw new HttpError(404, 'Question not found.');

  const { answers, ...fields } = patch;
  await repo.updateQuestion(questionId, fields);
  if (answers) await repo.replaceAnswersTx(questionId, answers);
  return getQuestion(questionId);
}

export async function deleteQuestion(questionId: number): Promise<void> {
  const deleted = await repo.deleteQuestionTx(questionId);
  if (!deleted) throw new HttpError(404, 'Question not found.');
}

export async function moveQuestion(questionId: number, direction: MoveDirection): Promise<void> {
  const moved = await repo.moveQuestion(questionId, direction);
  if (!moved) throw new HttpError(404, 'Question not found.');
}

export async function listSharedVideos(): Promise<AdminSharedVideo[]> {
  const rows = await repo.getSharedVideoRows();
  return rows.map(mapSharedVideo);
}

export async function getSharedVideo(videoId: number): Promise<AdminSharedVideo> {
  const row = await repo.getSharedVideoRow(videoId);
  if (!row) throw new HttpError(404, 'Shared video not found.');
  return mapSharedVideo(row);
}

export async function importSharedVideo(
  input: SharedVideoImportInput,
): Promise<AdminSharedVideo> {
  const youtubeId = extractYouTubeId(input.url);
  if (!youtubeId) throw new HttpError(400, 'Enter a valid YouTube link.', ['INVALID_YOUTUBE_URL']);

  const code = videoCodeForShared(youtubeId);
  if (await videoRepo.findVideoByCode(code)) {
    throw new HttpError(409, 'Video này đã có trong thư viện chung.', ['VIDEO_ALREADY_IN_LIBRARY']);
  }

  const [source, sortOrder] = await Promise.all([
    fetchYouTubeImportSource(youtubeId),
    videoRepo.nextSharedSortOrder(),
  ]);
  const segments = await refineSegmentsWithAi(source.segments, source.aiCues);
  const subtitleEn = segments.map((segment) => segment.text).join(' ').slice(0, 500);

  let videoId: number;
  try {
    videoId = await videoRepo.insertVideoRow({
      code,
      title: source.title,
      description: source.description,
      topic: DEFAULT_SHARED_TOPIC,
      cefrLevel: 'B1',
      provider: 'youtube',
      videoUrl: canonicalYouTubeUrl(source.youtubeId),
      thumbnailUrl: source.thumbnailUrl,
      durationSeconds: source.durationSeconds,
      xpReward: SHARED_VIDEO_XP,
      sortOrder,
      ownerUserId: null,
      subtitleEn,
      published: false,
      segments,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, 'Video này đã có trong thư viện chung.', ['VIDEO_ALREADY_IN_LIBRARY']);
    }
    throw error;
  }

  return getSharedVideo(videoId);
}

export async function updateSharedVideo(
  videoId: number,
  patch: SharedVideoPatch,
): Promise<AdminSharedVideo> {
  const existing = await repo.getSharedVideoRow(videoId);
  if (!existing) throw new HttpError(404, 'Shared video not found.');
  await repo.updateSharedVideo(videoId, {
    title: patch.title,
    description: patch.description,
    topic: patch.topic,
    cefrLevel: patch.cefrLevel,
    xpReward: patch.xpReward,
  });
  return getSharedVideo(videoId);
}

// Segments are edited as one list: the whole list is validated and then replaces the stored rows.
export async function listSharedVideoSegments(
  videoId: number,
): Promise<{ video: AdminSharedVideo; segments: AdminVideoSegment[] }> {
  const video = await getSharedVideo(videoId);
  const rows = await videoRepo.getSegmentsByVideo(videoId);
  return { video, segments: rows.map(mapAdminSegment) };
}

export async function replaceSharedVideoSegments(
  videoId: number,
  segments: SharedVideoSegmentInput[],
): Promise<{ video: AdminSharedVideo; segments: AdminVideoSegment[] }> {
  const row = await repo.getSharedVideoRow(videoId);
  if (!row) throw new HttpError(404, 'Shared video not found.');

  // Allow one second of slack: YouTube durations are rounded.
  const durationMs = Number(row.duration_seconds) * 1000;
  if (durationMs > 0) {
    const overflow = segments.findIndex((segment) => segment.endMs > durationMs + 1000);
    if (overflow >= 0) {
      throw new HttpError(422, 'Validation failed', [`Câu ${overflow + 1}: vượt quá thời lượng video.`]);
    }
  }

  const subtitleEn = segments.map((segment) => segment.text).join(' ').slice(0, 500);
  await videoRepo.replaceSegments(videoId, segments, subtitleEn);
  return listSharedVideoSegments(videoId);
}

// Publishing needs at least one segment; a draft can always be taken back offline.
export async function setSharedVideoPublished(videoId: number, published: boolean): Promise<AdminSharedVideo> {
  const row = await repo.getSharedVideoRow(videoId);
  if (!row) throw new HttpError(404, 'Shared video not found.');
  if (published && Number(row.segment_count) === 0) {
    throw new HttpError(422, 'Video cần ít nhất một câu thoại trước khi xuất bản.', ['NO_SEGMENTS']);
  }
  await repo.setSharedVideoPublished(videoId, published);
  return getSharedVideo(videoId);
}

export async function deleteSharedVideo(videoId: number): Promise<void> {
  const deleted = await repo.deleteSharedVideoRow(videoId);
  if (!deleted) throw new HttpError(404, 'Shared video not found.');
}

export async function moveSharedVideo(videoId: number, direction: MoveDirection): Promise<void> {
  const moved = await repo.moveSharedVideo(videoId, direction);
  if (!moved) throw new HttpError(404, 'Shared video not found.');
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export async function getStatsOverview(): Promise<
  import('./admin.types').StatsOverview
> {
  const [
    totalLearners,
    totalAdmins,
    newToday,
    newYesterday,
    newThisWeek,
    newThisMonth,
    activeToday,
    activeYesterday,
    active7d,
    active30d,
    returningToday,
    neverActive,
    aggregates,
    lessons,
    videos,
    engagement,
  ] = await Promise.all([
    repo.countLearners(),
    repo.countAdmins(),
    repo.countNewUsers('today'),
    repo.countNewUsers('yesterday'),
    repo.countNewUsers('week'),
    repo.countNewUsers('month'),
    repo.countActiveOnDate(0),
    repo.countActiveOnDate(1),
    repo.countActiveWithin(7),
    repo.countActiveWithin(30),
    repo.countReturningToday(),
    repo.countNeverActive(),
    repo.getUserAggregates(),
    repo.getLessonAggregates(),
    repo.getVideoAggregates(),
    repo.getEngagementAggregates(),
  ]);

  const inactive7d = Math.max(0, totalLearners - active7d);
  const inactive14d = Math.max(0, totalLearners - (await repo.countActiveWithin(14)));
  const inactive30d = Math.max(0, totalLearners - active30d);
  const retentionTodayVsYesterdayPct =
    activeYesterday === 0 ? null : Math.round(((activeToday - activeYesterday) / activeYesterday) * 1000) / 10;

  return {
    totalLearners,
    totalAdmins,
    newToday,
    newYesterday,
    newThisWeek,
    newThisMonth,
    activeToday,
    activeYesterday,
    active7d,
    active30d,
    inactive7d,
    inactive14d,
    inactive30d,
    neverActive,
    returningToday,
    retentionTodayVsYesterdayPct,
    avgXp: Math.round(aggregates.avgXp * 10) / 10,
    totalXp: aggregates.totalXp,
    avgStreak: Math.round(aggregates.avgStreak * 10) / 10,
    maxStreak: aggregates.maxStreak,
    lessonsCompletedTotal: lessons.completed,
    lessonsInProgressActive: lessons.inProgress,
    lessonCompletionRatePct: pct(lessons.completed, lessons.totalProgressRows),
    videosSharedCount: videos.shared,
    videosCompletedTotal: videos.completed,
    videoCompletionRatePct: pct(videos.completed, videos.total),
    matchesTotal: engagement.matchesTotal,
    matchesToday: engagement.matchesToday,
    translationsTotal: engagement.translationsTotal,
    answersTotal: engagement.answersTotal,
    answerCorrectRatePct: pct(engagement.answersCorrect, engagement.answersTotal),
    savedWordsTotal: engagement.savedWordsTotal,
  };
}

export async function getActivityTrend(days = 14): Promise<
  import('./admin.types').DayTrend[]
> {
  const bounded = Math.min(30, Math.max(2, Math.floor(days)));
  const labels = await repo.getDayLabels(bounded);
  const trend: import('./admin.types').DayTrend[] = [];
  // labels are oldest -> newest; offsetDays is distance from today.
  for (let index = 0; index < labels.length; index += 1) {
    const offsetDays = labels.length - 1 - index;
    const [counts, activeUsers] = await Promise.all([
      repo.getDayCounts(offsetDays),
      repo.countActiveOnDate(offsetDays),
    ]);
    trend.push({ date: labels[index], activeUsers, ...counts });
  }
  return trend;
}

export async function getLessonStats(): Promise<
  import('./admin.types').LessonStat[]
> {
  const rows = await repo.getLessonStats();
  return rows.map((row) => ({
    lessonId: Number(row.lesson_id),
    stageId: Number(row.stage_id),
    stageTitle: row.stage_title,
    title: row.title,
    topic: row.topic,
    questionCount: Number(row.question_count),
    learnersStarted: Number(row.learners_started),
    completions: Number(row.completions),
    abandonRatePct:
      Number(row.learners_started) === 0
        ? 0
        : pct(
            Number(row.learners_started) - Number(row.completions),
            Number(row.learners_started),
          ),
    avgScore: row.avg_score === null ? null : Math.round(Number(row.avg_score) * 10) / 10,
  }));
}

export async function getStageStats(): Promise<
  import('./admin.types').StageStat[]
> {
  const rows = await repo.getStageStats();
  return rows.map((row) => {
    const lessonCount = Number(row.lesson_count);
    const learnersStarted = Number(row.learners_started);
    // A stage spans several lessons, so compare completed lesson rows against
    // every learner x lesson pair instead of against distinct learners alone.
    const possibleCompletions = lessonCount * learnersStarted;
    return {
      stageId: Number(row.stage_id),
      stageTitle: row.stage_title,
      sortOrder: Number(row.sort_order),
      lessonCount,
      learnersStarted,
      completions: Number(row.completions),
      completionRatePct:
        possibleCompletions > 0
          ? Math.min(100, pct(Number(row.completions), possibleCompletions))
          : 0,
      avgScore: row.avg_score === null ? null : Math.round(Number(row.avg_score) * 10) / 10,
    };
  });
}

export async function getContentStats(): Promise<
  import('./admin.types').ContentStats
> {
  return repo.getContentCounts();
}

export async function listInactiveUsers(
  minDays = 7,
  limit = 50,
): Promise<import('./admin.types').InactiveUserRow[]> {
  const boundedDays = Math.min(90, Math.max(1, Math.floor(minDays)));
  const boundedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const rows = await repo.listInactiveUsers(boundedDays, boundedLimit);
  const now = Date.now();
  return rows.map((row) => {
    const createdAt = new Date(row.created_at);
    const last = row.last_activity_at ? new Date(row.last_activity_at) : null;
    const reference = last ?? createdAt;
    const daysInactive = Math.max(
      0,
      Math.floor((now - reference.getTime()) / (24 * 60 * 60 * 1000)),
    );
    return {
      id: Number(row.id),
      displayName: row.display_name,
      email: row.email,
      xp: Number(row.xp),
      streak: Number(row.streak),
      createdAt: createdAt.toISOString(),
      lastActivityAt: last ? last.toISOString() : null,
      daysInactive,
      lessonsCompleted: Number(row.lessons_completed),
    };
  });
}
