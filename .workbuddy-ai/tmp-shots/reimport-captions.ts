/**
 * Re-fetch the original YouTube captions for videos that are already in the
 * library and rebuild their segments with the current sentence splitter.
 *
 * This is the "proper" repair: unlike `resegment-videos.ts` (which can only work
 * with text that was already cut wrong), it starts from the raw caption cues, so
 * the AI gets real per-word timings and the paragraph gaps that sentence
 * detection needs.
 *
 * Usage:
 *   npx tsx .workbuddy-ai/tmp-shots/reimport-captions.ts              # dry run
 *   npx tsx .workbuddy-ai/tmp-shots/reimport-captions.ts --write
 *   npx tsx .workbuddy-ai/tmp-shots/reimport-captions.ts --only=10 --model=gemini
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp';
const backendRequire = createRequire(path.join(ROOT, 'backend/package.json'));

// Before the backend modules load, so their own path-less dotenv.config() cannot
// leave the provider keys empty and make refineSegmentsWithAi return silently.
dotenv.config({ path: path.join(ROOT, 'backend/.env') });

const WRITE = process.argv.includes('--write');
const MODEL_FLAG = process.argv.find((arg) => arg.startsWith('--model='));
const MODEL = (MODEL_FLAG?.split('=')[1] ?? 'gemini') as 'bolt' | 'gemini';
const ONLY_FLAG = process.argv.find((arg) => arg.startsWith('--only='));
const ONLY = ONLY_FLAG ? Number(ONLY_FLAG.split('=')[1]) : null;

interface Unit {
  startMs: number;
  endMs: number;
  text: string;
}

function normalise(strip: (text: string) => string, text: string): string {
  return strip(text).replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Above this a line usually still hides a second sentence. */
const LONG_LINE_WORDS = 9;

function quality(lines: string[]): { longLines: number; avgWords: number } {
  const counts = lines.map((line) => line.split(/\s+/).filter(Boolean).length);
  const total = counts.reduce((sum, value) => sum + value, 0);
  return {
    longLines: counts.filter((value) => value > LONG_LINE_WORDS).length,
    avgWords: total / Math.max(1, counts.length),
  };
}

/** Fewer long lines wins; on a tie the finer average wins. */
function isImprovement(before: ReturnType<typeof quality>, after: ReturnType<typeof quality>): boolean {
  if (after.longLines !== before.longLines) return after.longLines < before.longLines;
  return after.avgWords < before.avgWords - 0.05;
}

async function main(): Promise<void> {
  const mysql = backendRequire('mysql2/promise');
  const { fetchYouTubeImportSource, extractYouTubeId, stripPunctuation } =
    await import('../../backend/src/modules/video/video.youtube');
  const { refineSegmentsWithAi } = await import('../../backend/src/modules/video/video.segmentation');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'english_learning',
    charset: 'utf8mb4',
  });

  const [videos] = await conn.query(
    'SELECT id, title, video_url FROM video_lessons ORDER BY id',
  ) as [Array<{ id: number; title: string; video_url: string }>, unknown];

  for (const video of videos) {
    if (ONLY !== null && video.id !== ONLY) continue;

    const youtubeId = extractYouTubeId(video.video_url);
    if (!youtubeId) {
      console.log(`SKIP ${video.id}: cannot read a YouTube id from ${video.video_url}`);
      continue;
    }

    const [beforeRows] = await conn.query(
      'SELECT text_en FROM video_segments WHERE video_id = ? ORDER BY sort_order ASC',
      [video.id],
    ) as [Array<{ text_en: string }>, unknown];
    const beforeText = beforeRows.map((row) => row.text_en).join(' ');

    let source;
    try {
      source = await fetchYouTubeImportSource(youtubeId);
    } catch (error) {
      console.log(`SKIP ${video.id}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    // Same pipeline the importer uses: word-level cues in, AI sentence ends, then
    // one sentence per segment.
    const refined = await refineSegmentsWithAi(source.segments, MODEL, source.aiCues);
    const aiAnswered = refined !== source.segments;
    const words = refined.reduce((sum, s) => sum + s.text.split(/\s+/).filter(Boolean).length, 0);
    const textMatches = normalise(stripPunctuation, refined.map((s) => s.text).join(' '))
      === normalise(stripPunctuation, beforeText);
    const sane = refined.length >= 2 && words / refined.length >= 2;

    const entry = {
      id: video.id,
      title: video.title.slice(0, 42),
      cues: source.cues.length,
      beforeSegments: beforeRows.length,
      afterSegments: refined.length,
      beforeAvgWords: Math.round(beforeText.split(/\s+/).length / Math.max(1, beforeRows.length)),
      afterAvgWords: Math.round(words / Math.max(1, refined.length)),
      aiAnswered,
      textMatches,
      sane,
    };

    // Each AI run is a fresh roll, so only a strictly better split is written.
    // Re-running this script can therefore improve a video but never regress it.
    const before = quality(beforeRows.map((row) => row.text_en));
    const after = quality(refined.map((segment) => segment.text));
    const better = isImprovement(before, after);

    if (!aiAnswered || !sane || !better) {
      console.log(`SKIP ${video.id}: ${JSON.stringify({
        ...entry,
        beforeLongLines: before.longLines,
        afterLongLines: after.longLines,
        reason: !aiAnswered ? 'AI did not answer' : !sane ? 'implausible split' : 'no improvement over current rows',
      })}`);
      continue;
    }

    console.log(`OK   ${video.id}: ${entry.beforeSegments} -> ${refined.length} segments `
      + `(${entry.beforeAvgWords}w -> ${entry.afterAvgWords}w, long lines ${before.longLines} -> ${after.longLines}, `
      + `${source.cues.length} cues, ${MODEL})`
      + `${textMatches ? '' : '  [wording differs from the old rows — expected when the captions are the source of truth]'}`);
    console.log(`     ${refined.slice(0, 4).map((s) => JSON.stringify(s.text)).join(' | ')}`);

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
        console.log(`     wrote ${refined.length} segments`);
      } catch (error) {
        await conn.rollback();
        throw error;
      }
    }
  }

  console.log(WRITE ? '\nWROTE changes' : '\nDRY RUN — re-run with --write to apply');
  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
