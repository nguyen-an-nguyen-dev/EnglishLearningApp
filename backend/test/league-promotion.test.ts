import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { Pool } from 'mysql2/promise';

let pool: Pool;
const suffix = randomUUID();
const emails: string[] = [];
const seasonIds: number[] = [];
const seasonCodes: string[] = [];

before(async () => {
  ({ pool } = await import('../src/db/pool'));
});

after(async () => {
  for (const [index, seasonId] of seasonIds.entries()) {
    await pool.execute('DELETE FROM economy_ledger WHERE source_type = ? AND source_id = ?', [
      'season_payout',
      seasonCodes[index],
    ]);
    await pool.execute('DELETE FROM season_payouts WHERE season_id = ?', [seasonId]);
    await pool.execute('DELETE FROM season_standings WHERE season_id = ?', [seasonId]);
    await pool.execute('DELETE FROM seasons WHERE id = ?', [seasonId]);
  }
  for (const email of emails) {
    await pool.execute('DELETE FROM users WHERE email = ?', [email]);
  }
  await pool.end();
});

interface PayoutRow extends RowDataPacket {
  rank: number;
  tier: string;
  user_id: number;
  race_points: number;
}

async function createFinishedSeason(label: string): Promise<number> {
  // Uniqueness must not depend on the label: two tests whose names share a
  // two-letter prefix ("tiers" / "tiny") would otherwise collide on the code.
  // `seasons.code` is varchar(10), so the prefix gets 2 chars and the rest 8.
  const code = `${label.slice(0, 2)}${randomUUID().replace(/-/g, '').slice(0, 8)}`;
  const [created] = await pool.execute<ResultSetHeader>(
    `INSERT INTO seasons (code, starts_at, ends_at, status)
     VALUES (?, DATE_SUB(CURDATE(), INTERVAL 8 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'active')`,
    [code],
  );
  seasonIds.push(created.insertId);
  seasonCodes.push(code);
  return created.insertId;
}

async function createLearner(
  label: string,
  index: number,
  tier: string,
  seasonId: number,
  racePoints: number,
  snapshotTier = tier,
): Promise<number> {
  const email = `${label}-${suffix}-${index}@example.test`;
  emails.push(email);
  const [user] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users (username, email, password_hash, display_name, league_tier)
     VALUES (?, ?, 'x', ?, ?)`,
    [`${label}-${suffix}-${index}`, email, `${label} ${index}`, tier],
  );
  await pool.execute(
    `INSERT INTO season_standings (season_id, user_id, race_points, tier)
     VALUES (?, ?, ?, ?)`,
    [seasonId, user.insertId, racePoints, snapshotTier],
  );
  return user.insertId;
}

test('a twelve-person league promotes the top six and demotes the bottom six', async () => {
  const seasonId = await createFinishedSeason('p');
  const userIds: number[] = [];
  for (let index = 0; index < 12; index += 1) {
    userIds.push(
      // Deliberately stale snapshot. Settlement must read users.league_tier,
      // not this cached column, or a drifted row would demote the wrong tier.
      await createLearner('promo', index, 'silver', seasonId, 1000 - index * 10, 'bronze'),
    );
  }

  const repo = await import('../src/modules/gamification/gamification.repository');
  await repo.ensureCurrentSeason();

  const [payouts] = await pool.execute<PayoutRow[]>(
    'SELECT `rank`, tier, user_id, race_points FROM season_payouts WHERE season_id = ? ORDER BY `rank` ASC',
    [seasonId],
  );
  assert.equal(payouts.length, 12);
  for (const payout of payouts) {
    const expected = payout.rank <= 6 ? 'gold' : 'bronze';
    assert.equal(payout.tier, expected, `rank ${payout.rank}`);
  }

  for (const [index, userId] of userIds.entries()) {
    const carried = await repo.getLeagueTier(pool, userId);
    assert.equal(carried, index < 6 ? 'gold' : 'bronze');
  }

  const [snapshots] = await pool.execute<Array<RowDataPacket & { tier: string }>>(
    'SELECT tier FROM season_standings WHERE season_id = ? ORDER BY user_id ASC',
    [seasonId],
  );
  for (const [index, snapshot] of snapshots.entries()) {
    assert.equal(snapshot.tier, index < 6 ? 'gold' : 'bronze', 'the snapshot follows the persistent tier');
  }
});

test('each tier settles as its own league, with no move at the ladder ends', async () => {
  const seasonId = await createFinishedSeason('tiers');
  const groups = [
    { tier: 'bronze', base: 5000, expected: (rank: number) => (rank <= 6 ? 'silver' : 'bronze') },
    { tier: 'silver', base: 3000, expected: (rank: number) => (rank <= 6 ? 'gold' : 'bronze') },
    // Diamond cannot promote, so its top six slots are not promotions: the
    // leader defends and the bottom six still drop.
    { tier: 'diamond', base: 100, expected: (rank: number) => (rank === 1 ? 'diamond' : 'gold') },
  ] as const;

  const idsByTier = new Map<string, number[]>();
  for (const group of groups) {
    const ids: number[] = [];
    for (let index = 0; index < 7; index += 1) {
      // The bronze group has far more RP than diamond. A global board would
      // rank them together; per-tier settlement must ignore that noise.
      ids.push(await createLearner(group.tier, index, group.tier, seasonId, group.base - index * 10));
    }
    idsByTier.set(group.tier, ids);
  }

  const repo = await import('../src/modules/gamification/gamification.repository');
  await repo.ensureCurrentSeason();

  for (const group of groups) {
    const ids = idsByTier.get(group.tier)!;
    const placeholders = ids.map(() => '?').join(', ');
    const [payouts] = await pool.execute<PayoutRow[]>(
      `SELECT \`rank\`, tier, user_id, race_points FROM season_payouts
        WHERE season_id = ? AND user_id IN (${placeholders})
        ORDER BY \`rank\` ASC`,
      [seasonId, ...ids],
    );
    assert.equal(payouts.length, 7, `${group.tier} pays every scored learner`);
    for (const payout of payouts) {
      assert.equal(payout.tier, group.expected(payout.rank), `${group.tier} rank ${payout.rank}`);
    }

    const carried = await repo.getLeagueTier(pool, ids[0]);
    assert.equal(carried, group.expected(1), `${group.tier} winner carries the new tier`);
  }

  // Rank is local to each league, so three learners can all finish first.
  const [firstPlaces] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM season_payouts WHERE season_id = ? AND `rank` = 1',
    [seasonId],
  );
  assert.equal(Number(firstPlaces[0]?.total ?? 0), groups.length);
});

test('a tiny diamond league still keeps its winner', async () => {
  // Diamond has no promotion block to shield its top, so a naive bottom-six
  // rule would demote the whole board — including whoever just won the week.
  const seasonId = await createFinishedSeason('tiny');
  const ids: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    ids.push(await createLearner('tiny', index, 'diamond', seasonId, 500 - index * 10));
  }

  const repo = await import('../src/modules/gamification/gamification.repository');
  await repo.ensureCurrentSeason();

  const placeholders = ids.map(() => '?').join(', ');
  const [payouts] = await pool.execute<PayoutRow[]>(
    `SELECT \`rank\`, tier, user_id FROM season_payouts
      WHERE season_id = ? AND user_id IN (${placeholders})
      ORDER BY \`rank\` ASC`,
    [seasonId, ...ids],
  );
  assert.equal(payouts.length, 4);
  assert.equal(payouts[0].tier, 'diamond', 'the week winner defends the top tier');
  for (const payout of payouts.slice(1)) {
    assert.equal(payout.tier, 'gold', `rank ${payout.rank} drops as usual`);
  }
  assert.equal(await repo.getLeagueTier(pool, ids[0]), 'diamond');
});
