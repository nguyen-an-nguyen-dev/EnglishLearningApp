/**
 * One-off: re-run AI sentence segmentation for every YouTube video in the
 * database. Backs the two tables it touches up first, then, per video:
 *   fetchYouTubeImportSource → analyzeSegments → replaceSegments(transaction).
 * The chain is Sea-Lion (Workers AI) then Gemini Flash. Videos whose AI call
 * fails keep their existing segments untouched.
 *
 * Run: npx tsx scripts/reprocess-videos.ts
 */
import { extractYouTubeId, fetchYouTubeImportSource } from '../src/modules/video/video.youtube';
import { analyzeSegments } from '../src/modules/video/video.segmentation';
import * as videoRepo from '../src/modules/video/video.repository';
import { pool } from '../src/db/pool';

async function backup(): Promise<string> {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  await pool.query(`CREATE TABLE video_segments_backup_${stamp} LIKE video_segments`);
  await pool.query(`INSERT INTO video_segments_backup_${stamp} SELECT * FROM video_segments`);
  await pool.query(`CREATE TABLE video_lessons_backup_${stamp} LIKE video_lessons`);
  await pool.query(`INSERT INTO video_lessons_backup_${stamp} SELECT * FROM video_lessons`);
  return stamp;
}

async function main(): Promise<void> {
  const stamp = await backup();
  console.log(`backed up video_segments and video_lessons to *_backup_${stamp}`);

  const videos = await videoRepo.listYouTubeVideos();
  console.log(`found ${videos.length} YouTube videos\n`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const video of videos) {
    try {
      const youtubeId = extractYouTubeId(video.video_url);
      if (!youtubeId) {
        console.log(`- #${video.id} ${video.title}: no YouTube id, skipped`);
        skipped += 1;
        continue;
      }
      const source = await fetchYouTubeImportSource(youtubeId);
      const [countRows] = await pool.query('SELECT COUNT(*) AS n FROM video_segments WHERE video_id = ?', [video.id]) as unknown as [Array<{ n: number }>];
      const oldCount = Number(countRows[0]?.n ?? 0);
      const outcome = await analyzeSegments(source.segments, source.aiCues);
      if (!outcome.usedAi) {
        console.log(`- #${video.id} ${video.title}: AI unavailable, kept existing ${oldCount} segments`);
        skipped += 1;
        continue;
      }
      const subtitleEn = outcome.segments.map((segment) => segment.text).join(' ').slice(0, 500);
      await videoRepo.replaceSegments(video.id, outcome.segments, subtitleEn);
      console.log(`- #${video.id} ${video.title}: ${oldCount} -> ${outcome.segments.length} segments (AI)`);
      ok += 1;
    } catch (error) {
      failed += 1;
      console.log(`- #${video.id} ${video.title}: FAILED (${error instanceof Error ? error.message : String(error)})`);
    }
    // Stay under Groq's tokens-per-minute budget.
    await new Promise((resolve) => setTimeout(resolve, 4_000));
  }

  console.log(`\ndone: ${ok} reprocessed, ${skipped} skipped, ${failed} failed`);
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
