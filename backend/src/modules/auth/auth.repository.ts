import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../db/pool';
import type { AuthUser, UserRole } from './auth.types';

export interface UserRow extends RowDataPacket {
  id: number;
  display_name: string;
  email: string;
  password_hash: string;
  xp: number;
  streak: number;
  role: UserRole;
}

const USER_COLUMNS = 'id, display_name, email, password_hash, xp, streak, role';

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    name: row.display_name,
    email: row.email,
    xp: row.xp,
    streak: row.streak,
    role: row.role === 'admin' ? 'admin' : 'learner',
  };
}

export async function findByEmail(email: string): Promise<UserRow | undefined> {
  const [rows] = await pool.execute<UserRow[]>(
    `SELECT ${USER_COLUMNS} FROM users WHERE email = ? LIMIT 1`,
    [email],
  );
  return rows[0];
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

export async function createUser(name: string, email: string, passwordHash: string): Promise<AuthUser> {
  const username = `user-${randomUUID()}`;
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
    [username, email, passwordHash, name],
  );
  const created = await findProfileById(result.insertId);
  if (!created) throw new Error('Created user could not be loaded.');
  return created;
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
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [passwordHash, userId],
  );
}

export { toAuthUser };
