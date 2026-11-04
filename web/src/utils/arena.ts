export function scoreLabel(correct: number, total: number): string {
  if (total <= 0) return '0/0'
  return `${correct}/${total}`
}

export function winRate(wins: number, played: number): number {
  if (played <= 0) return 0
  return Math.round((wins / played) * 100)
}

export function matchOutcome(
  winnerUserId: number | null,
  currentUserId: number,
): 'win' | 'lose' | 'draw' {
  if (winnerUserId === null) return 'draw'
  return winnerUserId === currentUserId ? 'win' : 'lose'
}

export function remainingSeconds(startedAt: number, durationMs: number, now: number): number {
  const elapsed = Math.max(0, now - startedAt)
  return Math.max(0, Math.ceil((durationMs - elapsed) / 1000))
}
