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

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

let server: Server;
let baseUrl: string;
let adminToken: string;
let learnerToken: string;
let learnerId: number;
let testPool: typeof import('../src/db/pool').pool;
let sharedVideoId: number;
const createdEmails: string[] = [];
const createdShopItemIds: number[] = [];
const createdWordIds: number[] = [];
const createdVocabularyIds: number[] = [];

async function registerUser(name: string): Promise<{ id: number; token: string; email: string }> {
  const email = `catalog-${randomUUID()}@example.test`;
  createdEmails.push(email);
  const registered = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: 'correct-horse-7' }),
  });
  assert.equal(registered.status, 201);
  const body = await registered.json() as Envelope<{ user: { id: number } }>;
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct-horse-7' }),
  });
  assert.equal(login.status, 200);
  const loginBody = await login.json() as Envelope<{ token: string }>;
  return { id: body.data!.user.id, token: loginBody.data!.token, email };
}

async function call<T>(
  path: string,
  token: string | null,
  options: { method?: string; body?: unknown } = {},
): Promise<{ status: number; body: Envelope<T> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: response.status, body: await response.json() as Envelope<T> };
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

  const admin = await registerUser('Catalog Admin');
  const learner = await registerUser('Catalog Learner');
  adminToken = admin.token;
  learnerToken = learner.token;
  learnerId = learner.id;
  await testPool.execute("UPDATE users SET role = 'admin' WHERE id = ?", [admin.id]);

  const [videoRows] = await testPool.execute<Array<RowDataPacket & { id: number }>>(
    'SELECT id FROM video_lessons WHERE owner_user_id IS NULL ORDER BY id ASC LIMIT 1',
  );
  if (!videoRows[0]) throw new Error('A shared video is required for vocabulary tests.');
  sharedVideoId = Number(videoRows[0].id);
});

after(async () => {
  for (const id of createdVocabularyIds) {
    await testPool.execute('DELETE FROM video_vocabulary WHERE id = ?', [id]);
  }
  for (const id of createdWordIds) {
    await testPool.execute('DELETE FROM battle_words WHERE id = ?', [id]);
  }
  for (const id of createdShopItemIds) {
    await testPool.execute('DELETE FROM shop_items WHERE id = ?', [id]);
  }
  for (const email of createdEmails) {
    await testPool.execute('DELETE FROM users WHERE email = ?', [email]);
  }
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await testPool.end();
});

test('catalogue routes require an admin', async () => {
  const anonymous = await call('/api/admin/shop-items', null);
  assert.equal(anonymous.status, 401);

  const learner = await call('/api/admin/shop-items', learnerToken);
  assert.equal(learner.status, 403);
  assert.deepEqual(learner.body.errors, ['ADMIN_REQUIRED']);

  const learnerWords = await call('/api/admin/battle-words', learnerToken);
  assert.equal(learnerWords.status, 403);
});

test('shop items create, list, update, deactivate and delete', async () => {
  const created = await call<{ item: Record<string, unknown> }>('/api/admin/shop-items', adminToken, {
    method: 'POST',
    body: {
      name: `Test Frame ${randomUUID().slice(0, 8)}`,
      description: 'Khung kiểm thử',
      slot: 'frame',
      rarity: 'epic',
      price: 120,
      unlock_type: 'level',
      unlock_value: 3,
      visual_key: `test_frame_${randomUUID().slice(0, 8)}`,
      style: { ring: '#123456', ringDark: '#0F2A3C', accent: '#AAEEFF' },
      active: true,
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const item = created.body.data!.item as {
    id: number; code: string; name: string; price: number; style: Record<string, string>;
    unlock_value: string; active: boolean;
  };
  createdShopItemIds.push(item.id);
  assert.equal(item.price, 120);
  assert.equal(item.unlock_value, '3');
  assert.equal(item.style.ring, '#123456');
  assert.match(item.code, /^test-frame-/);

  const listed = await call<{ items: Array<{ id: number; active: boolean }> }>('/api/admin/shop-items', adminToken);
  assert.equal(listed.status, 200);
  assert.ok(listed.body.data!.items.some((entry) => entry.id === item.id));

  const patched = await call<{ item: { price: number; active: boolean } }>(
    `/api/admin/shop-items/${item.id}`,
    adminToken,
    { method: 'PATCH', body: { price: 150, active: false, unlock_type: 'default', unlock_value: null } },
  );
  assert.equal(patched.status, 200);
  assert.equal(patched.body.data!.item.price, 150);
  assert.equal(patched.body.data!.item.active, false);

  const removed = await call<{ deleted: boolean }>(`/api/admin/shop-items/${item.id}`, adminToken, {
    method: 'DELETE',
  });
  assert.equal(removed.status, 200);
  createdShopItemIds.splice(createdShopItemIds.indexOf(item.id), 1);

  const listedAgain = await call<{ items: Array<{ id: number }> }>('/api/admin/shop-items', adminToken);
  assert.ok(!listedAgain.body.data!.items.some((entry) => entry.id === item.id));

  // Auto-generated keys use hyphens; an edit that echoes the key back must be
  // accepted (the admin form always sends every field).
  const auto = await call<{ item: { id: number; visual_key: string; code: string } }>(
    '/api/admin/shop-items',
    adminToken,
    {
      method: 'POST',
      body: {
        name: `Auto Key ${randomUUID().slice(0, 6)}`,
        slot: 'frame',
        rarity: 'common',
        price: 0,
        unlock_type: 'default',
      },
    },
  );
  assert.equal(auto.status, 201, JSON.stringify(auto.body));
  const autoItem = auto.body.data!.item;
  createdShopItemIds.push(autoItem.id);
  assert.match(autoItem.visual_key, /^auto-key-/);
  assert.match(autoItem.code, /^auto-key-/);

  const autoPatch = await call<{ item: { visual_key: string; price: number } }>(
    `/api/admin/shop-items/${autoItem.id}`,
    adminToken,
    { method: 'PATCH', body: { visual_key: autoItem.visual_key, price: 5 } },
  );
  assert.equal(autoPatch.status, 200, JSON.stringify(autoPatch.body));
  assert.equal(autoPatch.body.data!.item.price, 5);

  const autoRemoved = await call(`/api/admin/shop-items/${autoItem.id}`, adminToken, { method: 'DELETE' });
  assert.equal(autoRemoved.status, 200);
  createdShopItemIds.splice(createdShopItemIds.indexOf(autoItem.id), 1);
});

test('shop item validation rejects bad unlock and booster combinations', async () => {
  const missingName = await call('/api/admin/shop-items', adminToken, {
    method: 'POST',
    body: { slot: 'car', slotInvalid: true },
  });
  assert.equal(missingName.status, 422);

  const badUnlock = await call('/api/admin/shop-items', adminToken, {
    method: 'POST',
    body: {
      name: 'Bad Unlock', slot: 'car', rarity: 'rare', price: 10,
      unlock_type: 'level', unlock_value: 'not-a-number',
    },
  });
  assert.equal(badUnlock.status, 422);

  const badBooster = await call('/api/admin/shop-items', adminToken, {
    method: 'POST',
    body: {
      name: 'Bad Booster', slot: 'booster', rarity: 'rare', price: 10,
      unlock_type: 'default', booster_kind: null,
    },
  });
  assert.equal(badBooster.status, 422);
});

test('an admin-created booster is purchasable without a code map', async () => {
  const created = await call<{ item: { id: number } }>('/api/admin/shop-items', adminToken, {
    method: 'POST',
    body: {
      name: `Test XP Booster ${randomUUID().slice(0, 6)}`,
      description: 'Booster dựng từ DB',
      slot: 'booster',
      rarity: 'rare',
      price: 1,
      unlock_type: 'default',
      booster_kind: 'xp_multiplier',
      booster_charges: 0,
      booster_duration_minutes: 5,
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const itemId = created.body.data!.item.id;
  createdShopItemIds.push(itemId);

  await testPool.execute('UPDATE users SET coins = 10 WHERE id = ?', [learnerId]);
  try {
    const purchased = await call<{ item: { active_until: string | null } }>(
      `/api/shop/items/${itemId}/purchase`,
      learnerToken,
      { method: 'POST' },
    );
    assert.equal(purchased.status, 201, JSON.stringify(purchased.body));
    assert.ok(purchased.body.data!.item.active_until);

    const [rows] = await testPool.execute<Array<RowDataPacket & { kind: string; expires_at: Date }>>(
      'SELECT kind, expires_at FROM user_boosters WHERE user_id = ? AND item_id = ?',
      [learnerId, itemId],
    );
    assert.equal(rows[0]?.kind, 'xp_multiplier');
    assert.ok(rows[0] && new Date(rows[0].expires_at).getTime() > Date.now());
  } finally {
    await testPool.execute('DELETE FROM user_boosters WHERE user_id = ? AND item_id = ?', [learnerId, itemId]);
    await testPool.execute('UPDATE users SET coins = 0 WHERE id = ?', [learnerId]);
  }
});

test('arena vocabulary CRUD is data-driven and unique', async () => {
  const wordEn = `testword${randomUUID().slice(0, 6)}`;
  const created = await call<{ word: { id: number; word_en: string; cefr_level: string } }>(
    '/api/admin/battle-words',
    adminToken,
    {
      method: 'POST',
      body: {
        word_en: wordEn,
        translation_vi: 'từ kiểm thử',
        part_of_speech: 'noun',
        cefr_level: 'A2',
        explanation_vi: 'Một từ dùng cho bài kiểm thử.',
        example_en: `The ${wordEn} is useful.`,
        example_vi: 'Từ này hữu ích.',
        image_url: null,
      },
    },
  );
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const word = created.body.data!.word;
  createdWordIds.push(word.id);
  assert.equal(word.word_en, wordEn);

  const duplicate = await call('/api/admin/battle-words', adminToken, {
    method: 'POST',
    body: {
      word_en: wordEn,
      translation_vi: 'trùng',
      part_of_speech: 'noun',
      cefr_level: 'A2',
      explanation_vi: 'Trùng.',
      example_en: 'Duplicate.',
      example_vi: 'Trùng.',
    },
  });
  assert.equal(duplicate.status, 409);
  assert.deepEqual(duplicate.body.errors, ['WORD_TAKEN']);

  const patched = await call<{ word: { translation_vi: string; cefr_level: string } }>(
    `/api/admin/battle-words/${word.id}`,
    adminToken,
    { method: 'PATCH', body: { translation_vi: 'nghĩa mới', cefr_level: 'B1' } },
  );
  assert.equal(patched.status, 200);
  assert.equal(patched.body.data!.word.translation_vi, 'nghĩa mới');
  assert.equal(patched.body.data!.word.cefr_level, 'B1');

  const listed = await call<{ words: Array<{ id: number }> }>('/api/admin/battle-words', adminToken);
  assert.ok(listed.body.data!.words.some((entry) => entry.id === word.id));

  const removed = await call(`/api/admin/battle-words/${word.id}`, adminToken, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  createdWordIds.splice(createdWordIds.indexOf(word.id), 1);
});

test('video vocabulary CRUD works for shared videos only', async () => {
  const word = `videoword${randomUUID().slice(0, 6)}`;
  const created = await call<{ vocabulary: { id: number; word: string; meaning_vi: string } }>(
    `/api/admin/videos/${sharedVideoId}/vocabulary`,
    adminToken,
    {
      method: 'POST',
      body: {
        word,
        ipa: '/test/',
        meaning_vi: 'nghĩa kiểm thử',
        detail_vi: 'Chi tiết kiểm thử.',
      },
    },
  );
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const entry = created.body.data!.vocabulary;
  createdVocabularyIds.push(entry.id);

  const duplicate = await call(`/api/admin/videos/${sharedVideoId}/vocabulary`, adminToken, {
    method: 'POST',
    body: { word, meaning_vi: 'trùng', detail_vi: 'trùng' },
  });
  assert.equal(duplicate.status, 409);
  assert.deepEqual(duplicate.body.errors, ['WORD_TAKEN']);

  const patched = await call<{ vocabulary: { meaning_vi: string } }>(
    `/api/admin/video-vocabulary/${entry.id}`,
    adminToken,
    { method: 'PATCH', body: { meaning_vi: 'nghĩa đã sửa' } },
  );
  assert.equal(patched.status, 200);
  assert.equal(patched.body.data!.vocabulary.meaning_vi, 'nghĩa đã sửa');

  const missingVideo = await call('/api/admin/videos/99999999/vocabulary', adminToken);
  assert.equal(missingVideo.status, 404);

  const removed = await call(`/api/admin/video-vocabulary/${entry.id}`, adminToken, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  createdVocabularyIds.splice(createdVocabularyIds.indexOf(entry.id), 1);
});
