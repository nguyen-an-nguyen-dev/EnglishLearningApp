import { io, type Socket } from 'socket.io-client';
import { getSocketBaseUrl } from '@/services/api';

export interface BattleOpponent {
  userId: number;
  name: string;
}

export interface BattleScore {
  userId: number;
  name: string;
  score: number;
}

export interface BattleQuestion {
  matchId: number;
  round: number;
  questionId: number;
  prompt: string;
  totalRounds: number;
}

export interface BattleStart {
  matchId: number;
  players: BattleOpponent[];
  totalRounds: number;
}

export interface BattleAnswerResult {
  matchId: number;
  round: number;
  roundWinnerUserId: number | null;
  correct: boolean;
  responseTimeMs: number;
  scores: BattleScore[];
}

export interface BattleFinish {
  matchId: number;
  status: 'completed' | 'cancelled';
  winnerUserId: number | null;
  scores: BattleScore[];
  totalRounds: number;
  reason?: 'opponent_disconnected' | 'left' | 'server_error';
}

interface ClientToServerEvents {
  'match:join': () => void;
  'match:leave': () => void;
  'game:answer': (payload: { round: number; questionId: number; answer: string }) => void;
}

interface ServerToClientEvents {
  'match:found': (payload: { matchId: number; opponent: BattleOpponent }) => void;
  'game:start': (payload: BattleStart) => void;
  'game:question': (payload: BattleQuestion) => void;
  'game:answerResult': (payload: BattleAnswerResult) => void;
  'game:nextQuestion': (payload: { round: number }) => void;
  'game:finish': (payload: BattleFinish) => void;
  'game:error': (payload: { code: string; message: string }) => void;
}

export function createBattleSocket(token: string): Socket<ServerToClientEvents, ClientToServerEvents> {
  return io(getSocketBaseUrl(), {
    autoConnect: false,
    auth: { token },
    reconnection: false,
    timeout: 10_000,
  });
}
