import { env } from '../config/env';

/** Rotation cursor shared by every Workers AI caller in the process. */
let cfCursor = 0;

/**
 * Accounts that answered "daily free allocation exhausted". They are skipped
 * until the next UTC midnight so every request goes straight to a live account
 * instead of burning a round-trip on a known 429.
 */
const exhaustedUntil = new Map<string, number>();

/** Workers AI reports an exhausted free allocation with this code. */
const DAILY_QUOTA_CODE = /daily free allocation|"?code"?\s*:\s*4006/i;

export function isDailyQuotaError(detail: string): boolean {
  return DAILY_QUOTA_CODE.test(detail);
}

function nextUtcMidnight(now = Date.now()): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
}

export function markCfAccountExhausted(apiKey: string): void {
  const key = apiKey.trim();
  if (!key) return;
  exhaustedUntil.set(key, nextUtcMidnight());
}

/**
 * One target per configured account, starting from the next account on the
 * round-robin ring. The caller retries them in order, so traffic spreads across
 * the daily quotas while a request still fails over within one turn.
 */
export function cfAccountTargets<Extra extends object>(
  extra: Extra,
): ({ apiKey: string; apiUrl: string } & Extra)[] {
  const accounts = env.cfAccounts;
  if (accounts.length === 0) return [];

  const now = Date.now();
  const active = accounts.filter((account) => (exhaustedUntil.get(account.apiKey) ?? 0) <= now);
  // If every account is marked exhausted, still try them: the quota may have
  // reset, and returning nothing would silently disable AI for the day.
  const usable = active.length > 0 ? active : accounts;
  const start = cfCursor++ % usable.length;
  const rotated = usable.slice(start).concat(usable.slice(0, start));
  return rotated.map((account) => ({ ...extra, ...account }));
}
