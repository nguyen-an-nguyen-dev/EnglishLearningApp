import type { Server as HttpServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { Server, type Socket } from 'socket.io';
import { env } from '../../config/env';
import { getVerifiedJwtSecret } from '../auth/auth.service';
import * as repository from './battle.repository';
import type { BattleWord } from './battle.repository';

type ClientEvents = {
  'match:join': () => void;
  'match:leave': () => void;
  'game:answer': (payload: unknown) => void;
};

type ServerEvents = {
  'match:found': (payload: MatchFoundPayload) => void;
  'game:start': (payload: GameStartPayload) => void;
  'game:question': (payload: GameQuestionPayload) => void;
  'game:answerResult': (payload: AnswerResultPayload) => void;
  'game:roundEnd': (payload: RoundEndPayload) => void;
  'game:finish': (payload: GameFinishPayload) => void;
  'game:error': (payload: { code: string; message: string }) => void;
};

type SocketData = { userId: number };
type BattleSocket = Socket<ClientEvents, ServerEvents, Record<string, never>, SocketData>;

export interface BattleRepository {
  getPlayerName(userId: number): Promise<string | undefined>;
  getWords(limit: number, levels: string[]): Promise<BattleWord[]>;
  createMatch(playerOneId: number, playerTwoId: number): Promise<number>;
  recordAnswer(matchId: number, userId: number, round: number, answer: string, isCorrect: boolean, responseTimeMs: number): Promise<void>;
  finishMatch(matchId: number, status: 'completed' | 'cancelled', winnerUserId: number | null): Promise<void>;
}

interface Player {
  userId: number;
  socket: BattleSocket;
  name: string;
}

interface PendingPair {
  players: [Player, Player];
  cancelled: boolean;
  matchId?: number;
}

interface Submission {
  answer: string;
  correct: boolean;
  responseTimeMs: number;
}

interface MatchState {
  id: number;
  players: [Player, Player];
  words: BattleWord[];
  round: number;
  startedAt: number;
  answers: Map<number, Submission>;
  scores: Map<number, number>;
  status: 'active' | 'completed' | 'cancelled';
  resolving: boolean;
  timer: NodeJS.Timeout | null;
}

interface MatchFoundPayload {
  matchId: number;
  opponent: { userId: number; name: string };
}

interface GameStartPayload {
  matchId: number;
  players: Array<{ userId: number; name: string }>;
  totalRounds: number;
  roundDurationMs: number;
}

interface GameQuestionPayload {
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

interface AnswerResultPayload {
  matchId: number;
  round: number;
  correct: false;
  responseTimeMs: number;
}

interface RoundEndPayload {
  matchId: number;
  round: number;
  totalRounds: number;
  wordId: number;
  answer: string;
  example: string;
  winnerUserId: number | null;
  timedOut: boolean;
  scores: Array<{ userId: number; name: string; score: number }>;
}

interface GameFinishPayload {
  matchId: number;
  status: 'completed' | 'cancelled';
  winnerUserId: number | null;
  scores: Array<{ userId: number; name: string; score: number }>;
  totalRounds: number;
  reason?: 'opponent_disconnected' | 'left' | 'server_error';
}

export const BATTLE_ROUNDS = 12;
export const BATTLE_ROUND_MS = 30_000;
export const BATTLE_REVEAL_MS = 4_500;
// Most of a match should stay playable, so ~70% of the words come from the easier bands.
export const BATTLE_EASY_SHARE = 0.7;
export const BATTLE_EASY_LEVELS = ['A1', 'A2', 'B1'];
export const BATTLE_HARD_LEVELS = ['B2', 'C1', 'C2'];

export interface BattleTiming {
  roundMs: number;
  revealMs: number;
}

function normalizeAnswer(answer: string): string {
  return answer
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The example sentence would give the word away, so every inflected form of it is hidden
// behind blanks of the same length while the round is still being guessed.
function maskExample(example: string, word: string): string {
  const pattern = new RegExp(`\\b${escapeForRegExp(word)}(?:s|es|d|ed|ing|ly|er|ers|est)?\\b`, 'gi');
  return example.replace(pattern, (match) => '*'.repeat(match.length));
}

// Hints sit inside the answer tiles: always the first letter, the 5th one from 6 letters,
// and the last one from 10 letters, so short words still need most of the spelling.
function letterHints(word: string): Array<{ position: number; letter: string }> {
  const positions = new Set<number>(word.length > 1 ? [0] : []);
  if (word.length >= 6) positions.add(4);
  if (word.length >= 10) positions.add(word.length - 1);
  return [...positions]
    .sort((a, b) => a - b)
    .map((position) => ({ position, letter: word[position] }));
}

function shuffleWords(words: BattleWord[]): BattleWord[] {
  const shuffled = [...words];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function isUserId(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value > 0;
}

export function attachBattleSocket(
  httpServer: HttpServer,
  battleRepository: BattleRepository = repository,
  timing: BattleTiming = { roundMs: BATTLE_ROUND_MS, revealMs: BATTLE_REVEAL_MS },
): Server<ClientEvents, ServerEvents, Record<string, never>, SocketData> {
  const io = new Server<ClientEvents, ServerEvents, Record<string, never>, SocketData>(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error('Origin not allowed.'));
        }
      },
      methods: ['GET', 'POST'],
    },
  });

  const waitingPlayers: Player[] = [];
  const waitingByUser = new Map<number, Player>();
  const joiningUsers = new Set<number>();
  const activeUsers = new Set<number>();
  const pendingBySocket = new Map<string, PendingPair>();
  const matchesBySocket = new Map<string, MatchState>();
  const matches = new Map<number, MatchState>();
  const cancelledJoins = new Set<string>();

  io.use((socket, next) => {
    const authToken = socket.handshake.auth.token;
    const authorization = socket.handshake.headers.authorization;
    const headerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const token = typeof authToken === 'string' ? authToken : headerToken;
    if (!token) {
      next(new Error('Authentication required.'));
      return;
    }
    try {
      const payload = jwt.verify(token, getVerifiedJwtSecret());
      if (typeof payload === 'string' || !/^\d+$/.test(payload.sub ?? '')) {
        throw new Error('Invalid token subject.');
      }
      const userId = Number(payload.sub);
      if (!isUserId(userId)) throw new Error('Invalid token subject.');
      socket.data.userId = userId;
      next();
    } catch {
      next(new Error('Invalid or expired authentication token.'));
    }
  });

  function emitError(socket: BattleSocket, code: string, message: string): void {
    socket.emit('game:error', { code, message });
  }

  function scoresFor(match: MatchState): Array<{ userId: number; name: string; score: number }> {
    return match.players.map((player) => ({
      userId: player.userId,
      name: player.name,
      score: match.scores.get(player.userId) ?? 0,
    }));
  }

  function releasePlayers(players: Player[]): void {
    for (const player of players) activeUsers.delete(player.userId);
  }

  function clearRoundTimer(match: MatchState): void {
    if (!match.timer) return;
    clearTimeout(match.timer);
    match.timer = null;
  }

  async function persistMatchEnd(
    matchId: number,
    status: 'completed' | 'cancelled',
    winnerUserId: number | null,
  ): Promise<void> {
    await battleRepository.finishMatch(matchId, status, winnerUserId);
  }

  async function cancelMatch(
    match: MatchState,
    reason: 'opponent_disconnected' | 'left' | 'server_error',
    leavingSocketId?: string,
  ): Promise<void> {
    if (match.status !== 'active') return;
    match.status = 'cancelled';
    clearRoundTimer(match);
    matches.delete(match.id);
    releasePlayers(match.players);
    for (const player of match.players) matchesBySocket.delete(player.socket.id);
    try {
      await persistMatchEnd(match.id, 'cancelled', null);
    } catch (error) {
      console.error('Failed to persist cancelled Word Battle match:', error);
      for (const player of match.players) emitError(player.socket, 'PERSISTENCE_ERROR', 'The match could not be saved. Please try again.');
    }
    const payload: GameFinishPayload = {
      matchId: match.id,
      status: 'cancelled',
      winnerUserId: null,
      scores: scoresFor(match),
      totalRounds: match.words.length,
      reason,
    };
    for (const player of match.players) {
      if (player.socket.id !== leavingSocketId && player.socket.connected) player.socket.emit('game:finish', payload);
    }
    if (leavingSocketId) {
      const leavingPlayer = match.players.find((player) => player.socket.id === leavingSocketId);
      if (leavingPlayer?.socket.connected) leavingPlayer.socket.emit('game:finish', payload);
    }
  }

  async function cancelPendingPair(pair: PendingPair, leavingSocketId: string): Promise<void> {
    if (pair.cancelled) return;
    pair.cancelled = true;
    releasePlayers(pair.players);
    for (const player of pair.players) pendingBySocket.delete(player.socket.id);
    const other = pair.players.find((player) => player.socket.id !== leavingSocketId);
    if (other?.socket.connected) {
      other.socket.emit('game:finish', {
        matchId: pair.matchId ?? 0,
        status: 'cancelled',
        winnerUserId: null,
        scores: pair.players.map((player) => ({ userId: player.userId, name: player.name, score: 0 })),
        totalRounds: 0,
        reason: 'opponent_disconnected',
      });
    }
    if (pair.matchId) {
      try {
        await persistMatchEnd(pair.matchId, 'cancelled', null);
      } catch (error) {
        console.error('Failed to persist interrupted Word Battle match:', error);
        if (other?.socket.connected) emitError(other.socket, 'PERSISTENCE_ERROR', 'The match could not be saved. Please try again.');
      }
    }
  }

  function questionPayload(match: MatchState): GameQuestionPayload {
    const word = match.words[match.round - 1];
    return {
      matchId: match.id,
      round: match.round,
      totalRounds: match.words.length,
      wordId: word.id,
      translation: word.translation,
      partOfSpeech: word.partOfSpeech,
      cefrLevel: word.cefrLevel,
      explanation: word.explanation,
      example: maskExample(word.exampleEn, word.word),
      exampleVi: word.exampleVi,
      letterCount: word.word.length,
      letterHints: letterHints(word.word),
      imageUrl: word.imageUrl,
      durationMs: timing.roundMs,
    };
  }

  function beginRound(match: MatchState): void {
    if (match.status !== 'active') return;
    match.answers = new Map();
    match.resolving = false;
    match.startedAt = Date.now();
    const payload = questionPayload(match);
    match.timer = setTimeout(() => {
      match.timer = null;
      expireRound(match);
    }, timing.roundMs);
    for (const player of match.players) player.socket.emit('game:question', payload);
  }

  // Nobody guessed in time: the round closes with no winner and the word is revealed anyway.
  function expireRound(match: MatchState): void {
    if (match.status !== 'active' || match.resolving) return;
    match.resolving = true;
    void resolveRound(match, null);
  }

  async function resolveRound(match: MatchState, roundWinnerUserId: number | null): Promise<void> {
    if (match.status !== 'active' || !match.resolving) return;
    clearRoundTimer(match);
    const timedOut = roundWinnerUserId === null;
    const word = match.words[match.round - 1];
    for (const player of match.players) {
      if (!match.answers.has(player.userId)) {
        match.answers.set(player.userId, {
          answer: '',
          correct: false,
          responseTimeMs: Math.max(0, Date.now() - match.startedAt),
        });
      }
    }
    try {
      await Promise.all(match.players.map((player) => {
        const submission = match.answers.get(player.userId);
        if (!submission) throw new Error('A Word Battle answer is missing.');
        return battleRepository.recordAnswer(
          match.id,
          player.userId,
          match.round,
          submission.answer,
          submission.correct,
          submission.responseTimeMs,
        );
      }));
    } catch (error) {
      console.error('Failed to persist Word Battle answers:', error);
      match.resolving = false;
      for (const player of match.players) emitError(player.socket, 'PERSISTENCE_ERROR', 'The round could not be saved. The match has ended.');
      await cancelMatch(match, 'server_error');
      return;
    }
    if (match.status !== 'active') return;

    if (roundWinnerUserId !== null) {
      match.scores.set(roundWinnerUserId, (match.scores.get(roundWinnerUserId) ?? 0) + 1);
    }

    const roundEndPayload: RoundEndPayload = {
      matchId: match.id,
      round: match.round,
      totalRounds: match.words.length,
      wordId: word.id,
      answer: word.word,
      example: word.exampleEn,
      winnerUserId: roundWinnerUserId,
      timedOut,
      scores: scoresFor(match),
    };
    for (const player of match.players) player.socket.emit('game:roundEnd', roundEndPayload);

    match.timer = setTimeout(() => {
      match.timer = null;
      void advanceRound(match);
    }, timing.revealMs);
  }

  async function advanceRound(match: MatchState): Promise<void> {
    if (match.status !== 'active') return;
    clearRoundTimer(match);

    if (match.round >= match.words.length) {
      const [playerOne, playerTwo] = match.players;
      const playerOneScore = match.scores.get(playerOne.userId) ?? 0;
      const playerTwoScore = match.scores.get(playerTwo.userId) ?? 0;
      const winnerUserId = playerOneScore === playerTwoScore
        ? null
        : playerOneScore > playerTwoScore ? playerOne.userId : playerTwo.userId;
      match.status = 'completed';
      matches.delete(match.id);
      releasePlayers(match.players);
      for (const player of match.players) matchesBySocket.delete(player.socket.id);
      try {
        await persistMatchEnd(match.id, 'completed', winnerUserId);
      } catch (error) {
        console.error('Failed to persist completed Word Battle match:', error);
        for (const player of match.players) emitError(player.socket, 'PERSISTENCE_ERROR', 'The match result could not be saved.');
      }
      const finishPayload: GameFinishPayload = {
        matchId: match.id,
        status: 'completed',
        winnerUserId,
        scores: scoresFor(match),
        totalRounds: match.words.length,
      };
      for (const player of match.players) player.socket.emit('game:finish', finishPayload);
      return;
    }

    match.round += 1;
    beginRound(match);
  }

  async function createMatch(pair: PendingPair): Promise<void> {
    const easyCount = Math.round(BATTLE_ROUNDS * BATTLE_EASY_SHARE);
    const [easyWords, hardWords] = await Promise.all([
      battleRepository.getWords(easyCount, BATTLE_EASY_LEVELS),
      battleRepository.getWords(BATTLE_ROUNDS - easyCount, BATTLE_HARD_LEVELS),
    ]);
    const words = shuffleWords([...easyWords, ...hardWords]);
    if (words.length < BATTLE_ROUNDS) {
      throw new Error(`Word Battle needs ${BATTLE_ROUNDS} words (${easyCount} easy, ${BATTLE_ROUNDS - easyCount} hard); found ${words.length}.`);
    }
    if (words.some((word) => word.word.trim().split(/\s+/).length !== 1)) {
      throw new Error('Every Word Battle target must be a single vocabulary word.');
    }
    if (pair.cancelled) return;
    const matchId = await battleRepository.createMatch(pair.players[0].userId, pair.players[1].userId);
    pair.matchId = matchId;
    if (pair.cancelled) {
      await persistMatchEnd(matchId, 'cancelled', null);
      return;
    }
    const match: MatchState = {
      id: matchId,
      players: pair.players,
      words,
      round: 1,
      startedAt: Date.now(),
      answers: new Map(),
      scores: new Map(pair.players.map((player) => [player.userId, 0])),
      status: 'active',
      resolving: false,
      timer: null,
    };
    matches.set(matchId, match);
    for (const player of pair.players) {
      pendingBySocket.delete(player.socket.id);
      matchesBySocket.set(player.socket.id, match);
    }
    for (const player of pair.players) {
      const opponent = pair.players.find((candidate) => candidate.userId !== player.userId);
      if (!opponent) throw new Error('A Word Battle opponent is missing.');
      player.socket.emit('match:found', {
        matchId,
        opponent: { userId: opponent.userId, name: opponent.name },
      });
    }
    for (const player of pair.players) {
      player.socket.emit('game:start', {
        matchId,
        players: pair.players.map(({ userId, name }) => ({ userId, name })),
        totalRounds: match.words.length,
        roundDurationMs: timing.roundMs,
      });
    }
    beginRound(match);
  }

  async function joinQueue(socket: BattleSocket): Promise<void> {
    const userId = socket.data.userId;
    if (matchesBySocket.has(socket.id) || pendingBySocket.has(socket.id)) {
      emitError(socket, 'ALREADY_IN_MATCH', 'You are already in a match.');
      return;
    }
    if (waitingByUser.has(userId) || joiningUsers.has(userId) || activeUsers.has(userId)) {
      emitError(socket, 'ALREADY_QUEUED', 'You are already waiting for or playing a match.');
      return;
    }

    joiningUsers.add(userId);
    try {
      const name = await battleRepository.getPlayerName(userId);
      if (!name) {
        emitError(socket, 'USER_NOT_FOUND', 'Your account could not be found.');
        return;
      }
      if (!socket.connected || cancelledJoins.has(socket.id)) return;
      const player: Player = { userId, socket, name };
      const opponent = waitingPlayers.shift();
      if (!opponent) {
        waitingPlayers.push(player);
        waitingByUser.set(userId, player);
        return;
      }
      waitingByUser.delete(opponent.userId);
      const pair: PendingPair = { players: [opponent, player], cancelled: false };
      activeUsers.add(opponent.userId);
      activeUsers.add(userId);
      for (const member of pair.players) pendingBySocket.set(member.socket.id, pair);
      try {
        await createMatch(pair);
      } catch (error) {
        console.error('Failed to create Word Battle match:', error);
        if (!pair.cancelled) {
          pair.cancelled = true;
          if (pair.matchId) {
            const match = matches.get(pair.matchId);
            if (match) {
              match.status = 'cancelled';
              matches.delete(match.id);
              for (const member of match.players) matchesBySocket.delete(member.socket.id);
            }
            try {
              await persistMatchEnd(pair.matchId, 'cancelled', null);
            } catch (persistenceError) {
              console.error('Failed to persist interrupted Word Battle match:', persistenceError);
            }
          }
          releasePlayers(pair.players);
          for (const member of pair.players) {
            pendingBySocket.delete(member.socket.id);
            emitError(member.socket, 'MATCH_CREATION_FAILED', 'A match could not be started. Please try again.');
          }
        }
      }
    } finally {
      joiningUsers.delete(userId);
      cancelledJoins.delete(socket.id);
    }
  }

  function leaveQueue(socket: BattleSocket): void {
    if (joiningUsers.has(socket.data.userId)) cancelledJoins.add(socket.id);
    const player = waitingByUser.get(socket.data.userId);
    if (!player || player.socket.id !== socket.id) return;
    waitingByUser.delete(player.userId);
    const index = waitingPlayers.findIndex((candidate) => candidate.socket.id === socket.id);
    if (index >= 0) waitingPlayers.splice(index, 1);
  }

  io.on('connection', (socket) => {
    const battleSocket = socket as BattleSocket;
    battleSocket.on('match:join', () => {
      void joinQueue(battleSocket).catch((error: unknown) => {
        console.error('Word Battle matchmaking failed:', error);
        emitError(battleSocket, 'MATCHMAKING_FAILED', 'Matchmaking failed. Please try again.');
      });
    });
    battleSocket.on('match:leave', () => {
      const match = matchesBySocket.get(battleSocket.id);
      if (match) {
        void cancelMatch(match, 'left', battleSocket.id);
        return;
      }
      const pendingPair = pendingBySocket.get(battleSocket.id);
      if (pendingPair) {
        void cancelPendingPair(pendingPair, battleSocket.id);
        return;
      }
      leaveQueue(battleSocket);
    });
    battleSocket.on('game:answer', (payload) => {
      const match = matchesBySocket.get(battleSocket.id);
      if (!match || match.status !== 'active') {
        emitError(battleSocket, 'NOT_IN_MATCH', 'You are not in an active match.');
        return;
      }
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        emitError(battleSocket, 'INVALID_ANSWER', 'Submit a round, word ID, and answer.');
        return;
      }
      const data = payload as { round?: unknown; wordId?: unknown; answer?: unknown };
      const word = match.words[match.round - 1];
      if (data.round !== match.round || data.wordId !== word.id) {
        emitError(battleSocket, 'STALE_QUESTION', 'That word is no longer active.');
        return;
      }
      if (typeof data.answer !== 'string' || !data.answer.trim() || data.answer.trim().length > 500) {
        emitError(battleSocket, 'INVALID_ANSWER', 'Answer must contain between 1 and 500 characters.');
        return;
      }
      if (match.resolving) return;

      const answer = data.answer.trim();
      const correct = normalizeAnswer(answer) === normalizeAnswer(word.word);
      match.answers.set(battleSocket.data.userId, {
        answer,
        correct,
        responseTimeMs: Math.max(0, Date.now() - match.startedAt),
      });
      if (correct) {
        match.resolving = true;
        void resolveRound(match, battleSocket.data.userId);
        return;
      }
      battleSocket.emit('game:answerResult', {
        matchId: match.id,
        round: match.round,
        correct: false,
        responseTimeMs: match.answers.get(battleSocket.data.userId)!.responseTimeMs,
      });
    });
    battleSocket.on('disconnect', () => {
      leaveQueue(battleSocket);
      const pair = pendingBySocket.get(battleSocket.id);
      if (pair) void cancelPendingPair(pair, battleSocket.id);
      const match = matchesBySocket.get(battleSocket.id);
      if (match) void cancelMatch(match, 'opponent_disconnected', battleSocket.id);
    });
  });

  return io;
}
