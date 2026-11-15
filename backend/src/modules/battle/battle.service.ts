import * as repository from './battle.repository';

export interface BattleRecentResult {
  match_id: number;
  won: boolean;
  opponent_name: string;
  played_at: string;
}

export interface BattleSummary {
  played: number;
  wins: number;
  losses: number;
  win_rate: number;
  win_streak: number;
  last_played_at: string | null;
  /** Newest-first results for the form strip on the result screen. */
  recent: BattleRecentResult[];
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function maskExample(example: string, word: string): string {
  const pattern = new RegExp(`\\b${escapeForRegExp(word)}(?:s|es|d|ed|ing|ly|er|ers|est)?\\b`, 'gi');
  return example.replace(pattern, (match) => '•'.repeat(match.length));
}


export async function getBattleSummary(userId: number): Promise<BattleSummary> {
  const summary = await repository.getMatchSummary(userId);
  const losses = Math.max(0, summary.played - summary.wins);
  return {
    played: summary.played,
    wins: summary.wins,
    losses,
    win_rate: summary.played > 0 ? Math.round((summary.wins / summary.played) * 100) : 0,
    win_streak: summary.winStreak,
    last_played_at: summary.lastPlayedAt ? summary.lastPlayedAt.toISOString() : null,
    recent: summary.recent.map((entry) => ({
      match_id: entry.matchId,
      won: entry.won,
      opponent_name: entry.opponentName,
      played_at: entry.playedAt.toISOString(),
    })),
  };
}
