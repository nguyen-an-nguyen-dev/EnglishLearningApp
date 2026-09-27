import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../db/pool';
import type { AuthUser } from './auth.types';

interface UserRow extends RowDataPacket {
  id: number;
  display_name: string;
  email: string;
  password_hash: string;
  xp: number;
  streak: number;
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    name: row.display_name,
    email: row.email,
    xp: row.xp,
    streak: row.streak,
  };
}

export async function findByEmail(email: string): Promise<UserRow | undefined> {
  const [rows] = await pool.execute<UserRow[]>(
    'SELECT id, display_name, email, password_hash, xp, streak FROM users WHERE email = ? LIMIT 1',
    [email],
  );
  return rows[0];
}

export async function findProfileById(userId: number): Promise<AuthUser | undefined> {
  const [rows] = await pool.execute<UserRow[]>(
    'SELECT id, display_name, email, password_hash, xp, streak FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  return rows[0] ? toAuthUser(rows[0]) : undefined;
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

export { toAuthUser };