/**
 * Re-segment the videos that were imported before `buildSegmentsFromEnds` kept
 * one sentence per line. `yt-dlp` cannot run in this environment (its bundled
 * bootloader cannot create a temp dir), so the raw captions cannot be fetched
 * again. Instead the stored transcript is rebuilt into word-level units with
 * proportional timing — the same shape `expandCueWords()` produces for captions
 * that only carry line-level timing — and the real AI sentence splitter runs
 * over those units.
 *
 * Refuses to write unless the AI actually answered AND the word sequence is
 * byte-for-byte the same as before, so a provider hiccup can never corrupt a
 * transcript.
 *
 * Usage:
 *   npx tsx .workbuddy-ai/tmp-shots/resegment-videos.ts            # dry run
 *   npx tsx .workbuddy-ai/tmp-shots/resegment-videos.ts --write
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp';
const backendRequire = createRequire(path.join(ROOT, 'backend/package.json'));

// Must run before the backend modules are loaded: their `config/env` calls its
// own `dotenv.config()` without a path, which would read `.env` from the cwd
// instead of backend/ and leave every provider key empty. An empty key makes
// `refineSegmentsWithAi` return silently, so the backend modules are imported
// dynamically inside main() rather than statically here.
dotenv.config({ path: path.join(ROOT, 'backend/.env') });

const WRITE = process.argv.includes('--write');
const MODEL_FLAG = process.argv.find((arg) => arg.startsWith('--model='));
const MODEL = (MODEL_FLAG?.split('=')[1] ?? 'bolt') as 'bolt' | 'gemini';
const ONLY_FLAG = process.argv.find((arg) => arg.startsWith('--only='));
const ONLY = ONLY_FLAG ? Number(ONLY_FLAG.split('=')[1]) : null;

type StripFn = (text: string) => string;
let stripFn: StripFn = (text) => text;

interface Row {
  sort_order: number;
  start_ms: number;
  end_ms: number;
  text_en: string;
}

interface Unit {
  startMs: number;
  endMs: number;
  text: string;
}

function normalise(text: string): string {
  // Must mirror what buildSegmentsFromEnds does to the text, otherwise
  // contractions ("don't" -> "dont") look like a lost word.
  return stripFn(text).replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Spreads a segment's window across its words in proportion to word length, so
 * every word gets a cut point the AI can end a sentence on.
 */
function expandToWordUnits(rows: Row[]): Unit[] {
  const units: Unit[] = [];
  for (const row of rows) {
    units.push(...expandOne(row.start_ms, row.end_ms, row.text_en));
  }
  return units;
}

function expandOne(startMs: number, endMs: number, text: string): Unit[] {
  // Lower-cased on purpose: the old size-based splitter capitalised the first
  // word of every cut ("what did you Do I had some meetings", "Beautiful it was
  // warm"), and those fake sentence starts are exactly what makes the model miss
  // real boundaries. buildSegmentsFromEnds re-capitalises each finished line.
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [{ startMs, endMs, text: text.trim() }];
  const totalChars = words.reduce((sum, word) => sum + word.length + 1, 0);
  const span = Math.max(endMs - startMs, words.length * 120);
  const units: Unit[] = [];
  let consumed = 0;
  for (let index = 0; index < words.length; index += 1) {
    const start = startMs + Math.round((consumed / totalChars) * span);
    consumed += words[index].length + 1;
    const end = index === words.length - 1
      ? Math.max(endMs, start + 150)
      : startMs + Math.round((consumed / totalChars) * span);
    units.push({ startMs: start, endMs: Math.max(start + 150, end), text: words[index] });
  }
  return units;
}

/** Above this a line almost always still hides a second sentence. */
const LONG_LINE_WORDS = 9;
const MAX_REFINE_ROUNDS = 2;

/**
 * The model sometimes leaves two spoken sentences inside one line. Those lines
 * are handed back to it on their own (word units again) until every line is
 * short enough to dictate comfortably. A line the primary model keeps refusing
 * is retried on the other provider, which fails differently.
 */
async function splitTranscript(
  units: Unit[],
  model: 'bolt' | 'gemini',
  refine: (units: Unit[], model: 'bolt' | 'gemini', cues: Unit[]) => Promise<Unit[]>,
): Promise<Unit[] | null> {
  const other: 'bolt' | 'gemini' = model === 'gemini' ? 'bolt' : 'gemini';
  let segments = await refine(units, model, units);
  if (segments === units) return null;

  async function splitOne(segment: Unit): Promise<Unit[] | null> {
    const subUnits = expandOne(segment.startMs, segment.endMs, segment.text);
    for (const candidate of [model, other, model]) {
      const parts = await refine(subUnits, candidate, subUnits);
      if (parts !== subUnits && parts.length > 1) return parts;
    }
    return null;
  }

  for (let round = 0; round < MAX_REFINE_ROUNDS; round += 1) {
    let changed = false;
    const next: Unit[] = [];
    for (const segment of segments) {
      const words = segment.text.split(/\s+/).filter(Boolean).length;
      if (words <= LONG_LINE_WORDS) {
        next.push(segment);
        continue;
      }
      const parts = await splitOne(segment);
      if (!parts) {
        next.push(segment);
        continue;
      }
      changed = true;
      next.push(...parts);
    }
    segments = next;
    if (!changed) break;
  }
  return segments;
}

async function main(): Promise<void> {
  const mysql = backendRequire('mysql2/promise');
  // Imported after dotenv has loaded backend/.env (see the note at the top).
  const { refineSegmentsWithAi } = await import('../../backend/src/modules/video/video.segmentation');
  const { stripPunctuation } = await import('../../backend/src/modules/video/video.youtube');
  const { env } = await import('../../backend/src/config/env');
  stripFn = stripPunctuation;

  console.log('provider keys:', JSON.stringify({
    nvidia: env.nvidiaApiKey ? `set(${env.nvidiaApiKey.slice(0, 6)}…)` : 'MISSING',
    gemini: env.aiApiKey ? `set(${env.aiApiKey.slice(0, 6)}…)` : 'MISSING',
    nvidiaModel: env.nvidiaModel,
    aiModel: env.aiModel,
  }));

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'english_learning',
    charset: 'utf8mb4',
  });

  const [videos] = await conn.query(
    'SELECT id, title, duration_seconds FROM video_lessons ORDER BY id',
  ) as [Array<{ id: number; title: string; duration_seconds: number }>, unknown];

  const summary: Array<Record<string, unknown>> = [];

  for (const video of videos) {
    if (ONLY !== null && video.id !== ONLY) continue;
    const [rows] = await conn.query(
      'SELECT sort_order, start_ms, end_ms, text_en FROM video_segments WHERE video_id = ? ORDER BY sort_order ASC',
      [video.id],
    ) as [Row[], unknown];

    if (rows.length === 0) {
      summary.push({ id: video.id, skipped: 'no segments' });
      continue;
    }

    const before = rows.map((row) => row.text_en);
    const units = expandToWordUnits(rows);

    // `refineSegmentsWithAi` returns the very array it was handed when every
    // provider failed, so identity is a reliable "the AI never answered" flag.
    const usedModel = MODEL;
    const split = await splitTranscript(
      units,
      MODEL,
      refineSegmentsWithAi as unknown as (u: Unit[], m: 'bolt' | 'gemini', c: Unit[]) => Promise<Unit[]>,
    );

    const aiAnswered = split !== null;
    const refined = split ?? units;
    const words = refined.reduce((sum, segment) => sum + segment.text.split(/\s+/).filter(Boolean).length, 0);
    const textMatches = normalise(refined.map((s) => s.text).join(' '))
      === normalise(before.join(' '));
    const sane = refined.length >= 2 && words / refined.length >= 2;

    const entry = {
      id: video.id,
      title: video.title.slice(0, 45),
      before: rows.length,
      after: refined.length,
      beforeAvgWords: Math.round(before.join(' ').split(/\s+/).length / rows.length),
      afterAvgWords: Math.round(words / refined.length),
      usedModel,
      aiAnswered,
      textMatches,
      sane,
      written: false,
    };

    if (!aiAnswered || !textMatches || !sane) {
      entry.written = false;
      if (!textMatches) {
        // Show where the two transcripts diverge so a real corruption is visible.
        const beforeText = normalise(before.join(' '));
        const afterText = normalise(refined.map((s) => s.text).join(' '));
        let at = 0;
        while (at < beforeText.length && at < afterText.length && beforeText[at] === afterText[at]) at += 1;
        console.log(`     diff at char ${at}: before "${beforeText.slice(at, at + 60)}" / after "${afterText.slice(at, at + 60)}"`);
      }
      summary.push({ ...entry, skipped: !aiAnswered ? 'AI did not answer' : !textMatches ? 'word sequence changed' : 'implausible split' });
      console.log(`SKIP ${video.id}: ${JSON.stringify(entry)}`);
      continue;
    }

    console.log(`OK   ${video.id}: ${rows.length} -> ${refined.length} segments (${entry.beforeAvgWords}w -> ${entry.afterAvgWords}w per line, ${usedModel})`);
    console.log(`     first lines: ${refined.slice(0, 4).map((s) => JSON.stringify(s.text)).join(' | ')}`);

    if (WRITE) {
      await conn.beginTransaction();
      try {
        await conn.execute('DELETE FROM video_segments WHERE video_id = ?', [video.id]);
        for (const [index, segment] of refined.entries()) {
          await conn.execute(
            `INSERT INTO video_segments (video_id, start_ms, end_ms, text_en, text_vi, sort_order)
             VALUES (?, ?, ?, ?, NULL, ?)`,
            [video.id, Math.round(segment.startMs), Math.round(segment.endMs), segment.text, index + 1],
          );
        }
        await conn.commit();
        entry.written = true;
      } catch (error) {
        await conn.rollback();
        throw error;
      }
    }

    summary.push(entry);
  }

  console.log('\n=== summary ===');
  console.log(JSON.stringify(summary, null, 1));
  console.log(WRITE ? '\nWROTE changes' : '\nDRY RUN — re-run with --write to apply');

  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
