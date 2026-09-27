import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { HttpError } from '../../middleware/error-handler';
import * as authRepository from './auth.repository';
import { parseLoginInput, parseRegisterInput } from './auth.validation';
import type { AuthUser } from './auth.types';

const BCRYPT_ROUNDS = 12;

function jwtSecret(): string {
  if (env.jwtSecret.length < 32) {
    throw new HttpError(500, 'Authentication is not configured.');
  }
  return env.jwtSecret;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}

export async function register(input: unknown): Promise<AuthUser> {
  const data = parseRegisterInput(input);
  if (await authRepository.findByEmail(data.email)) {
    throw new HttpError(409, 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  try {
    return await authRepository.createUser(data.name, data.email, passwordHash);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, 'An account with this email already exists.');
    }
    throw error;
  }
}

export async function login(input: unknown): Promise<{ token: string; user: AuthUser }> {
  const data = parseLoginInput(input);
  const row = await authRepository.findByEmail(data.email);
  if (!row || !(await bcrypt.compare(data.password, row.password_hash))) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  const token = jwt.sign(
    {},
    jwtSecret(),
    { subject: String(row.id), expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] },
  );
  return { token, user: authRepository.toAuthUser(row) };
}

export async function getCurrentUser(userId: number): Promise<AuthUser> {
  const user = await authRepository.findProfileById(userId);
  if (!user) throw new HttpError(401, 'Invalid authentication token.');
  return user;
}

export function getVerifiedJwtSecret(): string {
  return jwtSecret();
}