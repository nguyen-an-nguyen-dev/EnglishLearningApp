import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { HttpError } from '../../middleware/error-handler';
import { isDuplicateKeyError } from '../../utils/db-errors';
import { ensureStreakState } from '../gamification/gamification.repository';
import { sendRegistrationOtp } from './auth.mailer';
import * as authRepository from './auth.repository';
import {
  parseEmailInput,
  parseLoginInput,
  parsePasswordChangeInput,
  parseProfileInput,
  parseRegisterInput,
  parseVerifyRegistrationInput,
} from './auth.validation';
import type { AuthUser, LinkedProvider, SocialProvider } from './auth.types';

const BCRYPT_ROUNDS = 12;
const OTP_LENGTH = 6;

function jwtSecret(): string {
  if (env.jwtSecret.length < 32) {
    throw new HttpError(500, 'Authentication is not configured.');
  }
  return env.jwtSecret;
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

export interface StartRegistrationResult {
  email: string;
  expires_in_seconds: number;
  resend_after_seconds: number;
  /** Only present when SMTP is missing and the server runs with OTP_DEBUG=true. */
  dev_code?: string;
}

function hashOtp(email: string, code: string): string {
  return createHmac('sha256', jwtSecret()).update(`${email}:${code}`).digest('hex');
}

function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

function otpExpiry(): Date {
  return new Date(Date.now() + env.otpExpiryMinutes * 60_000);
}

async function deliverRegistrationOtp(input: {
  email: string;
  name: string;
  code: string;
  expiresAt: Date;
}): Promise<StartRegistrationResult> {
  let delivered = false;
  try {
    delivered = await sendRegistrationOtp({
      email: input.email,
      name: input.name,
      code: input.code,
      expiresMinutes: env.otpExpiryMinutes,
    });
  } catch {
    throw new HttpError(
      502,
      'Could not send the verification email. Please try again.',
      ['OTP_MAIL_FAILED'],
    );
  }

  // A production server without SMTP must fail loudly instead of promising an
  // e-mail that will never arrive. In development the debug code covers this.
  if (!delivered && !env.otpDebug) {
    throw new HttpError(
      503,
      'Email delivery is not configured on this server.',
      ['OTP_MAIL_NOT_CONFIGURED'],
    );
  }

  return {
    email: input.email,
    expires_in_seconds: Math.max(
      1,
      Math.round((input.expiresAt.getTime() - Date.now()) / 1000),
    ),
    resend_after_seconds: env.otpResendSeconds,
    // Never in production: otpDebug defaults off there, so the code stays in
    // the server log only and cannot be read from the HTTP response.
    ...(!delivered && env.otpDebug ? { dev_code: input.code } : {}),
  };
}

/**
 * Web registration, step 1: validate the form, keep it in
 * `pending_registrations` and mail a six-digit code. No user row exists yet.
 */
export async function startRegistration(input: unknown): Promise<StartRegistrationResult> {
  const data = parseRegisterInput(input);
  if (await authRepository.findByEmail(data.email)) {
    throw new HttpError(409, 'An account with this email already exists.');
  }

  await authRepository.deleteExpiredPendingRegistrations();
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const code = generateOtp();
  const expiresAt = otpExpiry();
  await authRepository.upsertPendingRegistration({
    email: data.email,
    name: data.name,
    passwordHash,
    otpHash: hashOtp(data.email, code),
    expiresAt,
  });

  return deliverRegistrationOtp({
    email: data.email,
    name: data.name,
    code,
    expiresAt,
  });
}

/**
 * Web registration, step 2: consume the code and only now write the user.
 * Returning a token keeps the existing "register then enter the app" UX.
 */
export async function verifyRegistration(
  input: unknown,
): Promise<{ token: string; user: AuthUser }> {
  const data = parseVerifyRegistrationInput(input);
  const pending = await authRepository.findPendingRegistration(data.email);
  if (!pending) {
    throw new HttpError(
      400,
      'No pending registration was found. Please start again.',
      ['OTP_MISSING'],
    );
  }

  if (new Date(pending.expires_at).getTime() <= Date.now()) {
    await authRepository.deletePendingRegistration(data.email);
    throw new HttpError(
      400,
      'The verification code has expired. Please request a new one.',
      ['OTP_EXPIRED'],
    );
  }

  if (pending.attempts >= env.otpMaxAttempts) {
    throw new HttpError(
      429,
      'Too many incorrect codes. Please request a new one.',
      ['OTP_TOO_MANY_ATTEMPTS'],
    );
  }

  const expected = Buffer.from(pending.otp_hash, 'hex');
  const actual = Buffer.from(hashOtp(data.email, data.code), 'hex');
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!matches) {
    await authRepository.incrementPendingAttempts(pending.id);
    throw new HttpError(401, 'The verification code is incorrect.', ['OTP_INVALID']);
  }

  try {
    const user = await authRepository.createUser(
      pending.display_name,
      pending.email,
      pending.password_hash,
    );
    await authRepository.deletePendingRegistration(data.email);
    await ensureStreakState(user.id);
    return { token: issueToken(user.id), user };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      await authRepository.deletePendingRegistration(data.email);
      throw new HttpError(409, 'An account with this email already exists.');
    }
    throw error;
  }
}

/** Web registration: replace the code and mail it again after the cooldown. */
export async function resendRegistrationOtp(
  input: unknown,
): Promise<StartRegistrationResult> {
  const { email } = parseEmailInput(input);
  const pending = await authRepository.findPendingRegistration(email);
  if (!pending) {
    throw new HttpError(
      404,
      'No pending registration was found. Please start again.',
      ['OTP_MISSING'],
    );
  }

  const lastSent = new Date(pending.last_sent_at).getTime();
  const retryAfter = Math.ceil(
    (lastSent + env.otpResendSeconds * 1000 - Date.now()) / 1000,
  );
  if (retryAfter > 0) {
    throw new HttpError(
      429,
      `Please wait ${retryAfter} seconds before requesting another code.`,
      ['OTP_RESEND_COOLDOWN'],
    );
  }

  const code = generateOtp();
  const expiresAt = otpExpiry();
  await authRepository.upsertPendingRegistration({
    email,
    name: pending.display_name,
    passwordHash: pending.password_hash,
    otpHash: hashOtp(email, code),
    expiresAt,
  });

  return deliverRegistrationOtp({
    email,
    name: pending.display_name,
    code,
    expiresAt,
  });
}

export async function login(input: unknown): Promise<{ token: string; user: AuthUser }> {
  const data = parseLoginInput(input);
  let row = await authRepository.findByEmail(data.email);
  if (!row || row.password_set !== 1 || !(await bcrypt.compare(data.password, row.password_hash))) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  await ensureStreakState(row.id);
  row = await authRepository.findUserById(row.id) ?? row;
  return { token: issueToken(row.id), user: authRepository.toAuthUser(row) };
}

export type OAuthProvider = SocialProvider;

interface ProviderProfile {
  providerUserId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

function issueToken(userId: number): string {
  return jwt.sign(
    {},
    jwtSecret(),
    { subject: String(userId), expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] },
  );
}

async function fetchGoogleProfile(idToken: string): Promise<ProviderProfile> {
  if (!env.googleClientId) throw new HttpError(503, 'Google sign-in is not configured.');
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!response.ok) throw new HttpError(401, 'Google token is invalid or expired.');
  const data = (await response.json()) as Record<string, string>;
  if (data.aud !== env.googleClientId) throw new HttpError(401, 'Google token was issued for another app.');
  if (data.iss && data.iss !== 'accounts.google.com' && data.iss !== 'https://accounts.google.com') {
    throw new HttpError(401, 'Google token issuer is not recognised.');
  }
  if (!data.sub) throw new HttpError(401, 'Google did not return an account identifier.');
  if (data.email_verified !== 'true' || !data.email) {
    throw new HttpError(401, 'This Google account has no verified email.');
  }
  return {
    providerUserId: data.sub,
    email: data.email.toLowerCase(),
    name: data.name || data.email.split('@')[0],
    avatarUrl: data.picture ?? null,
  };
}

async function fetchFacebookProfile(accessToken: string): Promise<ProviderProfile> {
  if (!env.facebookAppId) throw new HttpError(503, 'Facebook sign-in is not configured.');

  // When the app secret is configured, ask Facebook whether this token was
  // really issued for this app. Without the check a token minted by any other
  // Facebook app that happens to share an e-mail could be presented.
  if (env.facebookAppSecret) {
    const debugUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}`
      + `&access_token=${encodeURIComponent(`${env.facebookAppId}|${env.facebookAppSecret}`)}`;
    const debugResponse = await fetch(debugUrl);
    if (!debugResponse.ok) throw new HttpError(401, 'Facebook token is invalid or expired.');
    const debug = (await debugResponse.json()) as {
      data?: { app_id?: string; is_valid?: boolean; user_id?: string };
    };
    if (!debug.data?.is_valid || debug.data.app_id !== env.facebookAppId) {
      throw new HttpError(401, 'Facebook token was issued for another app.');
    }
  }

  const url = 'https://graph.facebook.com/me?fields=id,name,email,picture.type(large)'
    + `&access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url);
  if (!response.ok) throw new HttpError(401, 'Facebook token is invalid or expired.');
  const data = (await response.json()) as {
    id?: string;
    name?: string;
    email?: string;
    picture?: { data?: { url?: string } };
  };
  if (!data.id) throw new HttpError(401, 'Facebook did not return an account identifier.');
  if (!data.email) throw new HttpError(401, 'Facebook did not share an email address.');
  return {
    providerUserId: data.id,
    email: data.email.toLowerCase(),
    // Facebook Graph only returns e-mail addresses it considers confirmed, but
    // it does not expose a verification flag. Linking still requires an
    // authenticated local session, so this is safe for the link flow.
    name: data.name || data.email.split('@')[0],
    avatarUrl: data.picture?.data?.url ?? null,
  };
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

async function verifyProviderToken(
  provider: OAuthProvider,
  rawToken: unknown,
): Promise<ProviderProfile> {
  if (typeof rawToken !== 'string' || rawToken.trim().length === 0) {
    throw new HttpError(422, 'Missing provider token.');
  }
  return provider === 'google'
    ? fetchGoogleProfile(rawToken.trim())
    : fetchFacebookProfile(rawToken.trim());
}

function accountExistsLinkRequired(provider: OAuthProvider): HttpError {
  return new HttpError(
    409,
    `This email already has a password account. Sign in with your password, then link ${provider === 'google' ? 'Google' : 'Facebook'} from your profile.`,
    ['ACCOUNT_EXISTS_LINK_REQUIRED'],
  );
}

export async function loginWithProvider(
  provider: OAuthProvider,
  rawToken: unknown,
): Promise<{ token: string; user: AuthUser }> {
  const profile = await verifyProviderToken(provider, rawToken);

  // 1. The identity key is the only thing that may resolve a session.
  const linked = await authRepository.findProviderAccount(provider, profile.providerUserId);
  if (linked) {
    let row = await authRepository.findUserById(Number(linked.user_id));
    if (!row) throw new HttpError(401, 'This social identity is no longer attached to an account.');
    await authRepository.touchProviderLogin(linked.id);
    await ensureStreakState(row.id);
    row = await authRepository.findUserById(row.id) ?? row;
    return { token: issueToken(row.id), user: authRepository.toAuthUser(row) };
  }

  // 2. Never auto-link by e-mail: that is the account-takeover path.
  if (await authRepository.findByEmail(profile.email)) {
    throw accountExistsLinkRequired(provider);
  }

  // 3. A brand-new identity gets a new account without a usable password.
  const unusablePassword = await bcrypt.hash(`${provider}:${randomUUID()}`, BCRYPT_ROUNDS);
  try {
    const created = await authRepository.createUserWithProvider({
      name: profile.name,
      email: profile.email,
      passwordHash: unusablePassword,
      provider,
      providerUserId: profile.providerUserId,
      providerEmail: profile.email,
      providerName: profile.name,
      avatarUrl: profile.avatarUrl,
    });
    return { token: issueToken(created.userId), user: created.user };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      // A concurrent request may have created the same identity first.
      const raced = await authRepository.findProviderAccount(provider, profile.providerUserId);
      if (raced) {
        const row = await authRepository.findUserById(Number(raced.user_id));
        if (row) return { token: issueToken(row.id), user: authRepository.toAuthUser(row) };
      }
      throw accountExistsLinkRequired(provider);
    }
    throw error;
  }
}

function requireProvider(value: string): OAuthProvider {
  if (value === 'google' || value === 'facebook') return value;
  throw new HttpError(404, 'Unknown sign-in provider.');
}

export async function listLinkedProviders(userId: number): Promise<LinkedProvider[]> {
  const user = await authRepository.findUserById(userId);
  if (!user) throw new HttpError(401, 'Invalid authentication token.');
  return authRepository.listProvidersForUser(userId);
}

export async function linkProvider(
  userId: number,
  rawProvider: string,
  rawToken: unknown,
): Promise<{ providers: LinkedProvider[]; user: AuthUser }> {
  const provider = requireProvider(rawProvider);
  const user = await authRepository.findUserById(userId);
  if (!user) throw new HttpError(401, 'Invalid authentication token.');
  const profile = await verifyProviderToken(provider, rawToken);

  const identity = await authRepository.findProviderAccount(provider, profile.providerUserId);
  if (identity && Number(identity.user_id) !== userId) {
    throw new HttpError(
      409,
      'This social account is already linked to another user.',
      ['PROVIDER_ALREADY_LINKED'],
    );
  }

  const slot = await authRepository.findProviderForUser(userId, provider);
  if (slot && slot.provider_user_id !== profile.providerUserId) {
    throw new HttpError(
      409,
      `Your account already has a different ${provider} identity linked. Unlink it first.`,
      ['PROVIDER_SLOT_TAKEN'],
    );
  }

  if (!slot) {
    // The explicit link flow is deliberately strict: the provider mailbox must
    // be the same mailbox the learner signed in with. A typo (or a second
    // Google/Facebook account) should never be attached to this profile.
    if (profile.email.toLowerCase() !== user.email.trim().toLowerCase()) {
      throw new HttpError(
        409,
        `The ${provider} account must use the same email as this account.`,
        ['PROVIDER_EMAIL_MISMATCH'],
      );
    }
    try {
      await authRepository.insertProvider({
        userId,
        provider,
        providerUserId: profile.providerUserId,
        email: profile.email,
        displayName: profile.name,
        avatarUrl: profile.avatarUrl,
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const racedIdentity = await authRepository.findProviderAccount(provider, profile.providerUserId);
      if (!racedIdentity || Number(racedIdentity.user_id) !== userId) {
        throw new HttpError(
          409,
          'This social account is already linked to another user.',
          ['PROVIDER_ALREADY_LINKED'],
        );
      }
    }
  }

  return {
    providers: await authRepository.listProvidersForUser(userId),
    user: authRepository.toAuthUser(user),
  };
}

export async function unlinkProvider(
  userId: number,
  rawProvider: string,
): Promise<LinkedProvider[]> {
  const provider = requireProvider(rawProvider);
  const outcome = await authRepository.unlinkProviderGuarded(userId, provider);
  if (outcome.status === 'user_missing') throw new HttpError(401, 'Invalid authentication token.');
  if (outcome.status === 'not_linked') {
    throw new HttpError(404, 'This provider is not linked to your account.');
  }
  if (outcome.status === 'last_login_method') {
    throw new HttpError(
      409,
      'Set a password before removing your only sign-in method.',
      ['LAST_LOGIN_METHOD'],
    );
  }
  return authRepository.listProvidersForUser(userId);
}

export async function getCurrentUser(userId: number): Promise<AuthUser> {
  await ensureStreakState(userId);
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

  const passwordSet = current.password_set === true || current.password_set === 1;
  if (passwordSet) {
    if (!data.currentPassword) {
      throw new HttpError(422, 'Validation failed', ['Current password is required.']);
    }
    const matches = await bcrypt.compare(data.currentPassword, current.password_hash);
    if (!matches) throw new HttpError(401, 'Your current password is incorrect.');
  }

  const passwordHash = await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS);
  await authRepository.updatePasswordHash(userId, passwordHash);
}

export function getVerifiedJwtSecret(): string {
  return jwtSecret();
}