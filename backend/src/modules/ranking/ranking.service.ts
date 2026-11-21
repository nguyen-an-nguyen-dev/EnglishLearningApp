import * as repo from './ranking.repository';
import type { RankingResponse } from './ranking.types';

export async function getRanking(currentUserId: number): Promise<RankingResponse> {
  return repo.getRanking(currentUserId);
}
