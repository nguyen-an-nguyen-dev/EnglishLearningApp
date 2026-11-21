import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { pool } from '../../db/pool';
import { getLeagueTier } from '../gamification/gamification.repository';
import { LAST_ACTIVITY_JOIN } from './admin.activity';
import type {
  AdminUserListQuery,
  AdminUserPatch,
  AdminUserRow,
} from './admin.users.types';

const USER_SELECT = `u.id, u.display_name, u.email, u.role, u.xp, u.coins, u.streak,
  u.streak_lost, u.streak_lost_at, u.created_at,
  activity.last_activity_at,
  (SELECT COUNT(*) FROM progress p WHERE p.user_id = u.id AND p.status = 'completed') AS lessons_completed,
  (SELECT COUNT(*) FROM video_progress vp WHERE vp.user_id = u.id AND vp.completed = 1) AS videos_completed,
  COALESCE(ss.race_points, 0) AS race_points,
  COALESCE(pc.provider_count, 0) AS provider_count`;

const PROVIDER_JOIN = `LEFT JOIN (
    SELECT user_id, COUNT(*) AS provider_count
    FROM user_providers GROUP BY user_id
  ) pc ON pc.user_id = u.id`;

const SEASON_JOIN = `LEFT JOIN season_standings ss ON ss.user_id = u.id AND ss.season_id = ?`;

function buildFilters(query: AdminUserListQuery): { where: string; params: Array<string> } {
  const clauses: string[] = [];
  const params: string[] = [];
  if (query.role) {
    clauses.push('u.role = ?');
    params.push(query.role);
  }
  if (query.search) {
    clauses.push('(u.display_name LIKE ? OR u.email LIKE ?)');
    params.push(`%${query.search}%`, `%${query.search}%`);
  }
  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

export async function listUsers(
  query: AdminUserListQuery,
  seasonId: number,
): Promise<{ users: AdminUserRow[]; total: number }> {
  const { where, params } = buildFilters(query);
  const [rows] = await pool.execute<AdminUserRow[]>(
    `SELECT ${USER_SELECT}
     FROM users u
     ${LAST_ACTIVITY_JOIN}
     ${PROVIDER_JOIN}
     ${SEASON_JOIN}
     ${where}
     ORDER BY u.id DESC
     LIMIT ${query.limit} OFFSET ${query.offset}`,
    [seasonId, ...params],
  );
  const [countRows] = await pool.execute<Array<RowDataPacket & { total: number }>>(
    `SELECT COUNT(*) AS total FROM users u ${where}`,
    params,
  );
  return { users: rows, total: Number(countRows[0]?.total ?? 0) };
}

export async function getUserRow(userId: number, seasonId: number): Promise<AdminUserRow | undefined> {
  const [rows] = await pool.execute<AdminUserRow[]>(
    `SELECT ${USER_SELECT}
     FROM users u
     ${LAST_ACTIVITY_JOIN}
     ${PROVIDER_JOIN}
     ${SEASON_JOIN}
     WHERE u.id = ? LIMIT 1`,
    [seasonId, userId],
  );
  return rows[0];
}

interface LockedUserRow extends RowDataPacket {
  id: number;
  role: 'learner' | 'admin';
  xp: number;
  coins: number;
  streak: number;
}

export type AdminUserUpdateStatus =
  | 'updated'
  | 'not_found'
  | 'cannot_demote_self'
  | 'last_admin';

export async function updateUserProgressTx(
  actingAdminId: number,
  userId: number,
  seasonId: number,
  patch: AdminUserPatch,
): Promise<AdminUserUpdateStatus> {
  const connection: PoolConnection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [userRows] = await connection.execute<LockedUserRow[]>(
      'SELECT id, role, xp, coins, streak FROM users WHERE id = ? FOR UPDATE',
      [userId],
    );
    const user = userRows[0];
    if (!user) {
      await connection.rollback();
      return 'not_found';
    }

    if (patch.role && patch.role !== user.role) {
      if (userId === actingAdminId && patch.role !== 'admin') {
        await connection.rollback();
        return 'cannot_demote_self';
      }
      if (user.role === 'admin' && patch.role === 'learner') {
        const [adminRows] = await connection.execute<Array<RowDataPacket & { total: number }>>(
          "SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND id <> ?",
          [userId],
        );
        if (Number(adminRows[0]?.total ?? 0) === 0) {
          await connection.rollback();
          return 'last_admin';
        }
      }
    }

    const sets: string[] = [];
    const params: Array<string | number | null> = [];
    const ledgerSource = `admin:${actingAdminId}:${randomUUID()}`;

    if (patch.xp !== undefined && patch.xp !== Number(user.xp)) {
      const delta = patch.xp - Number(user.xp);
      sets.push('xp = ?');
      params.push(patch.xp);
      await insertLedger(connection, userId, 'xp', delta, ledgerSource);
    }
    if (patch.coins !== undefined && patch.coins !== Number(user.coins)) {
      const delta = patch.coins - Number(user.coins);
      sets.push('coins = ?');
      params.push(patch.coins);
      await insertLedger(connection, userId, 'rc', delta, ledgerSource);
    }
    if (patch.role && patch.role !== user.role) {
      sets.push('role = ?');
      params.push(patch.role);
    }
    if (patch.streak !== undefined && patch.streak !== Number(user.streak)) {
      sets.push('streak = ?');
      params.push(patch.streak);
      if (patch.streak > 0) {
        sets.push('last_activity_date = CURDATE()', 'streak_lost = 0', 'streak_lost_at = NULL');
      } else if (Number(user.streak) > 0) {
        sets.push('streak_lost = ?', 'streak_lost_at = CURDATE()');
        params.push(Number(user.streak));
      }
    }
    if (patch.racePoints !== undefined) {
      const [standingRows] = await connection.execute<Array<RowDataPacket & { race_points: number }>>(
        'SELECT race_points FROM season_standings WHERE season_id = ? AND user_id = ? FOR UPDATE',
        [seasonId, userId],
      );
      const current = Number(standingRows[0]?.race_points ?? 0);
      if (patch.racePoints !== current) {
        const tier = await getLeagueTier(connection, userId);
        await connection.execute(
          `INSERT INTO season_standings (season_id, user_id, race_points, tier)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE race_points = VALUES(race_points), tier = VALUES(tier)`,
          [seasonId, userId, patch.racePoints, tier],
        );
        await insertLedger(connection, userId, 'rp', patch.racePoints - current, ledgerSource);
      }
    }

    if (sets.length > 0) {
      params.push(userId);
      await connection.execute(
        `UPDATE users SET ${sets.join(', ')} WHERE id = ?`,
        params,
      );
    }

    await connection.commit();
    return 'updated';
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function insertLedger(
  connection: PoolConnection,
  userId: number,
  currency: 'rc' | 'xp' | 'rp',
  amount: number,
  sourceId: string,
): Promise<void> {
  if (amount === 0) return;
  await connection.execute<ResultSetHeader>(
    `INSERT INTO economy_ledger (user_id, currency, amount, source_type, source_id)
     VALUES (?, ?, ?, 'admin_adjustment', ?)`,
    [userId, currency, amount, sourceId],
  );
}
