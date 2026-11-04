import type {
  BattleOpponent,
  BattleQuestion,
  BattleRoundEnd,
  BattleScore,
  BattleStart,
} from '../types/video'

const STORAGE_KEY = 'engorace_arena_match'
const MAX_AGE_MS = 5 * 60 * 1000

export interface BattleSessionSnapshot {
  matchId: number
  game: BattleStart
  opponent: BattleOpponent | null
  question: BattleQuestion | null
  roundEnd: BattleRoundEnd | null
  scores: BattleScore[]
  savedAt: number
}

export function saveBattleSession(snapshot: BattleSessionSnapshot): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    /* storage can be unavailable in private mode */
  }
}

export function readBattleSession(): BattleSessionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BattleSessionSnapshot>
    if (
      typeof parsed.matchId !== 'number'
      || typeof parsed.savedAt !== 'number'
      || Date.now() - parsed.savedAt > MAX_AGE_MS
      || !parsed.game
      || !Array.isArray(parsed.scores)
    ) {
      clearBattleSession()
      return null
    }
    return {
      matchId: parsed.matchId,
      game: parsed.game,
      opponent: parsed.opponent ?? null,
      question: parsed.question ?? null,
      roundEnd: parsed.roundEnd ?? null,
      scores: parsed.scores,
      savedAt: parsed.savedAt,
    }
  } catch {
    clearBattleSession()
    return null
  }
}

export function clearBattleSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage can be unavailable in private mode */
  }
}
