import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import type { RowDataPacket } from 'mysql2';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}

let server: Server;
let baseUrl: string;
let email: string;
let token: string;
let userId: number;
let testPool: typeof import('../src/db/pool').pool;

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

before(async () => {
  const [{ app }, db] = await Promise.all([
    import('../src/app'),
    import('../src/db/pool'),
  ]);
  testPool = db.pool;
  server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server failed to bind.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  email = `video-test-${randomUUID()}@example.test`;

  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Video Test', email, password: 'correct-horse-7' }),
  });
  assert.equal(register.status, 201);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct-horse-7' }),
  });
  assert.equal(login.status, 200);
  const body = await login.json() as ApiEnvelope<{ token: string; user: { id: number } }>;
  token = body.data.token;
  userId = body.data.user.id;
});

after(async () => {
  if (email) await testPool.execute('DELETE FROM users WHERE email = ?', [email]);
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await testPool.end();
});

function authHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

test('the landing demo needs no account and only leaks a bounded preview', async () => {
  // No Authorization header on purpose: this is what a visitor sees first.
  const response = await fetch(`${baseUrl}/api/demo/video`);
  assert.equal(response.status, 200);
  const body = await response.json() as ApiEnvelope<{
    video: {
      id: number;
      title: string;
      duration_seconds: number;
      provider: string;
      demo_segment_limit: number;
      total_segments: number;
      segments: Array<Record<string, unknown>>;
    } | null;
  }>;

  const demo = body.data.video;
  assert.ok(demo, 'The seeded library must offer a previewable video.');
  assert.ok(demo.title.length > 0);
  assert.equal(demo.provider, 'youtube');
  assert.ok(demo.duration_seconds > 0);
  assert.ok(demo.demo_segment_limit > 0);

  // Bounded preview: never the whole transcript.
  assert.ok(demo.segments.length > 0, 'The preview needs at least one segment.');
  assert.ok(demo.segments.length <= demo.demo_segment_limit);
  assert.ok(
    demo.total_segments >= demo.segments.length,
    'total_segments reports how much is still locked.',
  );

  for (const segment of demo.segments) {
    assert.equal(typeof segment.text_en, 'string');
    assert.ok((segment.text_en as string).length > 0);
    // The Vietnamese translation and the answer key stay behind the login.
    assert.equal('text_vi' in segment, false, 'The preview must not ship translations.');
  }

  // It is the shortest playable shared video, so the visitor sees a short round.
  const list = await fetch(`${baseUrl}/api/videos`, { headers: authHeaders() })
    .then((result) => result.json()) as ApiEnvelope<{
      videos: Array<{ id: number; duration_seconds: number }>;
    }>;
  const sharedDurations = list.data.videos
    .filter((video) => video.duration_seconds > 0)
    .map((video) => video.duration_seconds);
  assert.ok(
    demo.duration_seconds <= Math.min(...sharedDurations),
    'The demo must be the shortest video in the shared library.',
  );
});

test('video catalogue exposes progress for the signed-in learner', async () => {  const response = await fetch(`${baseUrl}/api/videos`, { headers: authHeaders() });
  assert.equal(response.status, 200);
  const body = await response.json() as ApiEnvelope<{ videos: Array<Record<string, unknown>> }>;
  assert.ok(body.data.videos.length >= 3, 'Seed at least three video lessons.');
  const first = body.data.videos[0];
  assert.equal(first.progress, null);
  assert.equal(first.is_owned, false);

  const detailResponse = await fetch(`${baseUrl}/api/videos/${first.id}`, { headers: authHeaders() });
  assert.equal(detailResponse.status, 200);
  const detail = await detailResponse.json() as ApiEnvelope<{
    video: { segments: unknown[]; subtitle_en: string | null };
  }>;
  assert.ok(detail.data.video.segments.length > 0, 'Every library video needs caption segments.');
  assert.ok((detail.data.video.subtitle_en ?? '').length > 0);
});

test('watching part of a video stores progress, completing it awards XP once', async () => {
  const listResponse = await fetch(`${baseUrl}/api/videos`, { headers: authHeaders() });
  const list = await listResponse.json() as ApiEnvelope<{
    videos: Array<{ id: number; duration_seconds: number }>;
  }>;
  const video = list.data.videos[0];
  assert.ok(video.duration_seconds > 0);

  const partialWatched = Math.floor(video.duration_seconds / 2);
  const partial = await fetch(`${baseUrl}/api/videos/${video.id}/progress`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ watchedSeconds: partialWatched }),
  });
  assert.equal(partial.status, 200);
  const partialBody = await partial.json() as ApiEnvelope<{
    completed: boolean;
    progress: { watched_seconds: number };
  }>;
  assert.equal(partialBody.data.completed, false);
  assert.equal(partialBody.data.progress.watched_seconds, partialWatched);

  const complete = await fetch(`${baseUrl}/api/videos/${video.id}/complete`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ watchedSeconds: video.duration_seconds }),
  });
  assert.equal(complete.status, 200);
  const completeBody = await complete.json() as ApiEnvelope<{
    completed: boolean;
    already_completed: boolean;
    xp_earned: number;
    progress: { completed: boolean };
  }>;
  assert.equal(completeBody.data.completed, true);
  assert.equal(completeBody.data.already_completed, false);
  assert.ok(completeBody.data.xp_earned > 0);
  assert.equal(completeBody.data.progress.completed, true);

  const repeat = await fetch(`${baseUrl}/api/videos/${video.id}/complete`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ watchedSeconds: video.duration_seconds }),
  });
  const repeatBody = await repeat.json() as ApiEnvelope<{
    already_completed: boolean;
    xp_earned: number;
  }>;
  assert.equal(repeatBody.data.already_completed, true);
  assert.equal(repeatBody.data.xp_earned, 0);

  interface XpRow extends RowDataPacket { xp: number }
  const [xpRows] = await testPool.execute<XpRow[]>('SELECT xp FROM users WHERE id = ?', [userId]);
  assert.ok(Number(xpRows[0].xp) >= completeBody.data.xp_earned);
});

test('completing a video before watching enough is rejected', async () => {
  const listResponse = await fetch(`${baseUrl}/api/videos`, { headers: authHeaders() });
  const list = await listResponse.json() as ApiEnvelope<{
    videos: Array<{ id: number; duration_seconds: number }>;
  }>;
  const video = list.data.videos[1];
  const response = await fetch(`${baseUrl}/api/videos/${video.id}/complete`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ watchedSeconds: 0 }),
  });
  assert.equal(response.status, 422);
});

test('YouTube import rejects invalid links and curated lessons cannot be deleted', async () => {
  const invalid = await fetch(`${baseUrl}/api/videos/import`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ url: 'not a youtube link' }),
  });
  assert.equal(invalid.status, 400);
  const invalidBody = await invalid.json() as ApiEnvelope<unknown> & { errors: string[] };
  assert.ok(invalidBody.errors.includes('INVALID_YOUTUBE_URL'));

  const list = await fetch(`${baseUrl}/api/videos`, { headers: authHeaders() })
    .then((response) => response.json()) as ApiEnvelope<{ videos: Array<{ id: number }> }>;
  const remove = await fetch(`${baseUrl}/api/videos/${list.data.videos[0].id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  assert.equal(remove.status, 404);
});

test('saved vocabulary can be added, listed, and removed', async () => {
  const videoList = await fetch(`${baseUrl}/api/videos`, { headers: authHeaders() })
    .then((response) => response.json()) as ApiEnvelope<{ videos: Array<{ id: number }> }>;
  const save = await fetch(`${baseUrl}/api/vocabulary`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      word: 'natural',
      ipa: '/ˈnætʃ.ər.əl/',
      meaningVi: 'tự nhiên',
      detailVi: 'Tính từ: trôi chảy.',
      videoId: videoList.data.videos[0].id,
    }),
  });
  assert.equal(save.status, 201);

  const listResponse = await fetch(`${baseUrl}/api/vocabulary`, { headers: authHeaders() });
  const list = await listResponse.json() as ApiEnvelope<{ words: Array<{ word: string }> }>;
  assert.ok(list.data.words.some((entry) => entry.word === 'natural'));

  const remove = await fetch(`${baseUrl}/api/vocabulary/${encodeURIComponent('natural')}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  assert.equal(remove.status, 200);

  const afterRemove = await fetch(`${baseUrl}/api/vocabulary`, { headers: authHeaders() });
  const afterBody = await afterRemove.json() as ApiEnvelope<{ words: Array<{ word: string }> }>;
  assert.equal(afterBody.data.words.some((entry) => entry.word === 'natural'), false);
});
