import { HttpError } from '../../middleware/error-handler';
import { asObject, boundedInt } from '../../utils/validation';
import type {
  AdminManagedRole,
  AdminUserListQuery,
  AdminUserPatch,
} from './admin.users.types';

function positiveId(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Invalid user ID.');
  return id;
}

export const parseAdminUserId = (value: unknown): number => positiveId(value);

export function parseAdminUserListQuery(value: Record<string, unknown>): AdminUserListQuery {
  const search = typeof value.search === 'string' ? value.search.trim().slice(0, 100) : '';
  const rawRole = typeof value.role === 'string' ? value.role.trim() : '';
  const role = rawRole === 'learner' || rawRole === 'admin' ? rawRole : null;
  const rawLimit = Number(value.limit ?? 25);
  const rawOffset = Number(value.offset ?? 0);
  return {
    search,
    role,
    limit: Number.isInteger(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 25,
    offset: Number.isInteger(rawOffset) ? Math.min(1_000_000, Math.max(0, rawOffset)) : 0,
  };
}

const PROTECTED_FIELDS = ['password', 'password_hash', 'passwordHash', 'email', 'name', 'display_name', 'displayName'];

export function parseAdminUserPatch(value: unknown): AdminUserPatch {
  const body = asObject(value);
  const errors: string[] = [];
  const patch: AdminUserPatch = {};

  const protectedField = PROTECTED_FIELDS.find((field) => field in body);
  if (protectedField) {
    throw new HttpError(
      422,
      'Passwords and personal account details cannot be changed from user management.',
      ['PROTECTED_FIELD'],
    );
  }

  if (body.xp !== undefined) {
    patch.xp = boundedInt(body.xp, 'xp', 0, 100_000_000, errors);
  }
  if (body.coins !== undefined) {
    patch.coins = boundedInt(body.coins, 'coins', 0, 100_000_000, errors);
  }
  if (body.streak !== undefined) {
    patch.streak = boundedInt(body.streak, 'streak', 0, 36_500, errors);
  }
  if (body.race_points !== undefined || body.racePoints !== undefined) {
    patch.racePoints = boundedInt(
      body.race_points ?? body.racePoints,
      'race_points',
      0,
      10_000_000,
      errors,
    );
  }
  if (body.role !== undefined) {
    if (body.role !== 'learner' && body.role !== 'admin') {
      errors.push('role must be learner or admin.');
    } else {
      patch.role = body.role as AdminManagedRole;
    }
  }

  if (Object.keys(patch).length === 0) errors.push('Provide at least one field to update.');
  if (errors.length) throw new HttpError(422, 'Validation failed', errors);
  return patch;
}
