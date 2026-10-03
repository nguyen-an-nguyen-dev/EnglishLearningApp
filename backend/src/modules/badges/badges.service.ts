import * as repo from './badges.repository';
import type { EarnedBadge } from './badges.types';

export async function getUserBadges(userId: number): Promise<EarnedBadge[]> {
  return repo.getEarnedBadges(userId);
}