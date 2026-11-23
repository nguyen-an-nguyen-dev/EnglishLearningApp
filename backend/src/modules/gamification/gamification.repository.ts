import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../db/pool';
import { LEAGUE_TIERS, leagueTierQueryValues, normalizeLeagueTier } from './gamification.types';
import type {
  ActivityKind,
  BoosterKind,
  BoosterStock,
  EquipmentView,
  GrantOutcome,
  LedgerEntry,
  LeagueTier,
  QuestMetric,
  QuestRow,
  ShopItemRow,
} from './gamification.types';

/** Either the shared pool or a connection that already holds a transaction. */
type Executor = Pool | PoolConnection;

/** One step up/down at season settlement; the ends of the ladder stay put. */
export function promoteTier(tier: LeagueTier): LeagueTier {
  return LEAGUE_TIERS[Math.min(LEAGUE_TIERS.indexOf(tier) + 1, LEAGUE_TIERS.length - 1)] ?? 'coal';
}

export function demoteTier(tier: LeagueTier): LeagueTier {
  return LEAGUE_TIERS[Math.max(LEAGUE_TIERS.indexOf(tier) - 1, 0)] ?? 'coal';
}

export async function getLeagueTier(
  executor: Executor,
  userId: number,
): Promise<LeagueTier> {
  const [rows] = await executor.execute<Array<RowDataPacket & { league_tier: LeagueTier }>>(
    'SELECT league_tier FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  return normalizeLeagueTier(rows[0]?.league_tier);
}

// Write ledger entries for one user inside the caller's transaction. Idempotency
// lives in the unique key `(user_id, currency, source_type, source_id)`, so
// replaying a lesson or match never double-pays.
export async function grantInTx(
  executor: Executor,
  userId: number,
  entries: LedgerEntry[],
): Promise<GrantOutcome> {
  const granted: LedgerEntry[] = [];
  let rcEarned = 0;
  let xpEarned = 0;
  let rpEarned = 0;

  // The 30-minute XP card is global to the account, so it is applied here once
  // rather than in every reward source. The doubled amount is what lands in the
  // ledger, which keeps the idempotency key doing its job on replays.
  const xpMultiplier = entries.some((entry) => entry.currency === 'xp')
    ? (await hasActiveXpBoost(executor, userId) ? 2 : 1)
    : 1;

  for (const entry of entries) {
    if (!Number.isFinite(entry.amount) || entry.amount === 0) continue;
    const amount = entry.currency === 'xp' ? entry.amount * xpMultiplier : entry.amount;
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT IGNORE INTO economy_ledger (user_id, currency, amount, source_type, source_id)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, entry.currency, amount, entry.sourceType, entry.sourceId],
    );
    if (result.affectedRows === 0) continue;
    granted.push({ ...entry, amount });

    if (entry.currency === 'rc') {
      rcEarned += amount;
      await executor.execute('UPDATE users SET coins = coins + ? WHERE id = ?', [amount, userId]);
    } else if (entry.currency === 'xp') {
      xpEarned += amount;
      await executor.execute('UPDATE users SET xp = xp + ? WHERE id = ?', [amount, userId]);
    } else {
      rpEarned += amount;
    }
  }

  if (rpEarned > 0) {
    const seasonId = await getActiveSeasonIdInTx(executor);
    if (seasonId !== null) {
      await addRacePoints(executor, seasonId, userId, rpEarned);
    }
  }

  return { granted, rcEarned, xpEarned, rpEarned };
}

// Log one activity. `refId` makes the event once-only (lesson 12, match 88);
// counter kinds such as `answers` pass null and simply append. Streak is touched
// in the same call so `users.streak` tracks: same day keeps it, yesterday
// increments, anything older resets to 1.
export async function recordActivityInTx(
  executor: Executor,
  userId: number,
  kind: ActivityKind,
  refId: string | null = null,
  amount = 1,
): Promise<void> {
  await executor.execute<ResultSetHeader>(
    `INSERT IGNORE INTO activity_events (user_id, kind, ref_id, amount)
     VALUES (?, ?, ?, ?)`,
    [userId, kind, refId, amount],
  );
  await touchStreakInTx(executor, userId);
}

// The whole streak decision is made in SQL (`CURDATE()` / `DATE_SUB`): mysql2
// hands back a Date object for DATE fields and `String(date)` yields "Sun Nov 15"
// which MySQL rejects, so no JS Date-to-string conversion is allowed here.
async function touchStreakInTx(executor: Executor, userId: number): Promise<void> {
  const [rows] = await executor.execute<Array<RowDataPacket & {
    streak: number;
    is_today: number;
    is_yesterday: number;
    gap: number | null;
  }>>(
    `SELECT streak,
            (last_activity_date = CURDATE()) AS is_today,
            (last_activity_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)) AS is_yesterday,
            DATEDIFF(CURDATE(), last_activity_date) AS gap
     FROM users WHERE id = ? FOR UPDATE`,
    [userId],
  );
  const row = rows[0];
  if (!row) return;
  if (Number(row.is_today) === 1) return;

  if (Number(row.is_yesterday) === 1) {
    await executor.execute(
      'UPDATE users SET streak = streak + 1, last_activity_date = CURDATE() WHERE id = ?',
      [userId],
    );
    return;
  }

  // The chain broke. Each missed day needs its own shield. If the learner has
  // enough, today's real activity continues the chain with +1; otherwise a
  // partial set of shields is left untouched and the streak restarts.
  const streak = Number(row.streak);
  const needed = Math.max(0, Number(row.gap ?? 0) - 1);
  const shielded = streak > 0 && needed > 0
    && await spendStreakShields(executor, userId, needed);
  if (shielded) {
    await executor.execute(
      'UPDATE users SET streak = streak + 1, last_activity_date = CURDATE() WHERE id = ?',
      [userId],
    );
    return;
  }

  if (streak > 0) {
    await executor.execute(
      `UPDATE users
          SET streak = 1, last_activity_date = CURDATE(),
              streak_lost = ?, streak_lost_at = CURDATE()
        WHERE id = ?`,
      [Number(row.streak), userId],
    );
  } else {
    await executor.execute(
      'UPDATE users SET streak = 1, last_activity_date = CURDATE() WHERE id = ?',
      [userId],
    );
  }
}

// Lazy streak expiry: opening the app after a missed day must show the loss
// immediately, not only after the next lesson. Each missed day costs one shield
// charge; without enough shields the streak becomes 0 and the previous value is
// kept for the "lost streak" notice.
export async function ensureStreakState(userId: number): Promise<void> {
  // Cheap unlocked read first: most requests are inside the two-day window and
  // should not take a row lock.
  const [previewRows] = await pool.execute<Array<RowDataPacket & {
    streak: number;
    gap: number | null;
  }>>(
    `SELECT streak, DATEDIFF(CURDATE(), last_activity_date) AS gap
       FROM users WHERE id = ? LIMIT 1`,
    [userId],
  );
  const preview = previewRows[0];
  if (!preview) return;
  const previewGap = preview.gap === null ? null : Number(preview.gap);
  if (Number(preview.streak) <= 0 || (previewGap !== null && previewGap <= 1)) return;

  const connection: PoolConnection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<Array<RowDataPacket & {
      streak: number;
      gap: number | null;
    }>>(
      `SELECT streak, DATEDIFF(CURDATE(), last_activity_date) AS gap
         FROM users WHERE id = ? FOR UPDATE`,
      [userId],
    );
    const row = rows[0];
    if (!row) {
      await connection.rollback();
      return;
    }
    const streak = Number(row.streak);
    const gap = row.gap === null ? null : Number(row.gap);
    if (streak <= 0 || (gap !== null && gap <= 1)) {
      await connection.commit();
      return;
    }

    const needed = Math.max(0, Number(gap ?? 0) - 1);
    // Duolingo-style: one charge per missed day. Insufficient shields are not
    // spent at all, so a learner does not lose the ones they kept. A user with
    // no recorded activity date cannot claim a free bridge (needed === 0).
    const shielded = needed > 0 && await spendStreakShields(connection, userId, needed);
    if (shielded) {
      // Treat the covered days as if the chain only paused until yesterday, so
      // the next real activity continues the same streak.
      await connection.execute(
        'UPDATE users SET last_activity_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE id = ?',
        [userId],
      );
    } else {
      await connection.execute(
        `UPDATE users
            SET streak = 0, streak_lost = ?, streak_lost_at = CURDATE()
          WHERE id = ?`,
        [streak, userId],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

interface SeasonRow extends RowDataPacket {
  id: number;
  code: string;
  starts_at: Date;
  ends_at: Date;
  status: 'active' | 'closed' | 'paid';
}

function isoWeekCode(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function weekBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function toSqlDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function getActiveSeasonIdInTx(executor: Executor): Promise<number | null> {
  const [rows] = await executor.execute<SeasonRow[]>(
    "SELECT id, code, starts_at, ends_at, status FROM seasons WHERE status = 'active' ORDER BY starts_at DESC LIMIT 1",
  );
  const row = rows[0];
  if (row && new Date(row.ends_at).getTime() > Date.now()) return row.id;
  // Nothing running (or the window lapsed): the settlement path is heavier, so
  // it is handled by ensureCurrentSeason on the next API read, not mid-grant.
  return row?.id ?? null;
}

async function addRacePoints(
  executor: Executor,
  seasonId: number,
  userId: number,
  points: number,
): Promise<void> {
  const [rows] = await executor.execute<RowDataPacket[]>(
    'SELECT race_points FROM season_standings WHERE season_id = ? AND user_id = ? LIMIT 1',
    [seasonId, userId],
  );
  const current = Number(rows[0]?.race_points ?? 0);
  const next = current + points;
  // Tier is carried from the last settlement, not derived from weekly RP.
  const tier = await getLeagueTier(executor, userId);
  await executor.execute(
    `INSERT INTO season_standings (season_id, user_id, race_points, tier)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE race_points = VALUES(race_points), tier = VALUES(tier)`,
    [seasonId, userId, next, tier],
  );
}

export async function bumpStandingCounter(
  executor: Executor,
  userId: number,
  column: 'lessons' | 'videos' | 'duel_wins',
): Promise<void> {
  const seasonId = await getActiveSeasonIdInTx(executor);
  if (seasonId === null) return;
  await executor.execute(
    `INSERT INTO season_standings (season_id, user_id, ${column}, tier)
     VALUES (?, ?, 1, (SELECT league_tier FROM users WHERE id = ?))
     ON DUPLICATE KEY UPDATE ${column} = ${column} + 1`,
    [seasonId, userId, userId],
  );
}

const PAYOUT_RC: Record<LeagueTier, number> = {
  coal: 60, copper: 110, iron: 170, gold: 250, redstone: 330, diamond: 520,
};
const PAYOUT_XP: Record<LeagueTier, number> = {
  coal: 15, copper: 25, iron: 40, gold: 60, redstone: 80, diamond: 130,
};

// Settle every finished season that has not been paid yet, then make sure a
// season is running for the current week. Payouts go through the ledger, so a
// repeated call (or two racing requests) can only ever pay once.
export async function ensureCurrentSeason(): Promise<number> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [stale] = await connection.execute<SeasonRow[]>(
      `SELECT id, code, starts_at, ends_at, status FROM seasons
       WHERE status <> 'paid' AND ends_at <= NOW() ORDER BY ends_at ASC FOR UPDATE`,
    );

    for (const season of stale) {
      await settleSeason(connection, season);
    }

    const [open] = await connection.execute<SeasonRow[]>(
      "SELECT id, code, starts_at, ends_at, status FROM seasons WHERE status = 'active' AND ends_at > NOW() ORDER BY starts_at DESC LIMIT 1",
    );
    if (open[0]) {
      await connection.commit();
      return open[0].id;
    }

    const now = new Date();
    const { start, end } = weekBounds(now);
    await connection.execute(
      `INSERT INTO seasons (code, starts_at, ends_at, status)
       VALUES (?, ?, ?, 'active')
       ON DUPLICATE KEY UPDATE
         id = LAST_INSERT_ID(id),
         starts_at = VALUES(starts_at),
         ends_at = VALUES(ends_at),
         -- Never revive a season that was already paid out: its standings were
         -- settled, so flipping it back to active would replay that window.
         status = IF(status = 'paid', status, 'active')`,
      [isoWeekCode(now), toSqlDate(start), toSqlDate(end)],
    );
    const [created] = await connection.execute<SeasonRow[]>(
      "SELECT id, code, starts_at, ends_at, status FROM seasons WHERE status = 'active' ORDER BY starts_at DESC LIMIT 1",
    );
    await connection.commit();
    return created[0]?.id ?? 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

interface StandingRow extends RowDataPacket {
  user_id: number;
  race_points: number;
  tier: LeagueTier;
}

/** The weekly league moves the top three up and the bottom three down. */
export const LEAGUE_PROMOTION_SLOTS = 3;
export const LEAGUE_DEMOTION_SLOTS = 3;

async function settleSeason(connection: PoolConnection, season: SeasonRow): Promise<void> {
  // The persistent tier is the source of truth. The snapshot on the standing row
  // is only a display cache, so a stale snapshot must never decide movement.
  const [standings] = await connection.execute<StandingRow[]>(
    `SELECT st.user_id, st.race_points, u.league_tier AS tier
       FROM season_standings st
       JOIN users u ON u.id = st.user_id
      WHERE st.season_id = ? AND st.race_points > 0
      ORDER BY st.race_points DESC, st.user_id ASC`,
    [season.id],
  );

  // Every tier is its own league. A learner is ranked only against the people
  // who share their tier, so promotion/demotion slots are decided per group.
  const byTier = new Map<LeagueTier, StandingRow[]>();
  for (const standing of standings) {
    const carried = normalizeLeagueTier(standing.tier);
    const group = byTier.get(carried);
    if (group) group.push(standing);
    else byTier.set(carried, [standing]);
  }

  for (const [carried, group] of byTier) {
    // Promotion wins when a short group makes the zones overlap. The ends of
    // the ladder have nowhere to go: diamond has no promotion slots (so its
    // bottom three drop) and coal has no demotion slots.
    const promoteEnd = carried === 'diamond'
      ? 0
      : Math.min(LEAGUE_PROMOTION_SLOTS, group.length);
    // The week's leader is never demoted. Diamond has no promotion block to
    // shield its top, so on a board of four or fewer the bottom-three rule would
    // otherwise send the winner down with everyone else.
    const demoteCount = carried === 'coal'
      ? 0
      : Math.min(
          Math.max(0, group.length - Math.max(promoteEnd, group.length - LEAGUE_DEMOTION_SLOTS)),
          Math.max(0, group.length - 1),
        );
    const demoteFrom = group.length - demoteCount + 1;
    for (const [index, standing] of group.entries()) {
      const rank = index + 1;
      const tier = rank <= promoteEnd
        ? promoteTier(carried)
        : rank >= demoteFrom
          ? demoteTier(carried)
          : carried;
      const rankBonus = rank === 1 ? 100 : rank === 2 ? 60 : rank === 3 ? 30 : 0;
      const rc = PAYOUT_RC[tier] + rankBonus;
      const xp = PAYOUT_XP[tier];

      const [payout] = await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO season_payouts
           (season_id, user_id, tier, \`rank\`, race_points, rc_awarded, xp_awarded)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [season.id, standing.user_id, tier, rank, standing.race_points, rc, xp],
      );
      if (payout.affectedRows === 0) continue;

      // Carry the new tier into the next season instead of resetting to coal.
      await connection.execute(
        'UPDATE season_standings SET tier = ? WHERE season_id = ? AND user_id = ?',
        [tier, season.id, standing.user_id],
      );
      await connection.execute(
        'UPDATE users SET league_tier = ? WHERE id = ?',
        [tier, standing.user_id],
      );

      await grantInTx(connection, standing.user_id, [
        { currency: 'rc', amount: rc, sourceType: 'season_payout', sourceId: season.code },
        { currency: 'xp', amount: xp, sourceType: 'season_payout', sourceId: season.code },
      ]);
    }
  }

  await connection.execute("UPDATE seasons SET status = 'paid' WHERE id = ?", [season.id]);
}

export async function getSeasonRow(seasonId: number): Promise<SeasonRow | undefined> {
  const [rows] = await pool.execute<SeasonRow[]>(
    'SELECT id, code, starts_at, ends_at, status FROM seasons WHERE id = ? LIMIT 1',
    [seasonId],
  );
  return rows[0];
}

export interface BalanceRow extends RowDataPacket {
  xp: number;
  coins: number;
  streak: number;
  streak_lost: number;
  streak_lost_at: Date | null;
  /** Persistent league tier, carried across seasons. */
  league_tier: LeagueTier;
  /** Whole days between the last activity date and today; null when never active. */
  last_activity_days_ago: number | null;
}

export async function getBalance(userId: number): Promise<BalanceRow | undefined> {
  const [rows] = await pool.execute<BalanceRow[]>(
    `SELECT xp, coins, streak, streak_lost, streak_lost_at, league_tier,
            DATEDIFF(CURDATE(), last_activity_date) AS last_activity_days_ago
       FROM users WHERE id = ? LIMIT 1`,
    [userId],
  );
  return rows[0];
}

export async function getRacePoints(seasonId: number, userId: number): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT race_points FROM season_standings WHERE season_id = ? AND user_id = ? LIMIT 1',
    [seasonId, userId],
  );
  return Number(rows[0]?.race_points ?? 0);
}

export async function listShopItems(): Promise<ShopItemRow[]> {
  const [rows] = await pool.execute<ShopItemRow[]>(
    `SELECT id, code, name, description, slot, rarity, price, unlock_type, unlock_value,
            visual_key, style_json, booster_kind, booster_charges, booster_duration_minutes,
            sort_order
     FROM shop_items WHERE active = 1 ORDER BY sort_order ASC, id ASC`,
  );
  return rows;
}

export async function getShopItem(itemId: number): Promise<ShopItemRow | undefined> {
  const [rows] = await pool.execute<ShopItemRow[]>(
    `SELECT id, code, name, description, slot, rarity, price, unlock_type, unlock_value,
            visual_key, style_json, booster_kind, booster_charges, booster_duration_minutes,
            sort_order
     FROM shop_items WHERE id = ? AND active = 1 LIMIT 1`,
    [itemId],
  );
  return rows[0];
}

export async function findShopItemByCode(
  executor: Executor,
  code: string,
): Promise<ShopItemRow | undefined> {
  const [rows] = await executor.execute<ShopItemRow[]>(
    `SELECT id, code, name, description, slot, rarity, price, unlock_type, unlock_value,
            visual_key, style_json, booster_kind, booster_charges, booster_duration_minutes,
            sort_order
     FROM shop_items WHERE code = ? AND active = 1 LIMIT 1`,
    [code],
  );
  return rows[0];
}

export async function getOwnedItemIds(userId: number): Promise<Set<number>> {
  const [rows] = await pool.execute<Array<RowDataPacket & { item_id: number }>>(
    'SELECT item_id FROM user_inventory WHERE user_id = ?',
    [userId],
  );
  return new Set(rows.map((row) => Number(row.item_id)));
}

export async function getEquipmentIds(userId: number): Promise<Map<string, number>> {
  const [rows] = await pool.execute<Array<RowDataPacket & { slot: string; item_id: number }>>(
    'SELECT slot, item_id FROM user_equipment WHERE user_id = ?',
    [userId],
  );
  return new Map(rows.map((row) => [String(row.slot), Number(row.item_id)]));
}

export async function countOwnedItems(userId: number): Promise<number> {
  const [rows] = await pool.execute<Array<RowDataPacket & { total: number }>>(
    'SELECT COUNT(*) AS total FROM user_inventory WHERE user_id = ?',
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

// A booster row is one of two shapes: charges > 0 with `expires_at` NULL is held
// and spent on a future event (streak shield, RC multiplier); `expires_at` set is
// a running timed effect. Buying again while one runs extends it, never overwrites.
interface BoosterRow extends RowDataPacket {
  item_id: number;
  kind: BoosterKind;
  charges: number;
  expires_at: Date | null;
}

export async function listBoosters(userId: number): Promise<BoosterRow[]> {
  // `kind` lives on user_boosters, not on the catalog: two catalog rows can
  // grant the same effect (the starter bundle grants shields + an XP card).
  const [rows] = await pool.execute<BoosterRow[]>(
    `SELECT ub.item_id, ub.kind, ub.charges, ub.expires_at
     FROM user_boosters ub
     WHERE ub.user_id = ?
       AND (ub.charges > 0 OR ub.expires_at > NOW())`,
    [userId],
  );
  return rows;
}

export function boosterCountsByItem(rows: BoosterRow[]): Map<number, { charges: number; until: string | null }> {
  const map = new Map<number, { charges: number; until: string | null }>();
  for (const row of rows) {
    const until = row.expires_at && new Date(row.expires_at).getTime() > Date.now()
      ? new Date(row.expires_at).toISOString()
      : null;
    map.set(Number(row.item_id), { charges: Number(row.charges), until });
  }
  return map;
}

export function boosterStock(rows: BoosterRow[]): BoosterStock {
  let streaks = 0;
  let rcCards = 0;
  let xpUntil: Date | null = null;

  for (const row of rows) {
    if (row.kind === 'streak_shield') streaks += Number(row.charges);
    else if (row.kind === 'rc_multiplier') rcCards += Number(row.charges);
    else if (row.expires_at && new Date(row.expires_at).getTime() > Date.now()) {
      const at = new Date(row.expires_at);
      if (!xpUntil || at > xpUntil) xpUntil = at;
    }
  }

  return {
    streak_shields: streaks,
    rc_multipliers: rcCards,
    xp_multiplier_until: xpUntil ? xpUntil.toISOString() : null,
    xp_multiplier_ms_left: xpUntil ? Math.max(0, xpUntil.getTime() - Date.now()) : 0,
  };
}

/** Buy/add one booster: charges stack, a timed effect extends from its own end. */
export async function addBoosterInTx(
  executor: Executor,
  userId: number,
  itemId: number,
  kind: BoosterKind,
  charges: number,
  durationMs: number,
): Promise<void> {
  if (durationMs > 0) {
    const until = new Date(Date.now() + durationMs);
    await executor.execute(
      `INSERT INTO user_boosters (user_id, item_id, kind, charges, expires_at)
       VALUES (?, ?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE expires_at = GREATEST(COALESCE(expires_at, NOW()), NOW()) + INTERVAL ? SECOND`,
      [userId, itemId, kind, until, Math.round(durationMs / 1000)],
    );
    return;
  }
  await executor.execute(
    `INSERT INTO user_boosters (user_id, item_id, kind, charges)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE charges = charges + VALUES(charges)`,
    [userId, itemId, kind, charges],
  );
}

// Spend one charge of a held booster. Returns true only when a charge was
// actually consumed, so callers can react to "the shield was there".
export async function consumeBoosterInTx(
  executor: Executor,
  userId: number,
  kind: BoosterKind,
): Promise<boolean> {
  const [rows] = await executor.execute<BoosterRow[]>(
    `SELECT item_id, kind, charges, expires_at FROM user_boosters
     WHERE user_id = ? AND kind = ? AND charges > 0 LIMIT 1 FOR UPDATE`,
    [userId, kind],
  );
  const row = rows[0];
  if (!row || Number(row.charges) <= 0) return false;
  await executor.execute(
    'UPDATE user_boosters SET charges = charges - 1 WHERE user_id = ? AND item_id = ?',
    [userId, row.item_id],
  );
  return true;
}

// One shield covers exactly one missed day. Returns false and spends nothing
// when the learner does not hold enough charges for the whole gap.
async function spendStreakShields(executor: Executor, userId: number, count: number): Promise<boolean> {
  const [rows] = await executor.execute<Array<RowDataPacket & { total: number }>>(
    `SELECT COALESCE(SUM(charges), 0) AS total FROM user_boosters
      WHERE user_id = ? AND kind = 'streak_shield' AND charges > 0`,
    [userId],
  );
  if (Number(rows[0]?.total ?? 0) < count) return false;
  for (let index = 0; index < count; index += 1) {
    if (!await consumeBoosterInTx(executor, userId, 'streak_shield')) return false;
  }
  return true;
}

export async function hasActiveXpBoost(executor: Executor, userId: number): Promise<boolean> {
  const [rows] = await executor.execute<Array<RowDataPacket & { ok: number }>>(
    `SELECT 1 AS ok FROM user_boosters
     WHERE user_id = ? AND kind = 'xp_multiplier' AND expires_at > NOW() LIMIT 1`,
    [userId],
  );
  return rows.length > 0;
}

export async function getUserBadgeCodes(userId: number): Promise<string[]> {
  const [rows] = await pool.execute<Array<RowDataPacket & { code: string }>>(
    `SELECT b.code FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = ?`,
    [userId],
  );
  return rows.map((row) => String(row.code));
}

export async function countCompletedStages(userId: number): Promise<number> {
  const [rows] = await pool.execute<Array<RowDataPacket & { total: number }>>(
    `SELECT COUNT(*) AS total FROM (
       SELECT s.id FROM stages s
       JOIN lessons l ON l.stage_id = s.id
       LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = ? AND p.status = 'completed' AND p.score = 100
       GROUP BY s.id
       HAVING COUNT(l.id) > 0 AND COUNT(p.id) = COUNT(l.id)
     ) completed_stages`,
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function isItemOwned(
  executor: Executor,
  userId: number,
  itemId: number,
): Promise<boolean> {
  const [rows] = await executor.execute<RowDataPacket[]>(
    'SELECT 1 AS ok FROM user_inventory WHERE user_id = ? AND item_id = ? LIMIT 1',
    [userId, itemId],
  );
  return rows.length > 0;
}

export async function ensureOwned(executor: Executor, userId: number, item: ShopItemRow): Promise<void> {
  await executor.execute<ResultSetHeader>(
    'INSERT IGNORE INTO user_inventory (user_id, item_id) VALUES (?, ?)',
    [userId, item.id],
  );
}

export async function equipItem(
  executor: Executor,
  userId: number,
  slot: string,
  itemId: number,
): Promise<void> {
  await executor.execute(
    `INSERT INTO user_equipment (user_id, slot, item_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE item_id = VALUES(item_id), updated_at = CURRENT_TIMESTAMP`,
    [userId, slot, itemId],
  );
}

export async function getEquipmentItems(userId: number): Promise<EquipmentView> {
  // `e.slot` is authoritative for placement: the row says which slot the user
  // equipped, independent of the item's own slot column.
  const [rows] = await pool.execute<Array<ShopItemRow & { equip_slot: string }>>(
    `SELECT s.id, s.code, s.name, s.description, s.slot, s.rarity, s.price,
            s.unlock_type, s.unlock_value, s.visual_key, s.style_json, s.sort_order,
            e.slot AS equip_slot
     FROM user_equipment e JOIN shop_items s ON s.id = e.item_id
     WHERE e.user_id = ?`,
    [userId],
  );
  const view: EquipmentView = { car: null, frame: null, nameplate: null };
  for (const row of rows) {
    const slot = String(row.equip_slot);
    if (slot === 'car' || slot === 'frame' || slot === 'nameplate') {
      view[slot] = { ...toShopItem(row), owned: true, equipped: true, unlocked: true, unlock_label: '' };
    }
  }
  return view;
}

function toShopItem(row: ShopItemRow) {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    description: row.description,
    slot: row.slot,
    rarity: row.rarity,
    price: Number(row.price),
    unlock_type: row.unlock_type,
    unlock_value: row.unlock_value,
    visual_key: row.visual_key,
    style: parseStyle(row.style_json),
    booster_kind: row.booster_kind,
    owned: false,
    equipped: false,
    unlocked: true,
    unlock_label: '',
    charges: 0,
    active_until: null as string | null,
  };
}

// The JSON column round-trips differently by driver: mysql2 hands back an object
// for MariaDB's CHECK(json_valid) columns but a string elsewhere, so accept both.
function parseStyle(raw: string | Record<string, unknown> | null): Record<string, string | null> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, string | null>;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw as Record<string, string | null>;
  return null;
}

export { toShopItem };

export type { QuestRow };

export async function listQuests(kind: 'daily' | 'weekly'): Promise<QuestRow[]> {
  const [rows] = await pool.execute<QuestRow[]>(
    `SELECT id, code, kind, title, description, metric, target, rc_reward, xp_reward, rp_reward, sort_order
     FROM quests WHERE active = 1 AND kind = ? ORDER BY sort_order ASC`,
    [kind],
  );
  return rows;
}

interface MetricCountRow extends RowDataPacket {
  total: number;
}

// Progress for one quest in the current period: daily counts today, weekly the
// running ISO week, both read off `activity_events`.
export async function questProgress(
  userId: number,
  metric: QuestMetric,
  kind: 'daily' | 'weekly',
): Promise<number> {
  const window = kind === 'daily'
    ? 'created_at >= CURDATE()'
    : 'YEARWEEK(created_at, 3) = YEARWEEK(CURDATE(), 3)';
  const [rows] = await pool.execute<MetricCountRow[]>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM activity_events
     WHERE user_id = ? AND kind = ? AND ${window}`,
    [userId, metric],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function hasClaimed(userId: number, code: string, period: string): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 AS ok FROM economy_ledger
     WHERE user_id = ? AND source_type = 'quest' AND source_id = ? LIMIT 1`,
    [userId, `${code}:${period}`],
  );
  return rows.length > 0;
}

export function questPeriod(kind: 'daily' | 'weekly', now = new Date()): string {
  if (kind === 'daily') {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
  return isoWeekCode(now);
}

export interface LeagueRow extends RowDataPacket {
  userId: number;
  name: string;
  race_points: number;
  tier: LeagueTier;
  frame_key: string | null;
  nameplate_key: string | null;
}

export async function getLeagueBoard(
  seasonId: number,
  tier: LeagueTier,
  limit = 50,
): Promise<LeagueRow[]> {
  const [rows] = await pool.execute<LeagueRow[]>(
    `SELECT st.user_id AS userId, u.display_name AS name, st.race_points,
            u.league_tier AS tier,
            f.visual_key AS frame_key, n.visual_key AS nameplate_key
     FROM season_standings st
     JOIN users u ON u.id = st.user_id
     LEFT JOIN user_equipment ef ON ef.user_id = st.user_id AND ef.slot = 'frame'
     LEFT JOIN shop_items f ON f.id = ef.item_id
     LEFT JOIN user_equipment en ON en.user_id = st.user_id AND en.slot = 'nameplate'
     LEFT JOIN shop_items n ON n.id = en.item_id
     WHERE st.season_id = ? AND u.league_tier IN (?, ?) AND st.race_points > 0
     ORDER BY st.race_points DESC, st.user_id ASC
     LIMIT ?`,
    [seasonId, ...leagueTierQueryValues(tier), limit],
  );
  return rows;
}

/** Position inside the learner's own tier, not across the global population. */
export async function getMyLeagueRank(
  seasonId: number,
  userId: number,
  tier: LeagueTier,
): Promise<number | null> {
  const [rows] = await pool.execute<Array<RowDataPacket & { position: number }>>(
    `SELECT COUNT(*) + 1 AS position
       FROM season_standings st
       JOIN users u ON u.id = st.user_id
      WHERE st.season_id = ? AND u.league_tier IN (?, ?) AND st.race_points > 0
        AND (st.race_points > (SELECT race_points FROM season_standings WHERE season_id = ? AND user_id = ?)
          OR (st.race_points = (SELECT race_points FROM season_standings WHERE season_id = ? AND user_id = ?) AND st.user_id < ?))`,
    [seasonId, ...leagueTierQueryValues(tier), seasonId, userId, seasonId, userId, userId],
  );
  return rows[0]?.position === undefined ? null : Number(rows[0].position);
}

export async function getLastPayout(userId: number): Promise<RowDataPacket | undefined> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.code AS season_code, p.tier, p.\`rank\`, p.rc_awarded, p.xp_awarded
     FROM season_payouts p JOIN seasons s ON s.id = p.season_id
     WHERE p.user_id = ? ORDER BY p.paid_at DESC LIMIT 1`,
    [userId],
  );
  return rows[0];
}
