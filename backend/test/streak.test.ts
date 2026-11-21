import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import type { RowDataPacket } from 'mysql2';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}

let auth: typeof import('../src/modules/auth/auth.service');
let gamification: typeof import('../src/modules/gamification/gamification.repository');
let walletService: typeof import('../src/modules/gamification/gamification.service');
let testPool: typeof import('../src/db/pool').pool;
let shieldItemId: number;
const createdEmails: string[] = [];

async function createUser(label: string): Promise<{ id: number; email: string }> {
  const email = `streak-${label}-${randomUUID()}@example.test`;
  createdEmails.push(email);
  const user = await auth.register({ name: `Streak ${label}`, email, password: 'correct-horse-7' });
  return { id: user.id, email };
}

async function row(userId: number): Promise<{
  streak: number;
  streak_lost: number;
  streak_lost_at: Date | null;
  last_activity_date: string | null;
}> {
  const [rows] = await testPool.execute<Array<RowDataPacket & {
    streak: number;
    streak_lost: number;
    streak_lost_at: Date | null;
    last_activity_date: string | null;
  }>>(
    'SELECT streak, streak_lost, streak_lost_at, DATE_FORMAT(last_activity_date, "%Y-%m-%d") AS last_activity_date FROM users WHERE id = ?',
    [userId],
  );
  return rows[0];
}

async function setStreak(userId: number, streak: number, daysAgo: number): Promise<void> {
  await testPool.execute(
    'UPDATE users SET streak = ?, last_activity_date = DATE_SUB(CURDATE(), INTERVAL ? DAY), streak_lost = 0, streak_lost_at = NULL WHERE id = ?',
    [streak, daysAgo, userId],
  );
}

before(async () => {
  const [authService, gamificationRepo, gamificationService, db] = await Promise.all([
    import('../src/modules/auth/auth.service'),
    import('../src/modules/gamification/gamification.repository'),
    import('../src/modules/gamification/gamification.service'),
    import('../src/db/pool'),
  ]);
  auth = authService;
  gamification = gamificationRepo;
  walletService = gamificationService;
  testPool = db.pool;
  const [items] = await testPool.execute<Array<RowDataPacket & { id: number }>>(
    "SELECT id FROM shop_items WHERE code = 'booster_streak_shield' LIMIT 1",
  );
  if (!items[0]) throw new Error('The streak shield item is missing.');
  shieldItemId = Number(items[0].id);
});

after(async () => {
  for (const email of createdEmails) {
    await testPool.execute('DELETE FROM users WHERE email = ?', [email]);
  }
  await testPool.end();
});

test('opening the app after a missed day loses the streak immediately', async () => {
  const user = await createUser('expire');
  await setStreak(user.id, 7, 3);

  const current = await auth.getCurrentUser(user.id);
  assert.equal(current.streak, 0);

  const stored = await row(user.id);
  assert.equal(Number(stored.streak), 0);
  assert.equal(Number(stored.streak_lost), 7);
  assert.ok(stored.streak_lost_at);
});

test('a streak without an activity date cannot claim a free shield bridge', async () => {
  const user = await createUser('no-date');
  await testPool.execute(
    'UPDATE users SET streak = 9, last_activity_date = NULL, streak_lost = 0, streak_lost_at = NULL WHERE id = ?',
    [user.id],
  );
  await testPool.execute(
    "INSERT INTO user_boosters (user_id, item_id, kind, charges) VALUES (?, ?, 'streak_shield', 1)",
    [user.id, shieldItemId],
  );

  await gamification.ensureStreakState(user.id);
  const stored = await row(user.id);
  assert.equal(Number(stored.streak), 0);
  assert.equal(Number(stored.streak_lost), 9);
  assert.equal(await shieldCharges(user.id), 1, 'the shield is not spent for a missing date');
});

test('a shield bridges one missed day and the next activity continues the chain', async () => {
  const user = await createUser('shield');
  await setStreak(user.id, 5, 2);
  await testPool.execute(
    "INSERT INTO user_boosters (user_id, item_id, kind, charges) VALUES (?, ?, 'streak_shield', 1)",
    [user.id, shieldItemId],
  );

  await gamification.ensureStreakState(user.id);
  const afterShield = await row(user.id);
  assert.equal(Number(afterShield.streak), 5);
  assert.equal(Number(afterShield.streak_lost), 0);

  const [boosters] = await testPool.execute<Array<RowDataPacket & { charges: number }>>(
    'SELECT charges FROM user_boosters WHERE user_id = ? AND item_id = ?',
    [user.id, shieldItemId],
  );
  assert.equal(Number(boosters[0].charges), 0);

  await gamification.recordActivityInTx(testPool, user.id, 'answers', null, 1);
  const afterActivity = await row(user.id);
  assert.equal(Number(afterActivity.streak), 6);
});

async function shieldCharges(userId: number): Promise<number> {
  const [rows] = await testPool.execute<Array<RowDataPacket & { charges: number }>>(
    'SELECT COALESCE(SUM(charges), 0) AS charges FROM user_boosters WHERE user_id = ? AND kind = ?',
    [userId, 'streak_shield'],
  );
  return Number(rows[0]?.charges ?? 0);
}

test('one shield cannot cover a four-day gap and is not wasted', async () => {
  const user = await createUser('short-shield');
  await setStreak(user.id, 30, 5);
  await testPool.execute(
    "INSERT INTO user_boosters (user_id, item_id, kind, charges) VALUES (?, ?, 'streak_shield', 1)",
    [user.id, shieldItemId],
  );

  await gamification.ensureStreakState(user.id);
  const stored = await row(user.id);
  assert.equal(Number(stored.streak), 0);
  assert.equal(Number(stored.streak_lost), 30);
  assert.equal(await shieldCharges(user.id), 1, 'insufficient shields stay in the inventory');
});

test('four shields cover four missed days and the next activity continues the chain', async () => {
  const user = await createUser('full-shield');
  await setStreak(user.id, 30, 5);
  await testPool.execute(
    "INSERT INTO user_boosters (user_id, item_id, kind, charges) VALUES (?, ?, 'streak_shield', 4)",
    [user.id, shieldItemId],
  );

  await gamification.ensureStreakState(user.id);
  const afterShield = await row(user.id);
  assert.equal(Number(afterShield.streak), 30);
  assert.equal(await shieldCharges(user.id), 0);

  await gamification.recordActivityInTx(testPool, user.id, 'answers', null, 1);
  const afterActivity = await row(user.id);
  assert.equal(Number(afterActivity.streak), 31);
});

test('activity straight after a gap also spends one shield per missed day', async () => {
  const user = await createUser('direct-shield');
  await setStreak(user.id, 12, 5);
  await testPool.execute(
    "INSERT INTO user_boosters (user_id, item_id, kind, charges) VALUES (?, ?, 'streak_shield', 4)",
    [user.id, shieldItemId],
  );

  await gamification.recordActivityInTx(testPool, user.id, 'answers', null, 1);
  const stored = await row(user.id);
  assert.equal(Number(stored.streak), 13);
  assert.equal(await shieldCharges(user.id), 0);
});

test('same-day activity does not increment the streak', async () => {
  const user = await createUser('same-day');
  await setStreak(user.id, 3, 0);

  await gamification.recordActivityInTx(testPool, user.id, 'answers', null, 1);
  const stored = await row(user.id);
  assert.equal(Number(stored.streak), 3);
});

test('activity after a break restarts at 1 and records the lost streak', async () => {
  const user = await createUser('restart');
  await setStreak(user.id, 4, 5);

  await gamification.recordActivityInTx(testPool, user.id, 'answers', null, 1);
  const stored = await row(user.id);
  assert.equal(Number(stored.streak), 1);
  assert.equal(Number(stored.streak_lost), 4);
  assert.ok(stored.streak_lost_at);
});

test('the wallet exposes the day gap the weekly streak strip draws from', async () => {
  const user = await createUser('gap');
  await setStreak(user.id, 3, 1);

  const wallet = await walletService.getWallet(user.id);
  assert.equal(wallet.last_activity_days_ago, 1);
  assert.equal(wallet.streak, 3);
});
