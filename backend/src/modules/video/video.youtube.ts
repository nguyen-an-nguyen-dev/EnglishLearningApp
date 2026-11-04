import type { SpawnOptions } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import youtubeDl from 'youtube-dl-exec';
import { HttpError } from '../../middleware/error-handler';

/** Imported clips must stay strictly under five minutes. */
export const MAX_IMPORT_DURATION_SECONDS = 300;
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
export const MAX_SEGMENT_MS = 12_000;
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
  cues: CaptionCue[];
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
    .replace(/\bi\b/g, 'I')
    .trim();
}

/**
 * Lesson text is dictation text: letters, digits and single spaces only. An
 * apostrophe inside a word is deleted without a gap (don't → dont, I'm → Im)
 * so the spelling stays readable while no mark reaches the learner.
 */
export function stripPunctuation(text: string): string {
  return text
    .replace(/[’‘`´]/g, "'")
    .replace(/(\p{L})'(?=\p{L})/gu, '$1')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
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

    const segs = event.segs.filter(
      (seg): seg is Record<string, unknown> => isRecord(seg) && typeof seg.utf8 === 'string',
    );
    const eventText = tidyCaptionText(segs.map((seg) => String(seg.utf8)).join(''));
    if (isNoiseCaption(eventText) || eventText.toLowerCase() === previous.toLowerCase()) continue;
    previous = eventText;

    const eventEnd = Math.max(start + 300, start + (Number.isFinite(duration) ? duration : 0));
    const hasOffsets = segs.some(
      (seg) => seg.tOffsetMs !== undefined && seg.tOffsetMs !== null,
    );

    // Tracks without per-word offsets only allow event-level timing.
    if (!hasOffsets) {
      cues.push({ startMs: Math.round(start), endMs: Math.round(eventEnd), text: eventText });
      continue;
    }

    // Word-level cues: sentence breaks live inside caption events, so the AI
    // editor needs the timing of every spoken fragment, not of the whole event.
    // The first seg of an event omits tOffsetMs because it starts at the event.
    let lastOffset = 0;
    const offsets = segs.map((seg) => {
      const raw = Number(seg.tOffsetMs);
      const offset = seg.tOffsetMs === undefined || seg.tOffsetMs === null
        || !Number.isFinite(raw) || raw < lastOffset
        ? lastOffset
        : raw;
      lastOffset = offset;
      return offset;
    });

    for (let index = 0; index < segs.length; index += 1) {
      const text = tidyCaptionText(String(segs[index].utf8));
      if (!text || isNoiseCaption(text)) continue;
      const segStart = start + offsets[index];
      const nextOffset = index + 1 < offsets.length ? offsets[index + 1] : null;
      const segEnd = nextOffset === null ? eventEnd : start + nextOffset;
      cues.push({
        startMs: Math.round(segStart),
        endMs: Math.max(Math.round(segStart) + 150, Math.round(segEnd)),
        text,
      });
    }
  }
  return cues;
}

const VTT_TIME = /^(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})$/;

function vttTimeToMs(value: string): number | null {
  const match = VTT_TIME.exec(value.trim());
  if (!match) return null;
  const hours = match[1] ? Number(match[1].slice(0, -1)) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millis = Number(match[4]);
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
}

/** Some tracks only ship WebVTT even when json3 was requested (music videos especially). */
export function parseVttCues(payload: string): CaptionCue[] {
  const cues: CaptionCue[] = [];
  let previous = '';
  for (const block of payload.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n');
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex === -1) continue;
    const [from, to] = lines[timingIndex].split('-->').map((part) => part.trim().split(/\s+/)[0] ?? '');
    const startMs = vttTimeToMs(from);
    const endMs = vttTimeToMs(to);
    if (startMs === null || endMs === null || endMs <= startMs) continue;
    const raw = lines.slice(timingIndex + 1).join(' ')
      .replace(/&lt;[^&]*&gt;/g, ' ')
      .replace(/&(?:amp|nbsp|quot|#39);/g, ' ');
    const text = tidyCaptionText(raw);
    if (isNoiseCaption(text) || text.toLowerCase() === previous.toLowerCase()) continue;
    cues.push({ startMs, endMs: Math.max(startMs + 300, endMs), text });
    previous = text;
  }
  return cues;
}

interface SegmentDraft {
  startMs: number;
  endMs: number;
  text: string;
}

export function normalizeCues(cues: CaptionCue[]): CaptionCue[] {
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
    text: sentenceCase(stripPunctuation(segment.text)),
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

/**
 * Manual captions only carry line-level timing, but their sentences still span
 * lines unevenly. Spreading each line across its words gives the AI editor a
 * cut point at every spoken word instead of every caption line.
 */
function expandCueWords(cues: CaptionCue[]): CaptionCue[] {
  const expanded: CaptionCue[] = [];
  for (const cue of cues) {
    const words = cue.text.split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      expanded.push(cue);
      continue;
    }
    const totalChars = words.reduce((sum, word) => sum + word.length + 1, 0);
    const span = Math.max(cue.endMs - cue.startMs, words.length * 120);
    let consumed = 0;
    for (let index = 0; index < words.length; index += 1) {
      const wordStart = cue.startMs + Math.round((consumed / totalChars) * span);
      consumed += words[index].length + 1;
      const wordEnd = index === words.length - 1
        ? Math.max(cue.endMs, wordStart + 150)
        : cue.startMs + Math.round((consumed / totalChars) * span);
      expanded.push({
        startMs: wordStart,
        endMs: Math.max(wordStart + 150, wordEnd),
        text: words[index],
      });
    }
  }
  return expanded;
}

async function readCaptionCues(
  directory: string,
  videoId: string,
  metadata: Record<string, unknown>,
): Promise<CaptionCue[]> {
  const files = await readdir(directory);
  const languages = englishLanguagePriority(metadata);
  const owned = (extension: string) => files.filter(
    (file) => file.startsWith(`${videoId}.`) && file.endsWith(extension),
  );
  const json3 = [...languages.map((language) => `${videoId}.${language}.json3`), ...owned('.json3')];
  const vtt = [...languages.map((language) => `${videoId}.${language}.vtt`), ...owned('.vtt')];

  for (const file of json3) {
    if (!files.includes(file)) continue;
    try {
      const payload = JSON.parse(await readFile(path.join(directory, file), 'utf8')) as unknown;
      const cues = parseJson3Cues(payload);
      if (cues.length > 0) return cues;
    } catch {
      /* try the next caption track */
    }
  }
  for (const file of vtt) {
    if (!files.includes(file)) continue;
    try {
      const cues = parseVttCues(await readFile(path.join(directory, file), 'utf8'));
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
    if (durationSeconds >= MAX_IMPORT_DURATION_SECONDS) {
      throw new HttpError(
        422,
        `This video is ${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s long. Imported videos must be shorter than 5 minutes.`,
        ['VIDEO_TOO_LONG'],
      );
    }

    const categories = Array.isArray(metadata.categories)
      ? metadata.categories.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const isMusic = categories.some((category) => category.toLocaleLowerCase('en') === 'music');

    const rawCues = normalizeCues(await readCaptionCues(directory, videoId, metadata));
    // Song lyrics read line by line and lose meaning when diced into words;
    // spoken captions profit from a cut point at every spoken word.
    const cues = isMusic ? rawCues : expandCueWords(rawCues);
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
      cues,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
