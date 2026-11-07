import { request, readToken, API_BASE_URL } from './api';

export type VideoAnalysisModel = 'bolt' | 'gemini';

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

export interface SavedWord {
  id: number;
  video_id: number | null;
  word: string;
  ipa: string | null;
  meaning_vi: string | null;
  detail_vi: string | null;
  created_at: string;
}

export interface SaveWordPayload {
  word: string;
  ipa?: string;
  meaningVi?: string;
  detailVi?: string;
  videoId?: number;
}

export interface CompleteVideoResult {
  progress: VideoProgress;
  completed: boolean;
  already_completed: boolean;
  xp_earned: number;
  badges_awarded: Array<{ code: string; name: string; description: string; icon: string | null }>;
}

interface ApiEnvelope<T> {
  success: true;
  data: T;
}

interface ApiError {
  message?: string;
  errors?: string[];
}

async function importRequest<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150_000);
  const token = await readToken();
  const url = `${API_BASE_URL}${path}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json() as ApiEnvelope<T> | ApiError;
    if (!response.ok || !('success' in payload)) {
      const error = payload as ApiError;
      const details = error.errors?.length ? ` ${error.errors.join(' ')}` : '';
      throw new Error(`${error.message || 'Không thể nhập video.'}${details}`);
    }
    return payload.data;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Phân tích video mất quá nhiều thời gian. Hãy thử lại sau.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function getVideos(): Promise<VideoLessonSummary[]> {
  const result = await request<{ videos: VideoLessonSummary[] }>('/videos');
  return result.videos;
}

export async function getVideo(videoId: number): Promise<VideoLessonDetail> {
  const result = await request<{ video: VideoLessonDetail }>(`/videos/${videoId}`);
  return result.video;
}

export async function importVideo(url: string, model: VideoAnalysisModel): Promise<VideoLessonDetail> {
  const result = await importRequest<{ video: VideoLessonDetail }>('/videos/import', { url, model });
  return result.video;
}

export async function deleteVideo(videoId: number): Promise<void> {
  await request<{ deleted: boolean }>(`/videos/${videoId}`, { method: 'DELETE' });
}

export async function saveVideoProgress(videoId: number, watchedSeconds: number): Promise<CompleteVideoResult> {
  return request<CompleteVideoResult>(`/videos/${videoId}/progress`, {
    method: 'POST',
    body: JSON.stringify({ watchedSeconds }),
  });
}

export async function getSavedWords(): Promise<SavedWord[]> {
  const result = await request<{ words: SavedWord[] }>('/vocabulary');
  return result.words;
}

export async function saveWord(payload: SaveWordPayload): Promise<SavedWord> {
  const result = await request<{ word: SavedWord }>('/vocabulary', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.word;
}

export async function deleteSavedWord(word: string): Promise<void> {
  await request<{ deleted: boolean }>(`/vocabulary/${encodeURIComponent(word)}`, { method: 'DELETE' });
}
