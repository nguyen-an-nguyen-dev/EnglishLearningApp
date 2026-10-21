import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { HttpError } from '../../middleware/error-handler';
import * as authRepository from './auth.repository';
import {
  parseLoginInput,
  parsePasswordChangeInput,
  parseProfileInput,
  parseRegisterInput,
} from './auth.validation';
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

export async function updateProfile(userId: number, input: unknown): Promise<AuthUser> {
  const data = parseProfileInput(input);
  const current = await authRepository.findUserById(userId);
  if (!current) throw new HttpError(401, 'Invalid authentication token.');

  if (data.email !== current.email) {
    const existing = await authRepository.findByEmail(data.email);
    if (existing && existing.id !== userId) {
      throw new HttpError(409, 'An account with this email already exists.');
    }
  }

  try {
    const updated = await authRepository.updateProfile(userId, data.name, data.email);
    if (!updated) throw new HttpError(401, 'Invalid authentication token.');
    return updated;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, 'An account with this email already exists.');
    }
    throw error;
  }
}

export async function changePassword(userId: number, input: unknown): Promise<void> {
  const data = parsePasswordChangeInput(input);
  const current = await authRepository.findUserById(userId);
  if (!current) throw new HttpError(401, 'Invalid authentication token.');

  const matches = await bcrypt.compare(data.currentPassword, current.password_hash);
  if (!matches) throw new HttpError(401, 'Your current password is incorrect.');

  const passwordHash = await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS);
  await authRepository.updatePasswordHash(userId, passwordHash);
}

export function getVerifiedJwtSecret(): string {
  return jwtSecret();
}