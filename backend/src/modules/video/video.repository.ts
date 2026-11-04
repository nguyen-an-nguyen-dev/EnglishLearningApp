import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../db/pool';
import { awardEligibleBadges } from '../badges/badges.repository';
import type { Badge } from '../badges/badges.types';
import type {
  ImportedVideoInput,
  SavedWordRow,
  VideoLessonRow,
  VideoProgressRow,
  VideoSegmentRow,
  VideoVocabularyRow,
} from './video.types';

const VIDEO_COLUMNS = `id, code, title, description, topic, cefr_level, provider, video_url,
  thumbnail_url, duration_seconds, xp_reward, sort_order, owner_user_id, subtitle_en, subtitle_vi,
  created_at`;

export async function getAllVideosForUser(userId: number): Promise<VideoLessonRow[]> {
  const [rows] = await pool.execute<VideoLessonRow[]>(
    `SELECT ${VIDEO_COLUMNS} FROM video_lessons
     WHERE owner_user_id IS NULL OR owner_user_id = ?
     ORDER BY (owner_user_id IS NULL) DESC, sort_order ASC, created_at DESC`,
    [userId],
  );
  return rows;
}

export async function getVideoById(videoId: number): Promise<VideoLessonRow | undefined> {
  const [rows] = await pool.execute<VideoLessonRow[]>(
    `SELECT ${VIDEO_COLUMNS} FROM video_lessons WHERE id = ? LIMIT 1`,
    [videoId],
  );
  return rows[0];
}

export async function getVocabularyByVideo(videoId: number): Promise<VideoVocabularyRow[]> {
  const [rows] = await pool.execute<VideoVocabularyRow[]>(
    `SELECT id, video_id, word, ipa, meaning_vi, detail_vi
     FROM video_vocabulary WHERE video_id = ? ORDER BY sort_order ASC`,
    [videoId],
  );
  return rows;
}

export async function getSegmentsByVideo(videoId: number): Promise<VideoSegmentRow[]> {
  const [rows] = await pool.execute<VideoSegmentRow[]>(
    `SELECT id, video_id, start_ms, end_ms, text_en, text_vi, sort_order
     FROM video_segments WHERE video_id = ? ORDER BY sort_order ASC`,
    [videoId],
  );
  return rows;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export async function countImportedVideos(userId: number): Promise<number> {
  const [rows] = await pool.execute<CountRow[]>(
    'SELECT COUNT(*) AS total FROM video_lessons WHERE owner_user_id = ?',
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function findImportedVideo(userId: number, code: string): Promise<VideoLessonRow | undefined> {
  const [rows] = await pool.execute<VideoLessonRow[]>(
    `SELECT ${VIDEO_COLUMNS} FROM video_lessons
     WHERE owner_user_id = ? AND code = ? LIMIT 1`,
    [userId, code],
  );
  return rows[0];
}

export async function createImportedVideo(
  userId: number,
  input: ImportedVideoInput,
): Promise<number> {
  const connection: PoolConnection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO video_lessons
         (code, title, description, topic, cefr_level, provider, video_url, thumbnail_url,
          duration_seconds, xp_reward, sort_order, owner_user_id, subtitle_en, subtitle_vi)
       VALUES (?, ?, ?, 'Video của tôi', 'B1', ?, ?, ?, ?, 0, 0, ?, ?, NULL)`,
      [
        input.code,
        input.title,
        input.description,
        input.provider,
        input.videoUrl,
        input.thumbnailUrl,
        input.durationSeconds,
        userId,
        input.subtitleEn,
      ],
    );
    const videoId = result.insertId;
    for (const [index, segment] of input.segments.entries()) {
      await connection.execute(
        `INSERT INTO video_segments (video_id, start_ms, end_ms, text_en, text_vi, sort_order)
         VALUES (?, ?, ?, ?, NULL, ?)`,
        [videoId, segment.startMs, segment.endMs, segment.text, index + 1],
      );
    }
    await connection.commit();
    return videoId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteOwnedVideo(userId: number, videoId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM video_lessons WHERE id = ? AND owner_user_id = ?',
    [videoId, userId],
  );
  return result.affectedRows > 0;
}

export async function getProgressForUser(userId: number): Promise<VideoProgressRow[]> {
  const [rows] = await pool.execute<VideoProgressRow[]>(
    `SELECT id, user_id, video_id, watched_seconds, completed, completed_at, updated_at
     FROM video_progress WHERE user_id = ?`,
    [userId],
  );
  return rows;
}

export async function getProgressForVideo(
  userId: number,
  videoId: number,
): Promise<VideoProgressRow | undefined> {
  const [rows] = await pool.execute<VideoProgressRow[]>(
    `SELECT id, user_id, video_id, watched_seconds, completed, completed_at, updated_at
     FROM video_progress WHERE user_id = ? AND video_id = ? LIMIT 1`,
    [userId, videoId],
  );
  return rows[0];
}

export async function upsertProgress(
  userId: number,
  videoId: number,
  watchedSeconds: number,
): Promise<void> {
  await pool.execute(
    `INSERT INTO video_progress (user_id, video_id, watched_seconds, completed, completed_at)
     VALUES (?, ?, ?, FALSE, NULL)
     ON DUPLICATE KEY UPDATE
       watched_seconds = GREATEST(watched_seconds, VALUES(watched_seconds)),
       updated_at = CURRENT_TIMESTAMP`,
    [userId, videoId, watchedSeconds],
  );
}

interface CompletedCountRow extends RowDataPacket {
  completed_count: number;
}

interface UserXpRow extends RowDataPacket {
  xp: number;
}

export interface VideoCompletionData {
  watchedSeconds: number;
  completedAt: Date;
  xpEarned: number;
  alreadyCompleted: boolean;
  badgesAwarded: Badge[];
}

export async function completeVideo(
  userId: number,
  videoId: number,
  watchedSeconds: number,
  xpReward: number,
): Promise<VideoCompletionData> {
  const connection: PoolConnection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute<UserXpRow[]>(
      'SELECT xp FROM users WHERE id = ? FOR UPDATE',
      [userId],
    );
    if (!userRows[0]) throw new Error('User not found while completing video.');

    const [progressRows] = await connection.execute<VideoProgressRow[]>(
      `SELECT id, watched_seconds, completed FROM video_progress
       WHERE user_id = ? AND video_id = ? LIMIT 1 FOR UPDATE`,
      [userId, videoId],
    );
    const existing = progressRows[0];
    const alreadyCompleted = Boolean(existing && (existing.completed === true || existing.completed === 1));
    const now = new Date();

    if (existing) {
      await connection.execute(
        `UPDATE video_progress
         SET watched_seconds = GREATEST(watched_seconds, ?), completed = TRUE,
             completed_at = COALESCE(completed_at, ?), updated_at = ?
         WHERE user_id = ? AND video_id = ?`,
        [watchedSeconds, now, now, userId, videoId],
      );
    } else {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO video_progress (user_id, video_id, watched_seconds, completed, completed_at, updated_at)
         VALUES (?, ?, ?, TRUE, ?, ?)`,
        [userId, videoId, watchedSeconds, now, now],
      );
    }

    const xpEarned = alreadyCompleted ? 0 : xpReward;
    if (xpEarned > 0) {
      await connection.execute('UPDATE users SET xp = xp + ? WHERE id = ?', [xpEarned, userId]);
    }

    const [completedRows] = await connection.execute<CompletedCountRow[]>(
      `SELECT COUNT(*) AS completed_count
       FROM progress WHERE user_id = ? AND status = 'completed' AND score = 100`,
      [userId],
    );
    const totalXp = Number(userRows[0].xp) + xpEarned;
    const badgesAwarded = await awardEligibleBadges(
      connection,
      userId,
      Number(completedRows[0]?.completed_count ?? 0),
      totalXp,
    );

    await connection.commit();
    return {
      watchedSeconds,
      completedAt: now,
      xpEarned,
      alreadyCompleted,
      badgesAwarded,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getSavedWords(userId: number): Promise<SavedWordRow[]> {
  const [rows] = await pool.execute<SavedWordRow[]>(
    `SELECT id, user_id, video_id, word, ipa, meaning_vi, detail_vi, created_at
     FROM saved_words WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
    [userId],
  );
  return rows;
}

export async function saveWord(
  userId: number,
  word: string,
  ipa: string | null,
  meaningVi: string | null,
  detailVi: string | null,
  videoId: number | null,
): Promise<SavedWordRow> {
  await pool.execute(
    `INSERT INTO saved_words (user_id, video_id, word, ipa, meaning_vi, detail_vi)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       ipa = COALESCE(VALUES(ipa), ipa),
       meaning_vi = COALESCE(VALUES(meaning_vi), meaning_vi),
       detail_vi = COALESCE(VALUES(detail_vi), detail_vi),
       video_id = COALESCE(VALUES(video_id), video_id)`,
    [userId, videoId, word, ipa, meaningVi, detailVi],
  );
  const [rows] = await pool.execute<SavedWordRow[]>(
    `SELECT id, user_id, video_id, word, ipa, meaning_vi, detail_vi, created_at
     FROM saved_words WHERE user_id = ? AND word = ? LIMIT 1`,
    [userId, word],
  );
  return rows[0];
}

export async function deleteSavedWord(userId: number, word: string): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM saved_words WHERE user_id = ? AND word = ?',
    [userId, word],
  );
  return result.affectedRows > 0;
}
