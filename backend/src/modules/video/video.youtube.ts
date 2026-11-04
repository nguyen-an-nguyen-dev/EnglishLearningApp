import type { SpawnOptions } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import youtubeDl from 'youtube-dl-exec';
import { HttpError } from '../../middleware/error-handler';

export const MAX_IMPORT_DURATION_SECONDS = 180;
export const MAX_IMPORTS_PER_USER = 20;

const FETCH_TIMEOUT_MS = 120_000;
const CAPTION_LANGS = ['en', 'en-orig', 'en-en', 'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN'];
const SENTENCE_END = /[.!?]["'”’)\]]*\s*$/;
const TRAILING_OFF = /(?:\.\.\.|…)\s*$/;
/** Below this a cue is a fragment, not something worth its own line. */
const MIN_SENTENCE_MS = 700;
/** Fewer words than this and the line is a reaction, so it joins the next one. */
const MIN_SENTENCE_WORDS = 4;
export const MIN_SEGMENT_MS = 5_000;
const MAX_SEGMENT_MS = 12_000;
const MAX_SEGMENT_CHARS = 170;
const MAX_JOIN_GAP_MS = 3_000;
const TRAILING_MERGE_MS = 3_000;

export interface CaptionCue {
  startMs: number;
  endMs: number;
  text: string;
}

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface YouTubeImportSource {
  youtubeId: string;
  title: string;
  description: string | null;
  channel: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number;
  segments: TranscriptSegment[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function englishRank(language: string): number {
  const value = language.toLowerCase();
  if (value === 'en') return 0;
  if (value === 'en-orig') return 1;
  if (value === 'en-us' || value === 'en-gb') return 2;
  return value.startsWith('en-') ? 3 : 9;
}

export function extractYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (/^[A-Za-z0-9_-]{6,20}$/.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const validId = (value: string | null | undefined): string | null => {
    const id = value?.trim() ?? '';
    return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
  };

  if (host === 'youtu.be') return validId(url.pathname.split('/').filter(Boolean)[0]);
  if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
    return null;
  }
  if (url.pathname === '/watch') return validId(url.searchParams.get('v'));
  const pathMatch = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,20})/);
  return validId(pathMatch?.[1]);
}

export function canonicalYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function videoCodeForUser(videoId: string, userId: number): string {
  return `yt_${videoId}_u${userId}`;
}

export function tidyCaptionText(value: string): string {
  return value
    .replace(/\u200b/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^>\s*/g, '')
    .replace(/^[A-Z][A-Z0-9 .'’\-]{1,40}:\s+/u, '')
    .trim();
}

function isNoiseCaption(text: string): boolean {
  if (!text) return true;
  if (/^\[[^\]]*\]$/u.test(text)) return true;
  if (/^\([^)]*\)$/u.test(text) && text.length < 40) return true;
  if (/^[♪♫\s]+$/u.test(text)) return true;
  return false;
}

export function parseJson3Cues(payload: unknown): CaptionCue[] {
  if (!isRecord(payload) || !Array.isArray(payload.events)) return [];

  const cues: CaptionCue[] = [];
  let previous = '';
  for (const event of payload.events) {
    if (!isRecord(event) || !Array.isArray(event.segs)) continue;
    const start = Number(event.tStartMs);
    const duration = Number(event.dDurationMs ?? 0);
    if (!Number.isFinite(start) || start < 0) continue;

    const raw = event.segs
      .map((segment) => (isRecord(segment) && typeof segment.utf8 === 'string' ? segment.utf8 : ''))
      .join('');
    const text = tidyCaptionText(raw);
    if (isNoiseCaption(text) || text.toLowerCase() === previous.toLowerCase()) continue;

    const startMs = Math.round(start);
    const endMs = Math.max(startMs + 300, Math.round(start + (Number.isFinite(duration) ? duration : 0)));
    cues.push({ startMs, endMs, text });
    previous = text;
  }
  return cues;
}

interface SegmentDraft {
  startMs: number;
  endMs: number;
  text: string;
}

function normalizeCues(cues: CaptionCue[]): CaptionCue[] {
  const sorted = cues
    .filter((cue) => cue.text && cue.endMs > cue.startMs)
    .map((cue) => ({ ...cue, startMs: Math.max(0, Math.round(cue.startMs)), endMs: Math.round(cue.endMs) }))
    .sort((a, b) => a.startMs - b.startMs);

  // Rolling auto-captions overlap: a line stays on screen while the next one
  // appears. Clamp each cue to the next start so segment timings never overlap.
  return sorted.map((cue, index) => {
    const next = sorted[index + 1];
    if (next && cue.endMs > next.startMs) {
      return { ...cue, endMs: Math.max(cue.startMs + 200, next.startMs) };
    }
    return cue;
  });
}

function sentenceCase(text: string): string {
  return text.charAt(0).toLocaleUpperCase('en') + text.slice(1);
}

/**
 * A line is a finished sentence when it ends in . ! or ? — but a trailing
 * ellipsis means the speaker stopped mid-thought, so it keeps collecting.
 */
function endsSentence(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || TRAILING_OFF.test(trimmed)) return false;
  return SENTENCE_END.test(trimmed);
}

/**
 * "Oh yes." / "I know." / "Really?" are reactions, not lines worth their own
 * turn — they read better glued to the sentence they lead into.
 */
function isReaction(text: string): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length < MIN_SENTENCE_WORDS;
}

function mergeTinySegments(segments: SegmentDraft[]): SegmentDraft[] {
  const merged = segments.map((segment) => ({ ...segment }));
  for (let index = 0; index < merged.length; index += 1) {
    const segment = merged[index];
    // Whole sentences stay on their own line however short they are; only
    // reactions and orphaned fragments get folded into a neighbour.
    if (segment.endMs - segment.startMs >= MIN_SEGMENT_MS) continue;
    if (endsSentence(segment.text) && !isReaction(segment.text)) continue;

    const previous = merged[index - 1];
    if (
      previous
      && segment.endMs - previous.startMs <= MAX_SEGMENT_MS + TRAILING_MERGE_MS
      && previous.text.length + segment.text.length + 1 <= MAX_SEGMENT_CHARS + 20
    ) {
      previous.text = `${previous.text} ${segment.text}`;
      previous.endMs = segment.endMs;
      merged.splice(index, 1);
      index -= 1;
      continue;
    }

    const next = merged[index + 1];
    if (
      next
      && next.startMs - segment.endMs <= MAX_JOIN_GAP_MS
      && next.endMs - segment.startMs <= MAX_SEGMENT_MS + TRAILING_MERGE_MS
      && segment.text.length + next.text.length + 1 <= MAX_SEGMENT_CHARS + 20
    ) {
      next.text = `${segment.text} ${next.text}`;
      next.startMs = segment.startMs;
      merged.splice(index, 1);
      index -= 1;
    }
  }
  return merged;
}

export function segmentCaptionCues(cues: CaptionCue[]): TranscriptSegment[] {
  const units = normalizeCues(cues);
  const drafts: SegmentDraft[] = [];
  let current: SegmentDraft | null = null;

  const flush = () => {
    if (!current) return;
    const text = tidyCaptionText(current.text);
    if (text) drafts.push({ ...current, text: sentenceCase(text) });
    current = null;
  };

  for (const cue of units) {
    if (!current) {
      current = { startMs: cue.startMs, endMs: cue.endMs, text: cue.text };
      continue;
    }

    const gap = cue.startMs - current.endMs;
    const duration = Math.max(current.endMs, cue.endMs) - current.startMs;
    const chars = current.text.length + cue.text.length + 1;
    const currentDuration = current.endMs - current.startMs;

    // One sentence per line: a finished sentence always closes the block, so
    // the learner reads and types exactly one thought at a time. Run-on speech
    // without punctuation still falls back to the size caps below.
    const overflow = duration > MAX_SEGMENT_MS || chars > MAX_SEGMENT_CHARS;
    const hardBreak = gap > MAX_JOIN_GAP_MS;
    const sentenceBreak = !hardBreak
      && currentDuration >= MIN_SENTENCE_MS
      && endsSentence(current.text)
      && !isReaction(current.text);

    if (overflow || hardBreak || sentenceBreak) {
      flush();
      current = { startMs: cue.startMs, endMs: cue.endMs, text: cue.text };
      continue;
    }

    current.text = `${current.text} ${cue.text}`;
    current.endMs = Math.max(current.endMs, cue.endMs);
  }
  flush();

  return mergeTinySegments(drafts).slice(0, 200).map((segment) => ({
    startMs: Math.max(0, segment.startMs),
    endMs: Math.max(segment.startMs + 500, segment.endMs),
    text: segment.text,
  }));
}

function englishLanguagePriority(metadata: Record<string, unknown>): string[] {
  const manual = isRecord(metadata.subtitles)
    ? Object.keys(metadata.subtitles).filter((language) => language.toLowerCase().startsWith('en'))
    : [];
  const automatic = isRecord(metadata.automatic_captions)
    ? Object.keys(metadata.automatic_captions).filter((language) => language.toLowerCase().startsWith('en'))
    : [];
  return [...new Set([...manual.sort((a, b) => englishRank(a) - englishRank(b)),
    ...automatic.sort((a, b) => englishRank(a) - englishRank(b))])];
}

async function readCaptionCues(
  directory: string,
  videoId: string,
  metadata: Record<string, unknown>,
): Promise<CaptionCue[]> {
  const files = await readdir(directory);
  const candidates = englishLanguagePriority(metadata)
    .map((language) => `${videoId}.${language}.json3`)
    .concat(files.filter((file) => file.startsWith(`${videoId}.`) && file.endsWith('.json3')));

  for (const file of candidates) {
    if (!files.includes(file)) continue;
    try {
      const payload = JSON.parse(await readFile(path.join(directory, file), 'utf8')) as unknown;
      const cues = parseJson3Cues(payload);
      if (cues.length > 0) return cues;
    } catch {
      /* try the next caption track */
    }
  }
  return [];
}

function mapYtDlpError(error: unknown): HttpError {
  const message = error instanceof Error ? error.message : String(error);
  if (/timed? ?out|ETIMEDOUT|SIGTERM|killed/i.test(message)) {
    return new HttpError(504, 'Reading the YouTube video timed out. Please try again.', ['VIDEO_IMPORT_TIMEOUT']);
  }
  if (/no subtitles|There are no subtitles/i.test(message)) {
    return new HttpError(422, 'This video has no English captions to analyze.', ['VIDEO_NO_CAPTIONS']);
  }
  if (/429|too many requests|rate.?limit/i.test(message)) {
    return new HttpError(503, 'YouTube is limiting requests right now. Please try again in a few minutes.', ['VIDEO_IMPORT_UNAVAILABLE']);
  }
  if (/private|unavailable|removed|members-only|age-restricted|not available|sign in/i.test(message)) {
    return new HttpError(422, 'This YouTube video is unavailable or private.', ['VIDEO_UNAVAILABLE']);
  }
  console.error('YouTube import failed:', message.slice(0, 600));
  return new HttpError(502, 'Could not analyze that YouTube video. Please try another link.', ['VIDEO_IMPORT_UNAVAILABLE']);
}

export async function fetchYouTubeImportSource(videoId: string): Promise<YouTubeImportSource> {
  const directory = await mkdtemp(path.join(tmpdir(), 'engorace-yt-'));
  try {
    let payload: unknown;
    try {
      payload = await youtubeDl(
        canonicalYouTubeUrl(videoId),
        {
          dumpSingleJson: true,
          noSimulate: true,
          skipDownload: true,
          writeSubs: true,
          writeAutoSubs: true,
          subLangs: CAPTION_LANGS,
          subFormat: 'json3',
          output: path.join(directory, '%(id)s'),
          noPlaylist: true,
          noWarnings: true,
          noProgress: true,
          retries: 2,
          socketTimeout: 20,
        },
        { timeout: FETCH_TIMEOUT_MS } as SpawnOptions & { timeout: number },
      );
    } catch (error) {
      throw mapYtDlpError(error);
    }

    const metadata = typeof payload === 'string'
      ? JSON.parse(payload) as unknown
      : payload;
    if (!isRecord(metadata)) {
      throw new HttpError(422, 'Could not read this YouTube video.', ['VIDEO_UNAVAILABLE']);
    }
    if (metadata.is_live === true || metadata.live_status === 'is_live') {
      throw new HttpError(422, 'Live streams cannot be imported.', ['VIDEO_UNAVAILABLE']);
    }

    const durationSeconds = Math.round(Number(metadata.duration));
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new HttpError(422, 'This video has no fixed duration and cannot be imported.', ['VIDEO_UNAVAILABLE']);
    }
    if (durationSeconds > MAX_IMPORT_DURATION_SECONDS) {
      throw new HttpError(
        422,
        `This video is ${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s long. Imported videos must be 3 minutes or shorter.`,
        ['VIDEO_TOO_LONG'],
      );
    }

    const cues = await readCaptionCues(directory, videoId, metadata);
    const segments = segmentCaptionCues(cues);
    if (segments.length === 0) {
      throw new HttpError(
        422,
        'This video has no English captions to analyze. Try a video with English subtitles.',
        ['VIDEO_NO_CAPTIONS'],
      );
    }

    const channel = typeof metadata.channel === 'string'
      ? metadata.channel.trim()
      : typeof metadata.uploader === 'string' ? metadata.uploader.trim() : '';
    const rawDescription = typeof metadata.description === 'string'
      ? metadata.description.replace(/\s+/g, ' ').trim()
      : '';
    const description = [channel, rawDescription].filter(Boolean).join(' · ').slice(0, 500) || null;
    const rawThumbnail = typeof metadata.thumbnail === 'string'
      ? metadata.thumbnail
      : Array.isArray(metadata.thumbnails) && isRecord(metadata.thumbnails[metadata.thumbnails.length - 1])
        ? metadata.thumbnails[metadata.thumbnails.length - 1].url
        : null;
    const thumbnailUrl = typeof rawThumbnail === 'string' && /^https?:\/\//i.test(rawThumbnail)
      ? rawThumbnail.slice(0, 500)
      : null;
    const title = typeof metadata.title === 'string' && metadata.title.trim()
      ? metadata.title.trim().slice(0, 160)
      : 'YouTube video';

    return {
      youtubeId: videoId,
      title,
      description,
      channel: channel || null,
      thumbnailUrl,
      durationSeconds,
      segments,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
