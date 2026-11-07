import { HttpError } from '../../middleware/error-handler';
import { getVideoDetail } from '../video/video.service';
import * as videoRepo from '../video/video.repository';
import { refineSegmentsWithAi } from '../video/video.segmentation';
import {
  canonicalYouTubeUrl,
  extractYouTubeId,
  fetchYouTubeImportSource,
  videoCodeForShared,
} from '../video/video.youtube';
import type { VideoLessonDetail } from '../video/video.types';
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
  type AdminStage,
  type AdminStageRow,
  type LessonInput,
  type LessonPatch,
  type MoveDirection,
  type QuestionInput,
  type SharedVideoImportInput,
  type SharedVideoPatch,
  type StageInput,
  type StagePatch,
  type StageThemeKey,
} from './admin.types';

export const DEFAULT_STAGE_THEME: StageThemeKey = 'river';
export const DEFAULT_SHARED_TOPIC = 'Thư viện chung';
export const SHARED_VIDEO_XP = 20;

// ─── Mappers ─────────────────────────────────────────────────────────────────

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
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ER_DUP_ENTRY';
}

// ─── Content tree ────────────────────────────────────────────────────────────

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

// ─── Stages ──────────────────────────────────────────────────────────────────

export async function createStage(input: StageInput): Promise<AdminStage> {
  const themeKey = input.themeKey ?? DEFAULT_STAGE_THEME;
  const code = nextAvailableCode(input.title, new Set(await repo.listStageCodes()), 'chang');
  const sortOrder = await repo.nextStageSortOrder();
  let stageId: number;
  try {
    stageId = await repo.insertStage({
      code,
      title: input.title,
      description: input.description,
      themeKey,
      accentColor: THEME_ACCENTS[themeKey],
      sortOrder,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new HttpError(409, 'Stage code already exists.', ['CODE_TAKEN']);
    throw error;
  }
  return getStageDetail(stageId);
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

// ─── Lessons ─────────────────────────────────────────────────────────────────

export async function createLesson(input: LessonInput): Promise<AdminLessonSummary> {
  const stage = await repo.getStageRow(input.stageId);
  if (!stage) throw new HttpError(404, 'Stage not found.');
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
    const targetStage = await repo.getStageRow(patch.stageId);
    if (!targetStage) throw new HttpError(404, 'Stage not found.');
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

// ─── Questions ───────────────────────────────────────────────────────────────

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

// ─── Shared video library (every learner sees these) ────────────────────────

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
  adminUserId: number,
  input: SharedVideoImportInput,
): Promise<VideoLessonDetail> {
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
  const segments = await refineSegmentsWithAi(source.segments, input.model, source.aiCues);
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
      segments,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, 'Video này đã có trong thư viện chung.', ['VIDEO_ALREADY_IN_LIBRARY']);
    }
    throw error;
  }

  return getVideoDetail(videoId, adminUserId);
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

export async function deleteSharedVideo(videoId: number): Promise<void> {
  const deleted = await repo.deleteSharedVideoRow(videoId);
  if (!deleted) throw new HttpError(404, 'Shared video not found.');
}

export async function moveSharedVideo(videoId: number, direction: MoveDirection): Promise<void> {
  const moved = await repo.moveSharedVideo(videoId, direction);
  if (!moved) throw new HttpError(404, 'Shared video not found.');
}
