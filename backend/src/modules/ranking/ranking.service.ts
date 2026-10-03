import * as repo from './ranking.repository';
import type { RankingEntry, RankingResponse } from './ranking.types';

export async function getRanking(currentUserId: number): Promise<RankingResponse> {
  const rows = await repo.getLeaderboard();
  const leaderboard: RankingEntry[] = rows.map((row) => ({
    rank: Number(row.rank),
    userId: Number(row.userId),
    name: row.name,
    avatar: row.avatar,
    xp: Number(row.xp),
  }));
  const currentUser = leaderboard.find((entry) => entry.userId === currentUserId);

  return {
    leaderboard,
    current_user_rank: currentUser?.rank ?? null,
  };
}