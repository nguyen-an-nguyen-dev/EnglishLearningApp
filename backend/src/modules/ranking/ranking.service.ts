import * as repo from './ranking.repository';
import type { RankingResponse } from './ranking.types';

/** Both boards (career XP + weekly league) are built in the repository. */
export async function getRanking(currentUserId: number): Promise<RankingResponse> {
  return repo.getRanking(currentUserId);
}
