import { randomUUID } from 'node:crypto';
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

export type OAuthProvider = 'google' | 'facebook';

interface ProviderProfile {
  email: string;
  name: string;
}

async function fetchGoogleProfile(idToken: string): Promise<ProviderProfile> {
  if (!env.googleClientId) throw new HttpError(503, 'Google sign-in is not configured.');
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!response.ok) throw new HttpError(401, 'Google token is invalid or expired.');
  const data = (await response.json()) as Record<string, string>;
  if (data.aud !== env.googleClientId) throw new HttpError(401, 'Google token was issued for another app.');
  if (data.email_verified !== 'true' || !data.email) {
    throw new HttpError(401, 'This Google account has no verified email.');
  }
  return { email: data.email.toLowerCase(), name: data.name || data.email.split('@')[0] };
}

async function fetchFacebookProfile(accessToken: string): Promise<ProviderProfile> {
  if (!env.facebookAppId) throw new HttpError(503, 'Facebook sign-in is not configured.');
  const url = `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url);
  if (!response.ok) throw new HttpError(401, 'Facebook token is invalid or expired.');
  const data = (await response.json()) as { id?: string; name?: string; email?: string };
  if (!data.email) throw new HttpError(401, 'Facebook did not share an email address.');
  return { email: data.email.toLowerCase(), name: data.name || data.email.split('@')[0] };
}

export interface ProviderConfig {
  google: boolean;
  facebook: boolean;
  googleClientId: string;
  facebookAppId: string;
}

export async function listProviders(): Promise<ProviderConfig> {
  return {
    google: Boolean(env.googleClientId),
    facebook: Boolean(env.facebookAppId),
    googleClientId: env.googleClientId,
    facebookAppId: env.facebookAppId,
  };
}

export async function loginWithProvider(
  provider: OAuthProvider,
  rawToken: unknown,
): Promise<{ token: string; user: AuthUser }> {
  if (typeof rawToken !== 'string' || rawToken.trim().length === 0) {
    throw new HttpError(422, 'Missing provider token.');
  }

  const profile = provider === 'google'
    ? await fetchGoogleProfile(rawToken.trim())
    : await fetchFacebookProfile(rawToken.trim());

  let row = await authRepository.findByEmail(profile.email);

  if (!row) {
    const unusablePassword = await bcrypt.hash(`${provider}:${randomUUID()}`, BCRYPT_ROUNDS);
    try {
      await authRepository.createUser(profile.name, profile.email, unusablePassword);
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
    row = await authRepository.findByEmail(profile.email);
  }

  if (!row) throw new HttpError(500, 'Could not create an account for this provider.');

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