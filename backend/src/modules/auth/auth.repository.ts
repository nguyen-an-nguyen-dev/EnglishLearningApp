import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { pool } from '../../db/pool';
import { levelForXp } from '../gamification/gamification.levels';
import type { AuthUser, LinkedProvider, SocialProvider, UserRole } from './auth.types';

export interface UserRow extends RowDataPacket {
  id: number;
  display_name: string;
  email: string;
  password_hash: string;
  xp: number;
  coins: number;
  streak: number;
  role: UserRole;
  password_set: boolean | 0 | 1;
}

const USER_COLUMNS = 'id, display_name, email, password_hash, xp, coins, streak, role, password_set';

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    name: row.display_name,
    email: row.email,
    xp: row.xp,
    coins: Number(row.coins ?? 0),
    level: levelForXp(Number(row.xp)),
    streak: row.streak,
    role: row.role === 'admin' ? 'admin' : 'learner',
    has_password: row.password_set === true || row.password_set === 1,
  };
}

export async function findByEmail(email: string): Promise<UserRow | undefined> {
  const [rows] = await pool.execute<UserRow[]>(
    `SELECT ${USER_COLUMNS} FROM users WHERE email = ? LIMIT 1`,
    [email],
  );
  return rows[0];
}

export interface PendingRegistrationRow extends RowDataPacket {
  id: number;
  email: string;
  display_name: string;
  password_hash: string;
  otp_hash: string;
  expires_at: Date;
  attempts: number;
  send_count: number;
  last_sent_at: Date;
}

/**
 * One pending row per e-mail. A retry replaces the previous code instead of
 * stacking rows, so an abandoned flow cannot grow the table.
 */
export async function upsertPendingRegistration(input: {
  email: string;
  name: string;
  passwordHash: string;
  otpHash: string;
  expiresAt: Date;
}): Promise<void> {
  await pool.execute(
    `INSERT INTO pending_registrations
       (email, display_name, password_hash, otp_hash, expires_at, attempts, send_count, last_sent_at)
     VALUES (?, ?, ?, ?, ?, 0, 1, NOW())
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name),
       password_hash = VALUES(password_hash),
       otp_hash = VALUES(otp_hash),
       expires_at = VALUES(expires_at),
       attempts = 0,
       send_count = send_count + 1,
       last_sent_at = NOW()`,
    [input.email, input.name, input.passwordHash, input.otpHash, input.expiresAt],
  );
}

export async function findPendingRegistration(email: string): Promise<PendingRegistrationRow | undefined> {
  const [rows] = await pool.execute<PendingRegistrationRow[]>(
    'SELECT * FROM pending_registrations WHERE email = ? LIMIT 1',
    [email],
  );
  return rows[0];
}

export async function incrementPendingAttempts(id: number): Promise<void> {
  await pool.execute(
    'UPDATE pending_registrations SET attempts = attempts + 1 WHERE id = ?',
    [id],
  );
}

export async function deletePendingRegistration(email: string): Promise<void> {
  await pool.execute('DELETE FROM pending_registrations WHERE email = ?', [email]);
}

/** Housekeeping before a new request; expired rows have no value. */
export async function deleteExpiredPendingRegistrations(): Promise<void> {
  await pool.execute('DELETE FROM pending_registrations WHERE expires_at < NOW()');
}

export async function findProfileById(userId: number): Promise<AuthUser | undefined> {
  const [rows] = await pool.execute<UserRow[]>(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
    [userId],
  );
  return rows[0] ? toAuthUser(rows[0]) : undefined;
}

export async function findUserById(userId: number): Promise<UserRow | undefined> {
  const [rows] = await pool.execute<UserRow[]>(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
    [userId],
  );
  return rows[0];
}

interface RoleRow extends RowDataPacket {
  role: UserRole;
}

/** Read fresh on every privileged request so a demoted admin loses access immediately. */
export async function findRoleById(userId: number): Promise<UserRole | null> {
  const [rows] = await pool.execute<RoleRow[]>(
    'SELECT role FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  const value = rows[0]?.role;
  if (value === undefined || value === null) return null;
  return value === 'admin' ? 'admin' : 'learner';
}

export async function createUser(
  name: string,
  email: string,
  passwordHash: string,
  options: { passwordSet?: boolean } = {},
): Promise<AuthUser> {
  const username = `user-${randomUUID()}`;
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (username, email, password_hash, display_name, password_set) VALUES (?, ?, ?, ?, ?)',
    [username, email, passwordHash, name, options.passwordSet === false ? 0 : 1],
  );
  const created = await findProfileById(result.insertId);
  if (!created) throw new Error('Created user could not be loaded.');
  return created;
}

/**
 * Social registration: local account and provider identity are written in one
 * transaction, so a failure can never leave an orphan user or a dangling link.
 */
export async function createUserWithProvider(input: {
  name: string;
  email: string;
  passwordHash: string;
  provider: SocialProvider;
  providerUserId: string;
  providerEmail: string;
  providerName: string | null;
  avatarUrl: string | null;
}): Promise<{ userId: number; user: AuthUser }> {
  const connection: PoolConnection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const username = `user-${randomUUID()}`;
    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO users (username, email, password_hash, display_name, password_set) VALUES (?, ?, ?, ?, 0)',
      [username, input.email, input.passwordHash, input.name],
    );
    const userId = result.insertId;
    await connection.execute(
      `INSERT INTO user_providers
         (user_id, provider, provider_user_id, email, display_name, avatar_url, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        input.provider,
        input.providerUserId,
        input.providerEmail,
        input.providerName,
        input.avatarUrl,
      ],
    );
    await connection.commit();
    const user = await findProfileById(userId);
    if (!user) throw new Error('Created user could not be loaded.');
    return { userId, user };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateProfile(
  userId: number,
  name: string,
  email: string,
): Promise<AuthUser | undefined> {
  await pool.execute(
    'UPDATE users SET display_name = ?, email = ? WHERE id = ?',
    [name, email, userId],
  );
  return findProfileById(userId);
}

export async function updatePasswordHash(userId: number, passwordHash: string): Promise<void> {
  await pool.execute(
    'UPDATE users SET password_hash = ?, password_set = 1 WHERE id = ?',
    [passwordHash, userId],
  );
}

// --- Social identities ----------------------------------------------------

export interface ProviderAccountRow extends RowDataPacket {
  id: number;
  user_id: number;
  provider: SocialProvider;
  provider_user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  linked_at: Date;
  last_login_at: Date | null;
}

const PROVIDER_COLUMNS = `id, user_id, provider, provider_user_id, email, display_name,
  avatar_url, linked_at, last_login_at`;

export async function findProviderAccount(
  provider: SocialProvider,
  providerUserId: string,
): Promise<ProviderAccountRow | undefined> {
  const [rows] = await pool.execute<ProviderAccountRow[]>(
    `SELECT ${PROVIDER_COLUMNS} FROM user_providers
     WHERE provider = ? AND provider_user_id = ? LIMIT 1`,
    [provider, providerUserId],
  );
  return rows[0];
}

export async function findProviderForUser(
  userId: number,
  provider: SocialProvider,
): Promise<ProviderAccountRow | undefined> {
  const [rows] = await pool.execute<ProviderAccountRow[]>(
    `SELECT ${PROVIDER_COLUMNS} FROM user_providers
     WHERE user_id = ? AND provider = ? LIMIT 1`,
    [userId, provider],
  );
  return rows[0];
}

export async function listProvidersForUser(userId: number): Promise<LinkedProvider[]> {
  const [rows] = await pool.execute<ProviderAccountRow[]>(
    `SELECT ${PROVIDER_COLUMNS} FROM user_providers
     WHERE user_id = ? ORDER BY linked_at ASC`,
    [userId],
  );
  return rows.map((row) => ({
    provider: row.provider,
    email: row.email,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    linked_at: new Date(row.linked_at).toISOString(),
    last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
  }));
}

export async function insertProvider(input: {
  userId: number;
  provider: SocialProvider;
  providerUserId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}): Promise<void> {
  await pool.execute(
    `INSERT INTO user_providers
       (user_id, provider, provider_user_id, email, display_name, avatar_url, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [
      input.userId,
      input.provider,
      input.providerUserId,
      input.email,
      input.displayName,
      input.avatarUrl,
    ],
  );
}

export async function touchProviderLogin(providerAccountId: number): Promise<void> {
  await pool.execute(
    'UPDATE user_providers SET last_login_at = NOW() WHERE id = ?',
    [providerAccountId],
  );
}

export type UnlinkOutcome =
  | { status: 'deleted' }
  | { status: 'not_linked' }
  | { status: 'last_login_method' }
  | { status: 'user_missing' };

/**
 * Unlink with the account row locked, so two concurrent unlink calls cannot
 * both observe "two providers, no password" and remove the last login method.
 */
export async function unlinkProviderGuarded(
  userId: number,
  provider: SocialProvider,
): Promise<UnlinkOutcome> {
  const connection: PoolConnection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [userRows] = await connection.execute<UserRow[]>(
      'SELECT id, password_set FROM users WHERE id = ? FOR UPDATE',
      [userId],
    );
    const user = userRows[0];
    if (!user) {
      await connection.rollback();
      return { status: 'user_missing' };
    }

    const [providerRows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
      'SELECT id FROM user_providers WHERE user_id = ? AND provider = ? FOR UPDATE',
      [userId, provider],
    );
    if (!providerRows[0]) {
      await connection.rollback();
      return { status: 'not_linked' };
    }

    const [countRows] = await connection.execute<Array<RowDataPacket & { total: number }>>(
      'SELECT COUNT(*) AS total FROM user_providers WHERE user_id = ?',
      [userId],
    );
    const passwordSet = user.password_set === true || user.password_set === 1;
    if (!passwordSet && Number(countRows[0]?.total ?? 0) <= 1) {
      await connection.rollback();
      return { status: 'last_login_method' };
    }

    await connection.execute(
      'DELETE FROM user_providers WHERE user_id = ? AND provider = ?',
      [userId, provider],
    );
    await connection.commit();
    return { status: 'deleted' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export { toAuthUser };
