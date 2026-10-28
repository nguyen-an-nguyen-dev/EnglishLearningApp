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
  totalRounds: number;
  wordId: number;
  translation: string;
  partOfSpeech: string;
  cefrLevel: string;
  explanation: string;
  example: string;
  exampleVi: string;
  letterCount: number;
  letterHints: Array<{ position: number; letter: string }>;
  imageUrl: string | null;
  durationMs: number;
}

export interface BattleStart {
  matchId: number;
  players: BattleOpponent[];
  totalRounds: number;
  roundDurationMs: number;
}

export interface BattleAnswerResult {
  matchId: number;
  round: number;
  correct: false;
  responseTimeMs: number;
}

export interface BattleRoundEnd {
  matchId: number;
  round: number;
  totalRounds: number;
  wordId: number;
  answer: string;
  example: string;
  winnerUserId: number | null;
  timedOut: boolean;
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
  'game:answer': (payload: { round: number; wordId: number; answer: string }) => void;
}

interface ServerToClientEvents {
  'match:found': (payload: { matchId: number; opponent: BattleOpponent }) => void;
  'game:start': (payload: BattleStart) => void;
  'game:question': (payload: BattleQuestion) => void;
  'game:answerResult': (payload: BattleAnswerResult) => void;
  'game:roundEnd': (payload: BattleRoundEnd) => void;
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
