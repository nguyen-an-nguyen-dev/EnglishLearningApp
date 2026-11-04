import { HttpError } from '../../middleware/error-handler';
import type { SaveWordInput } from './video.types';

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parsePositiveId(value: unknown, field: string, statusCode = 400): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(statusCode, `Invalid ${field}.`);
  return id;
}

export function parseVideoId(value: unknown): number {
  return parsePositiveId(value, 'video ID');
}

export function parseImportUrl(value: unknown): string {
  const body = asObject(value);
  const raw = body.url ?? body.youtubeUrl ?? body.youtube_url;
  const url = typeof raw === 'string' ? raw.trim() : '';
  if (!url || url.length > 500) {
    throw new HttpError(422, 'Provide a valid YouTube link.', ['INVALID_YOUTUBE_URL']);
  }
  return url;
}

export function parseWatchedSeconds(value: unknown): number {
  const body = asObject(value);
  const seconds = Number(body.watchedSeconds ?? body.watched_seconds);
  if (!Number.isFinite(seconds) || !Number.isInteger(seconds) || seconds < 0 || seconds > 86_400) {
    throw new HttpError(422, 'Validation failed', ['watchedSeconds must be an integer between 0 and 86400.']);
  }
  return seconds;
}

export function parseSaveWordInput(value: unknown): SaveWordInput {
  const body = asObject(value);
  const errors: string[] = [];
  const word = typeof body.word === 'string' ? body.word.trim() : '';
  if (word.length === 0 || word.length > 80) {
    errors.push('word must contain between 1 and 80 characters.');
  }

  const optionalString = (key: string, max: number): string | undefined => {
    const raw = body[key];
    if (raw === undefined || raw === null || raw === '') return undefined;
    if (typeof raw !== 'string' || raw.trim().length > max) {
      errors.push(`${key} must be a string of at most ${max} characters.`);
      return undefined;
    }
    return raw.trim();
  };

  const ipa = optionalString('ipa', 80);
  const meaningVi = optionalString('meaningVi', 160) ?? optionalString('meaning_vi', 160);
  const detailVi = optionalString('detailVi', 500) ?? optionalString('detail_vi', 500);

  let videoId: number | undefined;
  const rawVideoId = body.videoId ?? body.video_id;
  if (rawVideoId !== undefined && rawVideoId !== null && rawVideoId !== '') {
    const parsed = Number(rawVideoId);
    if (!Number.isInteger(parsed) || parsed < 1) {
      errors.push('videoId must be a positive integer.');
    } else {
      videoId = parsed;
    }
  }

  if (errors.length) throw new HttpError(422, 'Validation failed', errors);
  return { word, ipa, meaningVi, detailVi, videoId };
}

export function parseSavedWord(value: unknown): string {
  const word = Array.isArray(value) ? value[0] : value;
  if (typeof word !== 'string') throw new HttpError(400, 'Invalid word.');
  const decoded = decodeURIComponent(word).trim();
  if (decoded.length === 0 || decoded.length > 80) throw new HttpError(400, 'Invalid word.');
  return decoded;
}
