import { HttpError } from '../../middleware/error-handler';
import { ensureCurrentSeason } from '../gamification/gamification.repository';
import { levelForXp } from '../gamification/gamification.levels';
import * as repo from './admin.users.repository';
import type {
  AdminUser,
  AdminUserListQuery,
  AdminUserPatch,
  AdminUserRow,
} from './admin.users.types';

function mapUser(row: AdminUserRow): AdminUser {
  return {
    id: Number(row.id),
    name: row.display_name,
    email: row.email,
    role: row.role === 'admin' ? 'admin' : 'learner',
    xp: Number(row.xp),
    coins: Number(row.coins),
    level: levelForXp(Number(row.xp)),
    streak: Number(row.streak),
    streak_lost: Number(row.streak_lost ?? 0),
    streak_lost_at: row.streak_lost_at ? new Date(row.streak_lost_at).toISOString() : null,
    race_points: Number(row.race_points ?? 0),
    lessons_completed: Number(row.lessons_completed ?? 0),
    videos_completed: Number(row.videos_completed ?? 0),
    provider_count: Number(row.provider_count ?? 0),
    created_at: new Date(row.created_at).toISOString(),
    last_activity_at: row.last_activity_at ? new Date(row.last_activity_at).toISOString() : null,
  };
}

export async function listUsers(
  query: AdminUserListQuery,
): Promise<{ users: AdminUser[]; total: number }> {
  const seasonId = await ensureCurrentSeason();
  const { users, total } = await repo.listUsers(query, seasonId);
  return { users: users.map(mapUser), total };
}

export async function getUser(userId: number): Promise<AdminUser> {
  const seasonId = await ensureCurrentSeason();
  const row = await repo.getUserRow(userId, seasonId);
  if (!row) throw new HttpError(404, 'User not found.');
  return mapUser(row);
}

export async function updateUser(
  actingAdminId: number,
  userId: number,
  patch: AdminUserPatch,
): Promise<AdminUser> {
  const seasonId = await ensureCurrentSeason();
  const status = await repo.updateUserProgressTx(actingAdminId, userId, seasonId, patch);
  if (status === 'not_found') throw new HttpError(404, 'User not found.');
  if (status === 'cannot_demote_self') {
    throw new HttpError(422, 'You cannot remove your own admin role.', ['CANNOT_DEMOTE_SELF']);
  }
  if (status === 'last_admin') {
    throw new HttpError(422, 'The last administrator cannot be demoted.', ['LAST_ADMIN']);
  }
  return getUser(userId);
}
