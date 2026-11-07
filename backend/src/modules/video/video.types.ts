import type { RowDataPacket } from 'mysql2';
import type { Badge } from '../badges/badges.types';

export type VideoAnalysisModel = 'bolt' | 'gemini';

export interface VideoLessonRow extends RowDataPacket {
  id: number;
  code: string;
  title: string;
  description: string | null;
  topic: string;
  cefr_level: string;
  provider: 'youtube' | 'file';
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  xp_reward: number;
  sort_order: number;
  owner_user_id: number | null;
  subtitle_en: string | null;
  subtitle_vi: string | null;
  created_at: Date;
}

export interface VideoSegmentRow extends RowDataPacket {
  id: number;
  video_id: number;
  start_ms: number;
  end_ms: number;
  text_en: string;
  text_vi: string | null;
  sort_order: number;
}

export interface VideoVocabularyRow extends RowDataPacket {
  id: number;
  video_id: number;
  word: string;
  ipa: string;
  meaning_vi: string;
  detail_vi: string;
}

export interface VideoProgressRow extends RowDataPacket {
  id: number;
  user_id: number;
  video_id: number;
  watched_seconds: number;
  completed: boolean | 0 | 1;
  completed_at: Date | null;
  updated_at: Date;
}

export interface SavedWordRow extends RowDataPacket {
  id: number;
  user_id: number;
  video_id: number | null;
  word: string;
  ipa: string | null;
  meaning_vi: string | null;
  detail_vi: string | null;
  created_at: Date;
}

export interface VideoProgress {
  watched_seconds: number;
  completed: boolean;
  completed_at: string | null;
}

export interface VideoVocabulary {
  id: number;
  word: string;
  ipa: string;
  meaning_vi: string;
  detail_vi: string;
}

export interface VideoLessonSummary {
  id: number;
  code: string;
  title: string;
  description: string | null;
  topic: string;
  cefr_level: string;
  provider: 'youtube' | 'file';
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  xp_reward: number;
  sort_order: number;
  is_owned: boolean;
  progress: VideoProgress | null;
}

export interface VideoSegment {
  id: number;
  start_ms: number;
  end_ms: number;
  text_en: string;
  text_vi: string | null;
}

export interface VideoLessonDetail extends VideoLessonSummary {
  subtitle_en: string | null;
  subtitle_vi: string | null;
  vocabulary: VideoVocabulary[];
  segments: VideoSegment[];
}

export interface ImportedVideoInput {
  code: string;
  title: string;
  description: string | null;
  provider: 'youtube';
  videoUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  subtitleEn: string;
  segments: Array<{ startMs: number; endMs: number; text: string }>;
}

/**
 * One catalogue row, whatever its owner. `ownerUserId: null` means a shared
 * library video every learner can open; a number means one learner's import.
 */
export interface CreatedVideoInput {
  code: string;
  title: string;
  description: string | null;
  topic: string;
  cefrLevel: string;
  provider: 'youtube' | 'file';
  videoUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  xpReward: number;
  sortOrder: number;
  ownerUserId: number | null;
  subtitleEn: string | null;
  segments: Array<{ startMs: number; endMs: number; text: string }>;
}

export interface SavedWord {
  id: number;
  video_id: number | null;
  word: string;
  ipa: string | null;
  meaning_vi: string | null;
  detail_vi: string | null;
  created_at: string;
}

export interface SaveProgressInput {
  watchedSeconds: number;
}

export interface CompleteVideoResult {
  progress: VideoProgress;
  completed: boolean;
  already_completed: boolean;
  xp_earned: number;
  badges_awarded: Badge[];
}

export interface SaveWordInput {
  word: string;
  ipa?: string;
  meaningVi?: string;
  detailVi?: string;
  videoId?: number;
}

/**
 * Public, pre-signup preview of one real lesson. Only the first few segments are
 * sent and `text_vi` is dropped, so the landing page can host one honest
 * dictation round without giving the whole library away.
 */
export interface DemoVideoSegment {
  id: number;
  start_ms: number;
  end_ms: number;
  text_en: string;
}

export interface DemoVideoVocabulary {
  word: string;
  ipa: string;
  meaning_vi: string;
  detail_vi: string;
}

export interface DemoVideo {
  id: number;
  code: string;
  title: string;
  topic: string;
  cefr_level: string;
  provider: 'youtube' | 'file';
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  demo_segment_limit: number;
  total_segments: number;
  segments: DemoVideoSegment[];
  vocabulary: DemoVideoVocabulary[];
}
