import { io, type Socket } from 'socket.io-client'
import { requestApi } from './apiClient'
import type {
  ArenaSummary,
  BattleAnswerResult,
  BattleFinish,
  BattleOpponent,
  BattleQuestion,
  BattleResume,
  BattleRoundEnd,
  BattleScore,
  BattleStart,
} from '../types/video'

interface ClientToServerEvents {
  'match:join': () => void
  'match:leave': () => void
  'game:resume': (payload: { matchId: number }) => void
  'game:answer': (payload: { round: number; wordId: number; answer: string }) => void
  'game:attempt': (payload: { text: string }) => void
}

interface ServerToClientEvents {
  'match:found': (payload: { matchId: number; opponent: BattleOpponent }) => void
  'game:start': (payload: BattleStart) => void
  'game:question': (payload: BattleQuestion) => void
  'game:answerResult': (payload: BattleAnswerResult) => void
  'game:opponentAttempt': (payload: { text: string }) => void
  'game:opponentAway': (payload: { away: boolean }) => void
  'game:roundEnd': (payload: BattleRoundEnd) => void
  'game:finish': (payload: BattleFinish) => void
  'game:resume': (payload: BattleResume) => void
  'game:resumeFailed': (payload: { matchId: number; message: string }) => void
  'game:error': (payload: { code: string; message: string }) => void
}

export type BattleSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export function createBattleSocket(token: string): BattleSocket {
  return io({
    autoConnect: false,
    auth: { token },
    reconnection: false,
    timeout: 10_000,
  })
}

export async function getArenaSummaryApi(): Promise<ArenaSummary> {
  return requestApi<ArenaSummary>('/api/battle/summary')
}


export type {
  BattleAnswerResult,
  BattleFinish,
  BattleOpponent,
  BattleQuestion,
  BattleResume,
  BattleRoundEnd,
  BattleScore,
  BattleStart,
}
