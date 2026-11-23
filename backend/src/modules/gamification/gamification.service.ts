import { HttpError } from '../../middleware/error-handler';
import { pool } from '../../db/pool';
import { levelForXp, levelProgress } from './gamification.levels';
import * as repo from './gamification.repository';
import { BOOSTER_BONUS, BOOSTER_SPECS } from './gamification.rewards';
import { LEAGUE_TIERS, normalizeLeagueTier } from './gamification.types';
import type {
  BoosterStock,
  LeagueView,
  LeagueTier,
  QuestView,
  ShopItem,
  ShopItemRow,
  Wallet,
} from './gamification.types';

const TIER_LABEL: Record<LeagueTier, string> = {
  coal: 'Than',
  copper: 'Đồng',
  iron: 'Sắt',
  gold: 'Vàng',
  redstone: 'Đá đỏ',
  diamond: 'Kim Cương',
};

export async function getWallet(userId: number): Promise<Wallet> {
  await repo.ensureStreakState(userId);
  const seasonId = await repo.ensureCurrentSeason();
  const [balance, racePoints, season, equipment, ownedCount, boosterRows] = await Promise.all([
    repo.getBalance(userId),
    repo.getRacePoints(seasonId, userId),
    repo.getSeasonRow(seasonId),
    repo.getEquipmentItems(userId),
    repo.countOwnedItems(userId),
    repo.listBoosters(userId),
  ]);
  if (!balance) throw new HttpError(401, 'Invalid authentication token.');

  const progress = levelProgress(Number(balance.xp));
  const streakLostAt = balance.streak_lost_at ? new Date(balance.streak_lost_at) : null;
  return {
    coins: Number(balance.coins),
    xp: Number(balance.xp),
    level: progress.level,
    level_progress: {
      level: progress.level,
      xp: progress.xp,
      xp_into_level: progress.xpIntoLevel,
      xp_for_level: progress.xpForLevel,
      xp_to_next_level: progress.xpToNextLevel,
      progress_ratio: progress.progressRatio,
    },
    streak: Number(balance.streak),
    streak_lost: Number(balance.streak_lost ?? 0),
    streak_lost_at: balance.streak_lost_at ? new Date(balance.streak_lost_at).toISOString() : null,
    streak_lost_recent: Number(balance.streak_lost ?? 0) > 0 && streakLostAt !== null
      && Date.now() - streakLostAt.getTime() < 7 * 24 * 60 * 60 * 1000,
    last_activity_days_ago: balance.last_activity_days_ago === null
      ? null
      : Number(balance.last_activity_days_ago),
    race_points: racePoints,
    // The tier is a persistent rank carried across seasons; weekly RP only
    // decides movement inside the league, never the tier itself.
    tier: normalizeLeagueTier(balance.league_tier),
    season_code: season?.code ?? null,
    equipment,
    owned_count: ownedCount,
    boosters: repo.boosterStock(boosterRows),
  };
}

function unlockLabel(item: ShopItemRow): string {
  switch (item.unlock_type) {
    case 'level':
      return `Cần cấp ${item.unlock_value ?? '?'}`;
    case 'stage':
      return `Hoàn thành chặng ${item.unlock_value ?? '?'}`;
    case 'league':
      return `Hạng ${TIER_LABEL[normalizeLeagueTier(item.unlock_value)]} mùa này`;
    case 'achievement':
      return item.unlock_value === 'lessons_10'
        ? 'Mở bằng huy hiệu 10 bài'
        : item.unlock_value === 'xp_500'
          ? 'Mở bằng huy hiệu 500 XP'
          : 'Cần đạt thành tích tương ứng';
    default:
      return '';
  }
}

interface UnlockContext {
  level: number;
  completedStages: number;
  tier: LeagueTier;
  badgeCodes: string[];
}

async function loadUnlockContext(userId: number, xp: number): Promise<UnlockContext> {
  const [completedStages, badgeCodes, tier] = await Promise.all([
    repo.countCompletedStages(userId),
    repo.getUserBadgeCodes(userId),
    repo.getLeagueTier(pool, userId),
  ]);
  return {
    level: levelForXp(xp),
    completedStages,
    tier,
    badgeCodes,
  };
}

function isUnlocked(item: ShopItemRow, context: UnlockContext): boolean {
  switch (item.unlock_type) {
    case 'level':
      return context.level >= Number(item.unlock_value ?? 1);
    case 'stage':
      return context.completedStages >= Number(item.unlock_value ?? 1);
    case 'league':
      return LEAGUE_TIERS.indexOf(context.tier) >= LEAGUE_TIERS.indexOf(normalizeLeagueTier(item.unlock_value));
    case 'achievement':
      return item.unlock_value !== null && context.badgeCodes.includes(item.unlock_value);
    default:
      return true;
  }
}

export async function getShop(userId: number): Promise<{ items: ShopItem[]; coins: number; level: number; boosters: BoosterStock }> {
  const balance = await repo.getBalance(userId);
  if (!balance) throw new HttpError(401, 'Invalid authentication token.');

  const [items, ownedIds, equipmentIds, context, boosterRows] = await Promise.all([
    repo.listShopItems(),
    repo.getOwnedItemIds(userId),
    repo.getEquipmentIds(userId),
    loadUnlockContext(userId, Number(balance.xp)),
    repo.listBoosters(userId),
  ]);
  const heldBoosters = repo.boosterCountsByItem(boosterRows);

  const view = items.map((row) => {
    const item = repo.toShopItem(row);
    item.owned = ownedIds.has(item.id);
    item.equipped = equipmentIds.get(item.slot) === item.id;
    item.unlocked = isUnlocked(row, context);
    item.unlock_label = unlockLabel(row);
    const held = heldBoosters.get(item.id);
    if (held) {
      item.charges = held.charges;
      item.active_until = held.until;
    }
    return item;
  });

  return {
    items: view,
    coins: Number(balance.coins),
    level: context.level,
    boosters: repo.boosterStock(boosterRows),
  };
}

export async function purchaseItem(userId: number, itemId: number): Promise<{ item: ShopItem; coins: number }> {
  const item = await repo.getShopItem(itemId);
  if (!item) throw new HttpError(404, 'Item not found.');
  if (item.slot === 'booster') return purchaseBooster(userId, item);

  const balance = await repo.getBalance(userId);
  if (!balance) throw new HttpError(401, 'Invalid authentication token.');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<Array<import('mysql2').RowDataPacket & { coins: number }>>(
      'SELECT coins FROM users WHERE id = ? FOR UPDATE',
      [userId],
    );
    const coins = Number(rows[0]?.coins ?? 0);
    const [owned] = await connection.execute<import('mysql2').RowDataPacket[]>(
      'SELECT 1 AS ok FROM user_inventory WHERE user_id = ? AND item_id = ? LIMIT 1',
      [userId, item.id],
    );

    if (owned.length > 0) {
      await connection.commit();
      const view = repo.toShopItem(item);
      view.owned = true;
      view.unlocked = true;
      return { item: view, coins };
    }

    const context = await loadUnlockContext(userId, Number(balance.xp));
    if (!isUnlocked(item, context)) {
      throw new HttpError(403, `This item is locked. ${unlockLabel(item)}`, ['ITEM_LOCKED']);
    }
    if (coins < Number(item.price)) {
      throw new HttpError(422, 'Not enough Race Coin for this item.', ['INSUFFICIENT_COINS']);
    }

    await connection.execute('UPDATE users SET coins = coins - ? WHERE id = ?', [item.price, userId]);
    await repo.ensureOwned(connection, userId, item);
    await connection.commit();

    const view = repo.toShopItem(item);
    view.owned = true;
    view.unlocked = true;
    return { item: view, coins: coins - Number(item.price) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Buying a consumable differs from a cosmetic: it never enters `user_inventory`
// (that table means permanent ownership), it tops up a charge counter or extends
// a deadline. Repeat buys are allowed on purpose.
async function purchaseBooster(userId: number, item: ShopItemRow): Promise<{ item: ShopItem; coins: number }> {
  // Behaviour is read from the catalogue row so an admin can add a consumable
  // without touching BOOSTER_SPECS. The old map stays as a fallback for rows
  // created before the booster columns existed.
  const legacy = BOOSTER_SPECS[item.code];
  const kind = item.booster_kind ?? legacy?.kind;
  if (!kind) throw new HttpError(422, 'This consumable is not configured.', ['UNKNOWN_BOOSTER']);
  const charges = item.booster_kind ? Number(item.booster_charges) : legacy?.charges ?? 0;
  const durationMs = item.booster_kind
    ? Number(item.booster_duration_minutes) * 60_000
    : legacy?.durationMs ?? 0;
  if (charges <= 0 && durationMs <= 0) {
    throw new HttpError(422, 'This consumable has no effect configured.', ['UNKNOWN_BOOSTER']);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<Array<import('mysql2').RowDataPacket & { coins: number }>>(
      'SELECT coins FROM users WHERE id = ? FOR UPDATE',
      [userId],
    );
    const coins = Number(rows[0]?.coins ?? 0);
    if (coins < Number(item.price)) {
      throw new HttpError(422, 'Not enough Race Coin for this item.', ['INSUFFICIENT_COINS']);
    }

    await connection.execute('UPDATE users SET coins = coins - ? WHERE id = ?', [item.price, userId]);
    await repo.addBoosterInTx(connection, userId, item.id, kind, charges, durationMs);

    const bonus = BOOSTER_BONUS[item.code];
    if (bonus) {
      const xpItem = await repo.findShopItemByCode(connection, 'booster_xp2');
      if (xpItem) {
        await repo.addBoosterInTx(connection, userId, xpItem.id, 'xp_multiplier', 0, bonus.xpCardMs);
      }
    }

    await connection.commit();

    const boosterRows = await repo.listBoosters(userId);
    const held = repo.boosterCountsByItem(boosterRows).get(item.id);
    const view = repo.toShopItem(item);
    view.owned = true;
    view.unlocked = true;
    view.charges = held?.charges ?? 0;
    view.active_until = held?.until ?? null;
    return { item: view, coins: coins - Number(item.price) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function equipCosmetic(userId: number, itemId: number): Promise<ShopItem> {
  const item = await repo.getShopItem(itemId);
  if (!item) throw new HttpError(404, 'Item not found.');
  if (!(await repo.isItemOwned(pool, userId, item.id))) {
    throw new HttpError(403, 'You do not own this item.', ['ITEM_NOT_OWNED']);
  }

  await repo.equipItem(pool, userId, item.slot, item.id);
  const view = repo.toShopItem(item);
  view.owned = true;
  view.equipped = true;
  return view;
}

/** Falling back to the slot's default keeps a slot from ever rendering empty. */
export async function unequipSlot(userId: number, slot: string): Promise<ShopItem> {
  if (slot !== 'car' && slot !== 'frame' && slot !== 'nameplate') {
    throw new HttpError(422, 'Unknown cosmetic slot.', ['INVALID_SLOT']);
  }
  const items = await repo.listShopItems();
  const fallback = items.find((row) => row.slot === slot && row.unlock_type === 'default');
  if (!fallback) throw new HttpError(404, 'No default item for this slot.');
  await repo.ensureOwned(pool, userId, fallback);
  await repo.equipItem(pool, userId, slot, fallback.id);
  const view = repo.toShopItem(fallback);
  view.owned = true;
  view.equipped = true;
  return view;
}

export async function getRewards(userId: number): Promise<{ streak: number; daily: QuestView[]; weekly: QuestView[] }> {
  await repo.ensureStreakState(userId);
  const balance = await repo.getBalance(userId);
  if (!balance) throw new HttpError(401, 'Invalid authentication token.');
  const [dailyRows, weeklyRows] = await Promise.all([
    repo.listQuests('daily'),
    repo.listQuests('weekly'),
  ]);
  const [daily, weekly] = await Promise.all([
    buildQuestViews(userId, dailyRows),
    buildQuestViews(userId, weeklyRows),
  ]);
  return { streak: Number(balance.streak), daily, weekly };
}

async function buildQuestViews(userId: number, rows: repo.QuestRow[]): Promise<QuestView[]> {
  if (rows.length === 0) return [];
  return Promise.all(rows.map(async (row) => {
    const period = repo.questPeriod(row.kind);
    const [progress, claimed] = await Promise.all([
      repo.questProgress(userId, row.metric, row.kind),
      repo.hasClaimed(userId, row.code, period),
    ]);
    return {
      code: row.code,
      kind: row.kind,
      title: row.title,
      description: row.description,
      metric: row.metric,
      target: Number(row.target),
      progress: Math.min(progress, Number(row.target)),
      rc_reward: Number(row.rc_reward),
      xp_reward: Number(row.xp_reward),
      rp_reward: Number(row.rp_reward),
      claimable: !claimed && progress >= Number(row.target),
      claimed,
    };
  }));
}

export async function claimQuest(userId: number, code: string): Promise<{ quest: QuestView; coins: number }> {
  const [dailyRows, weeklyRows] = await Promise.all([repo.listQuests('daily'), repo.listQuests('weekly')]);
  const quest = [...dailyRows, ...weeklyRows].find((row) => row.code === code);
  if (!quest) throw new HttpError(404, 'Quest not found.');

  const period = repo.questPeriod(quest.kind);
  const progress = await repo.questProgress(userId, quest.metric, quest.kind);
  if (progress < Number(quest.target)) {
    throw new HttpError(422, 'This quest is not complete yet.', ['QUEST_INCOMPLETE']);
  }

  const connection = await pool.getConnection();
  let granted = false;
  try {
    await connection.beginTransaction();
    const outcome = await repo.grantInTx(connection, userId, [
      { currency: 'rc', amount: Number(quest.rc_reward), sourceType: 'quest', sourceId: `${code}:${period}` },
      { currency: 'xp', amount: Number(quest.xp_reward), sourceType: 'quest', sourceId: `${code}:${period}` },
      { currency: 'rp', amount: Number(quest.rp_reward), sourceType: 'quest', sourceId: `${code}:${period}` },
    ]);
    granted = outcome.granted.length > 0;
    if (!granted) {
      // Nothing was written: the unique key already holds this claim.
      throw new HttpError(409, 'This quest was already claimed.', ['QUEST_ALREADY_CLAIMED']);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const balance = await repo.getBalance(userId);
  return {
    quest: {
      code,
      kind: quest.kind,
      title: quest.title,
      description: quest.description,
      metric: quest.metric,
      target: Number(quest.target),
      progress: Math.min(progress, Number(quest.target)),
      rc_reward: Number(quest.rc_reward),
      xp_reward: Number(quest.xp_reward),
      rp_reward: Number(quest.rp_reward),
      claimable: false,
      claimed: true,
    },
    coins: Number(balance?.coins ?? 0),
  };
}

export async function getLeague(userId: number): Promise<LeagueView> {
  const seasonId = await repo.ensureCurrentSeason();
  const leagueTier = await repo.getLeagueTier(pool, userId);
  const [season, racePoints, board, myRank, payout] = await Promise.all([
    repo.getSeasonRow(seasonId),
    repo.getRacePoints(seasonId, userId),
    repo.getLeagueBoard(seasonId, leagueTier),
    repo.getMyLeagueRank(seasonId, userId, leagueTier),
    repo.getLastPayout(userId),
  ]);

  const standings = board.map((row, index) => ({
    rank: index + 1,
    userId: Number(row.userId),
    name: row.name,
    race_points: Number(row.race_points),
    tier: normalizeLeagueTier(row.tier),
    frame_key: row.frame_key,
    nameplate_key: row.nameplate_key,
    is_me: Number(row.userId) === userId,
  }));

  return {
    season: season
      ? {
          code: season.code,
          starts_at: new Date(season.starts_at).toISOString(),
          ends_at: new Date(season.ends_at).toISOString(),
          ends_in_ms: Math.max(0, new Date(season.ends_at).getTime() - Date.now()),
        }
      : null,
    tier: leagueTier,
    race_points: racePoints,
    standings,
    // A learner with no race points yet has no meaningful position; showing
    // "#1" on an empty board reads as a win they did not earn.
    my_rank: racePoints > 0 ? myRank : null,
    last_payout: payout
      ? {
          season_code: String(payout.season_code),
          tier: normalizeLeagueTier(String(payout.tier)),
          rank: Number(payout.rank),
          rc_awarded: Number(payout.rc_awarded),
          xp_awarded: Number(payout.xp_awarded),
        }
      : null,
  };
}
