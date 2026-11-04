import { HttpError } from '../../middleware/error-handler';
import * as repo from './video.repository';
import { refineSegmentsWithAi } from './video.segmentation';
import type {
  CompleteVideoResult,
  SaveWordInput,
  SavedWord,
  VideoLessonDetail,
  VideoLessonRow,
  VideoAnalysisModel,
  VideoLessonSummary,
  VideoProgress,
  VideoProgressRow,
  VideoSegment,
  VideoSegmentRow,
  VideoVocabulary,
} from './video.types';
import {
  extractYouTubeId,
  fetchYouTubeImportSource,
  MAX_IMPORTS_PER_USER,
  videoCodeForUser,
} from './video.youtube';

export const VIDEO_COMPLETION_RATIO = 0.9;

export function completionThreshold(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return Math.ceil(durationSeconds * VIDEO_COMPLETION_RATIO);
}

export function hasWatchedEnough(durationSeconds: number, watchedSeconds: number): boolean {
  const threshold = completionThreshold(durationSeconds);
  return threshold === 0 || watchedSeconds >= threshold;
}

function mapProgress(row: VideoProgressRow | undefined): VideoProgress | null {
  if (!row) return null;
  return {
    watched_seconds: Number(row.watched_seconds),
    completed: row.completed === true || row.completed === 1,
    completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };
}

function mapSummary(row: VideoLessonRow, progress: VideoProgress | null): VideoLessonSummary {
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
    sort_order: row.sort_order,
    is_owned: row.owner_user_id !== null,
    progress,
  };
}

function assertVideoAccess(video: VideoLessonRow, userId: number): void {
  if (video.owner_user_id !== null && Number(video.owner_user_id) !== userId) {
    throw new HttpError(404, 'Video not found.');
  }
}

function mapSegment(row: VideoSegmentRow): VideoSegment {
  return {
    id: row.id,
    start_ms: Number(row.start_ms),
    end_ms: Number(row.end_ms),
    text_en: row.text_en,
    text_vi: row.text_vi,
  };
}

function mapVocabulary(vocabulary: Awaited<ReturnType<typeof repo.getVocabularyByVideo>>): VideoVocabulary[] {
  return vocabulary.map((entry) => ({
    id: entry.id,
    word: entry.word,
    ipa: entry.ipa,
    meaning_vi: entry.meaning_vi,
    detail_vi: entry.detail_vi,
  }));
}

function mapSavedWord(row: Awaited<ReturnType<typeof repo.getSavedWords>>[number]): SavedWord {
  return {
    id: row.id,
    video_id: row.video_id,
    word: row.word,
    ipa: row.ipa,
    meaning_vi: row.meaning_vi,
    detail_vi: row.detail_vi,
    created_at: new Date(row.created_at).toISOString(),
  };
}

export async function getVideos(userId: number): Promise<VideoLessonSummary[]> {
  const [rows, progressRows] = await Promise.all([
    repo.getAllVideosForUser(userId),
    repo.getProgressForUser(userId),
  ]);
  const progressByVideo = new Map(progressRows.map((row) => [row.video_id, row]));
  return rows.map((row) => mapSummary(row, mapProgress(progressByVideo.get(row.id))));
}

export async function getVideoDetail(videoId: number, userId: number): Promise<VideoLessonDetail> {
  const [video, vocabulary, segments, progress] = await Promise.all([
    repo.getVideoById(videoId),
    repo.getVocabularyByVideo(videoId),
    repo.getSegmentsByVideo(videoId),
    repo.getProgressForVideo(userId, videoId),
  ]);
  if (!video) throw new HttpError(404, 'Video not found.');
  assertVideoAccess(video, userId);
  return {
    ...mapSummary(video, mapProgress(progress)),
    subtitle_en: video.subtitle_en,
    subtitle_vi: video.subtitle_vi,
    vocabulary: mapVocabulary(vocabulary),
    segments: segments.map(mapSegment),
  };
}

export async function saveWatchProgress(
  videoId: number,
  userId: number,
  watchedSeconds: number,
): Promise<CompleteVideoResult> {
  const video = await repo.getVideoById(videoId);
  if (!video) throw new HttpError(404, 'Video not found.');
  assertVideoAccess(video, userId);

  const existing = await repo.getProgressForVideo(userId, videoId);
  const alreadyCompleted = Boolean(existing && (existing.completed === true || existing.completed === 1));
  const durationSeconds = Number(video.duration_seconds);

  if (!alreadyCompleted && hasWatchedEnough(durationSeconds, watchedSeconds)) {
    return completeVideo(videoId, userId, watchedSeconds, video);
  }

  await repo.upsertProgress(userId, videoId, watchedSeconds);
  const progress = await repo.getProgressForVideo(userId, videoId);
  return {
    progress: mapProgress(progress) ?? { watched_seconds: watchedSeconds, completed: false, completed_at: null },
    completed: alreadyCompleted,
    already_completed: alreadyCompleted,
    xp_earned: 0,
    badges_awarded: [],
  };
}

export async function completeVideo(
  videoId: number,
  userId: number,
  watchedSeconds: number,
  prefetchedVideo?: VideoLessonRow,
): Promise<CompleteVideoResult> {
  const video = prefetchedVideo ?? await repo.getVideoById(videoId);
  if (!video) throw new HttpError(404, 'Video not found.');
  assertVideoAccess(video, userId);

  const durationSeconds = Number(video.duration_seconds);
  if (!hasWatchedEnough(durationSeconds, watchedSeconds)) {
    throw new HttpError(
      422,
      `Watch at least ${completionThreshold(durationSeconds)} seconds of this video to complete it.`,
    );
  }

  const result = await repo.completeVideo(userId, videoId, watchedSeconds, Number(video.xp_reward));
  return {
    progress: {
      watched_seconds: Math.max(watchedSeconds, durationSeconds),
      completed: true,
      completed_at: result.completedAt.toISOString(),
    },
    completed: true,
    already_completed: result.alreadyCompleted,
    xp_earned: result.xpEarned,
    badges_awarded: result.badgesAwarded,
  };
}

export async function importVideo(
  userId: number,
  rawUrl: string,
  analysisModel: VideoAnalysisModel = 'bolt',
): Promise<VideoLessonDetail> {
  const youtubeId = extractYouTubeId(rawUrl);
  if (!youtubeId) {
    throw new HttpError(400, 'Enter a valid YouTube link.', ['INVALID_YOUTUBE_URL']);
  }

  const code = videoCodeForUser(youtubeId, userId);
  const [importCount, existing] = await Promise.all([
    repo.countImportedVideos(userId),
    repo.findImportedVideo(userId, code),
  ]);
  if (existing) {
    throw new HttpError(409, 'This video is already in your library.', ['VIDEO_ALREADY_IMPORTED']);
  }
  if (importCount >= MAX_IMPORTS_PER_USER) {
    throw new HttpError(
      422,
      `You can keep up to ${MAX_IMPORTS_PER_USER} imported videos. Delete one before adding another.`,
      ['VIDEO_IMPORT_LIMIT'],
    );
  }

  const source = await fetchYouTubeImportSource(youtubeId);
  const segments = await refineSegmentsWithAi(source.segments, analysisModel, source.cues);
  const subtitleEn = segments.map((segment) => segment.text).join(' ').slice(0, 500);

  let videoId: number;
  try {
    videoId = await repo.createImportedVideo(userId, {
      code,
      title: source.title,
      description: source.description,
      provider: 'youtube',
      videoUrl: `https://www.youtube.com/watch?v=${source.youtubeId}`,
      thumbnailUrl: source.thumbnailUrl,
      durationSeconds: source.durationSeconds,
      subtitleEn,
      segments,
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'This video is already in your library.', ['VIDEO_ALREADY_IMPORTED']);
    }
    throw error;
  }

  return getVideoDetail(videoId, userId);
}

export async function deleteVideo(videoId: number, userId: number): Promise<void> {
  const deleted = await repo.deleteOwnedVideo(userId, videoId);
  if (!deleted) throw new HttpError(404, 'Imported video not found.');
}

export async function getSavedWords(userId: number): Promise<SavedWord[]> {
  const rows = await repo.getSavedWords(userId);
  return rows.map(mapSavedWord);
}

export async function saveWord(userId: number, input: SaveWordInput): Promise<SavedWord> {
  if (input.videoId !== undefined) {
    const video = await repo.getVideoById(input.videoId);
    if (!video) throw new HttpError(404, 'Video not found.');
    assertVideoAccess(video, userId);
  }
  const row = await repo.saveWord(
    userId,
    input.word,
    input.ipa ?? null,
    input.meaningVi ?? null,
    input.detailVi ?? null,
    input.videoId ?? null,
  );
  return mapSavedWord(row);
}

export async function deleteSavedWord(userId: number, word: string): Promise<void> {
  const deleted = await repo.deleteSavedWord(userId, word);
  if (!deleted) throw new HttpError(404, 'Saved word not found.');
}
