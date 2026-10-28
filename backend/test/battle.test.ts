import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer, type Server as HttpServer } from 'node:http';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import type { BattleWord } from '../src/modules/battle/battle.repository';
import { BATTLE_ROUNDS, type BattleRepository } from '../src/modules/battle/battle.socket';

// Shorten the real 30s round / 4.5s reveal so the whole match stays a fast test.
const TEST_ROUND_MS = 1_500;
const TEST_REVEAL_MS = 150;

// Eight easy and four hard words, matching the 70/30 split the socket asks the repository for.
// 'environment' and 'beautiful' are long enough to exercise every hint position.
const vocabulary: Array<[string, string, string]> = [
  ['cat', 'mèo', 'A1'], ['dog', 'chó', 'A1'], ['apple', 'táo', 'A2'], ['book', 'sách', 'A2'],
  ['water', 'nước', 'B1'], ['house', 'nhà', 'B1'], ['school', 'trường', 'A1'], ['friend', 'bạn', 'A2'],
  ['run', 'chạy', 'B2'], ['happy', 'vui', 'B2'], ['environment', 'môi trường', 'C1'], ['beautiful', 'đẹp', 'C2'],
];

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}

class MemoryBattleRepository implements BattleRepository {
  readonly answers: Array<{
    matchId: number;
    userId: number;
    round: number;
    answer: string;
    isCorrect: boolean;
    responseTimeMs: number;
  }> = [];
  readonly finished: Array<{ matchId: number; status: string; winnerUserId: number | null }> = [];
  private nextMatchId = 1;

  async getPlayerName(userId: number): Promise<string> {
    return `Player ${userId}`;
  }

  // Mirrors the real repository: each CEFR band pool is drawn separately.
  async getWords(limit: number, levels: string[]): Promise<BattleWord[]> {
    return vocabulary
      .map(([word, translation, cefrLevel], index) => ({ word, translation, cefrLevel, id: index + 1 }))
      .filter((entry) => levels.includes(entry.cefrLevel))
      .slice(0, limit)
      .map((entry) => ({
        ...entry,
        partOfSpeech: 'noun',
        explanation: 'Lời giải thích bằng tiếng Việt.',
        exampleEn: `My ${entry.word} is here.`,
        exampleVi: `${entry.translation} của tôi ở đây.`,
        imageUrl: entry.id === 1 ? 'https://example.test/cat.png' : null,
      }));
  }

  async createMatch(): Promise<number> {
    return this.nextMatchId++;
  }

  async recordAnswer(
    matchId: number,
    userId: number,
    round: number,
    answer: string,
    isCorrect: boolean,
    responseTimeMs: number,
  ): Promise<void> {
    this.answers.push({ matchId, userId, round, answer, isCorrect, responseTimeMs });
  }

  async finishMatch(matchId: number, status: 'completed' | 'cancelled', winnerUserId: number | null): Promise<void> {
    this.finished.push({ matchId, status, winnerUserId });
  }
}

let httpServer: HttpServer;
let repository: MemoryBattleRepository;
let serverUrl: string;
let closeIo: (() => Promise<void>) | undefined;

interface Question {
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

interface RoundEnd {
  matchId: number;
  round: number;
  wordId: number;
  answer: string;
  example: string;
  winnerUserId: number | null;
  timedOut: boolean;
  scores: Array<{ userId: number; name: string; score: number }>;
}

function tokenFor(userId: number): string {
  return jwt.sign({}, process.env.JWT_SECRET!, { subject: String(userId), expiresIn: '1h' });
}

async function connectClient(userId: number, token = tokenFor(userId)): Promise<ClientSocket> {
  const client = createClient(serverUrl, {
    auth: { token },
    reconnection: false,
    transports: ['websocket'],
  });
  await waitForEvent(client, 'connect');
  return client;
}

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 3_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`Timed out waiting for ${event}.`));
    }, timeoutMs);
    const listener = (payload: T) => {
      clearTimeout(timeout);
      resolve(payload);
    };
    socket.once(event, listener);
  });
}

function joinMatch(first: ClientSocket, second: ClientSocket) {
  const firstFound = waitForEvent<{ matchId: number }>(first, 'match:found');
  const secondFound = waitForEvent<{ matchId: number }>(second, 'match:found');
  const firstStart = waitForEvent<{ totalRounds: number; roundDurationMs: number }>(first, 'game:start');
  const firstQuestion = waitForEvent<Question>(first, 'game:question');
  const secondQuestion = waitForEvent<Question>(second, 'game:question');
  first.emit('match:join');
  second.emit('match:join');
  return Promise.all([firstFound, secondFound, firstStart, firstQuestion, secondQuestion]);
}

function submitAnswer(socket: ClientSocket, question: { round: number; wordId: number }, answer: string, extras = {}) {
  socket.emit('game:answer', { round: question.round, wordId: question.wordId, answer, ...extras });
}

function wordFor(question: Question): string {
  return vocabulary[question.wordId - 1][0];
}

function expectedHints(word: string): Array<{ position: number; letter: string }> {
  const positions: number[] = word.length > 1 ? [0] : [];
  if (word.length >= 6) positions.push(4);
  if (word.length >= 10) positions.push(word.length - 1);
  return positions.map((position) => ({ position, letter: word[position] }));
}

before(async () => {
  const { attachBattleSocket } = await import('../src/modules/battle/battle.socket.js');
  repository = new MemoryBattleRepository();
  httpServer = createServer();
  const io = attachBattleSocket(httpServer, repository, { roundMs: TEST_ROUND_MS, revealMs: TEST_REVEAL_MS });
  closeIo = () => new Promise((resolve) => io.close(() => resolve()));
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Word Battle test server failed to bind.');
  serverUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await closeIo?.();
});

test('Socket.IO requires a valid JWT before accepting a client', async () => {
  const missingTokenClient = createClient(serverUrl, {
    reconnection: false,
    transports: ['websocket'],
  });
  const missingTokenError = waitForEvent<Error>(missingTokenClient, 'connect_error');
  const invalidTokenClient = createClient(serverUrl, {
    auth: { token: 'not-a-valid-jwt' },
    reconnection: false,
    transports: ['websocket'],
  });
  const invalidTokenError = waitForEvent<Error>(invalidTokenClient, 'connect_error');
  assert.match((await missingTokenError).message, /Authentication required/);
  assert.match((await invalidTokenError).message, /Invalid or expired/);
  missingTokenClient.disconnect();
  invalidTokenClient.disconnect();
});

test('a round only reveals hints, never the answer, and the first correct guess wins it', async () => {
  const first = await connectClient(101);
  const second = await connectClient(102);
  try {
    const [, , game, firstQuestion, secondQuestion] = await joinMatch(first, second);
    assert.equal(game.totalRounds, BATTLE_ROUNDS);
    assert.equal(game.roundDurationMs, TEST_ROUND_MS);
    assert.deepEqual(firstQuestion, secondQuestion);
    assert.equal(firstQuestion.round, 1);
    assert.equal(firstQuestion.totalRounds, BATTLE_ROUNDS);
    assert.equal(firstQuestion.durationMs, TEST_ROUND_MS);
    assert.equal(firstQuestion.letterCount, wordFor(firstQuestion).length);
    assert.equal(firstQuestion.translation, vocabulary[firstQuestion.wordId - 1][1]);
    assert.equal(firstQuestion.partOfSpeech, 'noun');
    assert.equal(firstQuestion.cefrLevel, vocabulary[firstQuestion.wordId - 1][2]);
    assert.deepEqual(firstQuestion.letterHints, expectedHints(wordFor(firstQuestion)));

    const hints = `${firstQuestion.translation} ${firstQuestion.example} ${firstQuestion.exampleVi} ${firstQuestion.explanation}`;
    assert.ok(!hints.includes(wordFor(firstQuestion)));
    assert.match(firstQuestion.example, /\*{3}/);

    const prematureRoundEnd = waitForEvent<RoundEnd>(first, 'game:roundEnd', 400).catch(() => null);
    assert.equal(await prematureRoundEnd, null);

    const malformed = waitForEvent<{ code: string }>(first, 'game:error');
    await submitAnswer(first, firstQuestion, '', { correct: true, score: 99_999, winner: 102 });
    assert.equal((await malformed).code, 'INVALID_ANSWER');

    const wrongAttempt = waitForEvent<{ correct: boolean; round: number }>(first, 'game:answerResult');
    await submitAnswer(first, firstQuestion, 'definitely-not-the-word', { correct: true, score: 99_999, winner: 102 });
    const wrongResult = await wrongAttempt;
    assert.equal(wrongResult.correct, false);
    assert.equal(wrongResult.round, 1);

    const stale = waitForEvent<{ code: string }>(second, 'game:error');
    second.emit('game:answer', { round: 99, wordId: firstQuestion.wordId, answer: wordFor(firstQuestion) });
    assert.equal((await stale).code, 'STALE_QUESTION');

    const winnerReveal = waitForEvent<RoundEnd>(first, 'game:roundEnd');
    const otherReveal = waitForEvent<RoundEnd>(second, 'game:roundEnd');
    const nextRound = Promise.all([
      waitForEvent<Question>(first, 'game:question'),
      waitForEvent<Question>(second, 'game:question'),
    ]);
    await submitAnswer(first, firstQuestion, wordFor(firstQuestion), { correct: false, score: 99_999, winner: 102 });
    const [winnerResult, otherResult] = await Promise.all([winnerReveal, otherReveal]);
    assert.equal(winnerResult.answer, wordFor(firstQuestion));
    assert.equal(winnerResult.example, `My ${wordFor(firstQuestion)} is here.`);
    assert.equal(winnerResult.winnerUserId, 101);
    assert.equal(winnerResult.timedOut, false);
    assert.deepEqual(winnerResult.scores, [
      { userId: 101, name: 'Player 101', score: 1 },
      { userId: 102, name: 'Player 102', score: 0 },
    ]);
    assert.equal(otherResult.winnerUserId, 101);

    const [nextFirst, nextSecond] = await nextRound;
    assert.equal(nextFirst.round, 2);
    assert.deepEqual(nextFirst, nextSecond);
    assert.notEqual(nextFirst.wordId, firstQuestion.wordId);

    const seen: Question[] = [firstQuestion, nextFirst];
    let current = nextFirst;
    for (let round = 2; round <= BATTLE_ROUNDS; round++) {
      const reveal = waitForEvent<RoundEnd>(first, 'game:roundEnd');
      const finish = round === BATTLE_ROUNDS
        ? waitForEvent<{ status: string; winnerUserId: number | null; totalRounds: number; scores: Array<{ userId: number; name: string; score: number }> }>(first, 'game:finish')
        : null;
      const next = round < BATTLE_ROUNDS ? waitForEvent<Question>(first, 'game:question') : null;
      await submitAnswer(first, current, wordFor(current));
      const result = await reveal;
      assert.equal(result.round, round);
      assert.equal(result.winnerUserId, 101);

      if (next) {
        current = await next;
        seen.push(current);
        assert.equal(current.round, round + 1);
      } else {
        const finalResult = await finish!;
        assert.equal(finalResult.status, 'completed');
        assert.equal(finalResult.totalRounds, BATTLE_ROUNDS);
        assert.equal(finalResult.winnerUserId, 101);
        assert.equal(finalResult.scores[0].score, BATTLE_ROUNDS);
        assert.equal(finalResult.scores[1].score, 0);
      }
    }

    assert.equal(seen.length, BATTLE_ROUNDS);
    assert.deepEqual(seen.map((question) => question.round), Array.from({ length: BATTLE_ROUNDS }, (_, index) => index + 1));
    for (const question of seen) {
      assert.deepEqual(question.letterHints, expectedHints(wordFor(question)));
      assert.equal(question.letterCount, wordFor(question).length);
    }
    // 70% of the match comes from the easier bands, the rest from B2-C2.
    const easyLevels = ['A1', 'A2', 'B1'];
    assert.equal(seen.filter((question) => easyLevels.includes(question.cefrLevel)).length, Math.round(BATTLE_ROUNDS * 0.7));
    assert.equal(seen.filter((question) => !easyLevels.includes(question.cefrLevel)).length, BATTLE_ROUNDS - Math.round(BATTLE_ROUNDS * 0.7));
    assert.equal(seen.filter((question) => question.imageUrl !== null).length, 1);

    const storedAnswers = repository.answers.filter((entry) => entry.matchId === game.matchId);
    assert.equal(storedAnswers.length, BATTLE_ROUNDS * 2);
    assert.ok(storedAnswers.every((entry) => entry.responseTimeMs >= 0));
    assert.deepEqual(repository.finished.at(-1), { matchId: game.matchId, status: 'completed', winnerUserId: 101 });
  } finally {
    first.disconnect();
    second.disconnect();
  }
});

test('an unanswered round times out, reveals the word and scores nobody', async () => {
  const first = await connectClient(201);
  const second = await connectClient(202);
  try {
    const [, , game, question] = await joinMatch(first, second);
    const timedOut = waitForEvent<RoundEnd>(first, 'game:roundEnd', TEST_ROUND_MS + 1_500);
    const nextRound = waitForEvent<Question>(second, 'game:question', TEST_ROUND_MS + 1_500);
    const result = await timedOut;
    assert.equal(result.round, 1);
    assert.equal(result.winnerUserId, null);
    assert.equal(result.timedOut, true);
    assert.equal(result.answer, wordFor(question));
    assert.deepEqual(result.scores, [
      { userId: 201, name: 'Player 201', score: 0 },
      { userId: 202, name: 'Player 202', score: 0 },
    ]);

    const next = await nextRound;
    assert.equal(next.round, 2);
    const missedAnswer = repository.answers.find(
      (entry) => entry.matchId === game.matchId && entry.userId === 201 && entry.round === 1,
    );
    assert.ok(missedAnswer);
    assert.equal(missedAnswer.answer, '');
    assert.equal(missedAnswer.isCorrect, false);
  } finally {
    first.disconnect();
    second.disconnect();
  }
});

test('match:leave during a round cancels the match and clears the round timer', async () => {
  const first = await connectClient(301);
  const second = await connectClient(302);
  try {
    const [, , game] = await joinMatch(first, second);
    let unexpectedQuestion = false;
    second.on('game:question', () => { unexpectedQuestion = true; });
    const left = waitForEvent<{ status: string; reason?: string; totalRounds: number }>(second, 'game:finish');
    first.emit('match:leave');
    const resultAfterLeave = await left;
    assert.equal(resultAfterLeave.status, 'cancelled');
    assert.equal(resultAfterLeave.reason, 'left');
    assert.equal(resultAfterLeave.totalRounds, BATTLE_ROUNDS);
    assert.deepEqual(repository.finished.at(-1), { matchId: game.matchId, status: 'cancelled', winnerUserId: null });
    await new Promise((resolve) => setTimeout(resolve, TEST_ROUND_MS + 400));
    assert.equal(unexpectedQuestion, false);
  } finally {
    first.disconnect();
    second.disconnect();
  }
});

test('opponent disconnect cancels an active match instead of leaving it stuck', async () => {
  const first = await connectClient(401);
  const second = await connectClient(402);
  try {
    const [, , game] = await joinMatch(first, second);
    const finish = waitForEvent<{ status: string; reason?: string; matchId: number }>(first, 'game:finish');
    second.disconnect();
    const result = await finish;
    assert.equal(result.matchId, game.matchId);
    assert.equal(result.status, 'cancelled');
    assert.equal(result.reason, 'opponent_disconnected');
    assert.deepEqual(repository.finished.at(-1), { matchId: game.matchId, status: 'cancelled', winnerUserId: null });
  } finally {
    first.disconnect();
    second.disconnect();
  }
});
