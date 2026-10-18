import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer, type Server as HttpServer } from 'node:http';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import type { BattleQuestion } from '../src/modules/battle/battle.repository';
import type { BattleRepository } from '../src/modules/battle/battle.socket';

const answerByQuestionId = [
  'cat', 'dog', 'apple', 'book', 'water', 'house', 'school', 'friend', 'happy', 'fast',
  'beautiful', 'eat', 'drink', 'run', 'read', 'write', 'big', 'small', 'cold', 'hot',
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

  async getQuestions(): Promise<BattleQuestion[]> {
    const vocabulary = [
      ['mèo', 'cat'], ['chó', 'dog'], ['táo', 'apple'], ['sách', 'book'], ['nước', 'water'],
      ['nhà', 'house'], ['trường', 'school'], ['bạn', 'friend'], ['vui', 'happy'], ['nhanh', 'fast'],
      ['đẹp', 'beautiful'], ['ăn', 'eat'], ['uống', 'drink'], ['chạy', 'run'], ['đọc', 'read'],
      ['viết', 'write'], ['lớn', 'big'], ['nhỏ', 'small'], ['lạnh', 'cold'], ['nóng', 'hot'],
    ];
    return vocabulary.map(([prompt, answer], index) => ({
      id: index + 1,
      prompt,
      answer,
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
  const firstStart = waitForEvent<{ matchId: number; totalRounds: number }>(first, 'game:start');
  const firstQuestion = waitForEvent<{ round: number; questionId: number; prompt: string }>(first, 'game:question');
  const secondQuestion = waitForEvent<{ round: number; questionId: number; prompt: string }>(second, 'game:question');
  first.emit('match:join');
  second.emit('match:join');
  return Promise.all([firstFound, secondFound, firstStart, firstQuestion, secondQuestion]);
}

async function submitAnswer(socket: ClientSocket, question: { round: number; questionId: number }, answer: string, extras = {}) {
  socket.emit('game:answer', { ...question, answer, ...extras });
}

before(async () => {
  const { attachBattleSocket } = await import('../src/modules/battle/battle.socket.js');
  repository = new MemoryBattleRepository();
  httpServer = createServer();
  const io = attachBattleSocket(httpServer, repository);
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

test('first correct answer advances both players immediately without a clock or opponent response', async () => {
  const first = await connectClient(101);
  const second = await connectClient(102);
  try {
    const [, , game, firstQuestion, secondQuestion] = await joinMatch(first, second);
    assert.equal(game.totalRounds, 20);
    assert.equal(firstQuestion.questionId, secondQuestion.questionId);
    assert.equal(firstQuestion.prompt, secondQuestion.prompt);
    assert.equal(firstQuestion.prompt.trim().split(/\s+/).length, 1);

    let gotUnexpectedAnswerResult = false;
    let gotUnexpectedNextQuestion = false;
    first.on('game:answerResult', () => { gotUnexpectedAnswerResult = true; });
    first.on('game:question', () => { gotUnexpectedNextQuestion = true; });
    second.on('game:question', () => { gotUnexpectedNextQuestion = true; });
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.equal(gotUnexpectedAnswerResult, false);
    assert.equal(gotUnexpectedNextQuestion, false);
    first.off('game:answerResult');
    first.off('game:question');
    second.off('game:question');

    const malformed = waitForEvent<{ code: string }>(first, 'game:error');
    await submitAnswer(first, firstQuestion, '', { correct: true, score: 99_999, winner: 102 });
    assert.equal((await malformed).code, 'INVALID_ANSWER');

    const wrongAttempt = waitForEvent<{ correct: boolean; roundWinnerUserId: number | null }>(first, 'game:answerResult');
    await submitAnswer(first, firstQuestion, 'wrong', { correct: true, score: 99_999, winner: 102 });
    const wrongResult = await wrongAttempt;
    assert.equal(wrongResult.correct, false);
    assert.equal(wrongResult.roundWinnerUserId, null);

    const firstResult = waitForEvent<{ round: number; correct: boolean; roundWinnerUserId: number | null; responseTimeMs: number }>(first, 'game:answerResult');
    const secondResult = waitForEvent<{ round: number; correct: boolean; roundWinnerUserId: number | null }>(second, 'game:answerResult');
    const roundTwo = Promise.all([
      waitForEvent<{ round: number; questionId: number; prompt: string }>(first, 'game:question'),
      waitForEvent<{ round: number; questionId: number; prompt: string }>(second, 'game:question'),
      waitForEvent<{ round: number }>(first, 'game:nextQuestion'),
      waitForEvent<{ round: number }>(second, 'game:nextQuestion'),
    ]);
    await submitAnswer(first, firstQuestion, answerByQuestionId[firstQuestion.questionId - 1], { correct: false, score: 99_999, winner: 102 });
    const [firstRoundResult, secondRoundResult] = await Promise.all([firstResult, secondResult]);
    assert.equal(firstRoundResult.correct, true);
    assert.equal(secondRoundResult.correct, false);
    assert.equal(firstRoundResult.roundWinnerUserId, 101);
    assert.ok(firstRoundResult.responseTimeMs >= 300);
    assert.ok(firstRoundResult.responseTimeMs < 1_000);

    let [currentFirst, currentSecond] = await roundTwo.then((events) => {
      assert.equal(events[0].round, 2);
      assert.deepEqual(events[0], events[1]);
      assert.equal(events[2].round, 2);
      assert.equal(events[3].round, 2);
      return [events[0], events[1]];
    });
    for (let round = 2; round <= 20; round++) {
      const firstRound = waitForEvent<{ round: number; roundWinnerUserId: number | null }>(first, 'game:answerResult');
      const secondRound = waitForEvent<{ round: number }>(second, 'game:answerResult');
      const finishFirst = round === 20
        ? waitForEvent<{ status: string; winnerUserId: number | null; totalRounds: number; scores: Array<{ userId: number; score: number }> }>(first, 'game:finish')
        : null;
      const finishSecond = round === 20
        ? waitForEvent<{ status: string }>(second, 'game:finish')
        : null;
      const nextRoundEvents = round < 20 ? Promise.all([
        waitForEvent<{ round: number; questionId: number; prompt: string }>(first, 'game:question'),
        waitForEvent<{ round: number; questionId: number; prompt: string }>(second, 'game:question'),
        waitForEvent<{ round: number }>(first, 'game:nextQuestion'),
        waitForEvent<{ round: number }>(second, 'game:nextQuestion'),
      ]) : null;
      await submitAnswer(first, currentFirst, answerByQuestionId[currentFirst.questionId - 1]);
      const [winnerResult, otherResult] = await Promise.all([firstRound, secondRound]);
      assert.equal(winnerResult.round, round);
      assert.equal(winnerResult.roundWinnerUserId, 101);
      assert.equal(otherResult.round, round);

      if (round < 20) {
        const nextEvents = await nextRoundEvents!;
        assert.equal(nextEvents[0].round, round + 1);
        assert.equal(nextEvents[0].prompt.trim().split(/\s+/).length, 1);
        assert.deepEqual(nextEvents[0], nextEvents[1]);
        assert.equal(nextEvents[2].round, round + 1);
        assert.equal(nextEvents[3].round, round + 1);
        currentFirst = nextEvents[0];
        currentSecond = nextEvents[1];
      } else {
        const [firstFinish, secondFinish] = await Promise.all([finishFirst!, finishSecond!]);
        assert.equal(firstFinish.status, 'completed');
        assert.equal(firstFinish.totalRounds, 20);
        assert.equal(firstFinish.winnerUserId, 101);
        assert.deepEqual(firstFinish.scores, [
          { userId: 101, name: 'Player 101', score: 20 },
          { userId: 102, name: 'Player 102', score: 0 },
        ]);
        assert.equal(secondFinish.status, 'completed');
      }
    }

    const storedAnswers = repository.answers.filter((entry) => entry.matchId === game.matchId);
    assert.equal(storedAnswers.length, 40);
    assert.ok(storedAnswers.filter((entry) => entry.userId === 101).every((entry) => entry.isCorrect));
    assert.ok(storedAnswers.every((entry) => entry.responseTimeMs >= 0));
    assert.deepEqual(repository.finished.at(-1), { matchId: game.matchId, status: 'completed', winnerUserId: 101 });
  } finally {
    first.disconnect();
    second.disconnect();
  }
});

test('a correct answer advances the unanswered opponent and match:leave releases both', async () => {
  const first = await connectClient(201);
  const second = await connectClient(202);
  try {
    const [, , game, firstQuestion, secondQuestion] = await joinMatch(first, second);
    const firstResult = waitForEvent<{ correct: boolean; roundWinnerUserId: number | null }>(first, 'game:answerResult');
    const secondResult = waitForEvent<{ correct: boolean }>(second, 'game:answerResult');
    const nextFirst = waitForEvent<{ round: number }>(first, 'game:nextQuestion');
    const nextSecond = waitForEvent<{ round: number }>(second, 'game:nextQuestion');
    const opponentNextQuestion = waitForEvent<{ round: number; prompt: string }>(second, 'game:question');
    await submitAnswer(first, firstQuestion, answerByQuestionId[firstQuestion.questionId - 1]);
    const [result, missed] = await Promise.all([firstResult, secondResult]);
    const [firstNext, secondNext] = await Promise.all([nextFirst, nextSecond]);
    const nextQuestion = await opponentNextQuestion;
    assert.equal(result.correct, true);
    assert.equal(result.roundWinnerUserId, 201);
    assert.equal(missed.correct, false);
    assert.deepEqual(firstNext, { round: 2 });
    assert.deepEqual(secondNext, { round: 2 });
    assert.equal(nextQuestion.round, 2);
    assert.notEqual(nextQuestion.prompt, firstQuestion.prompt);
    const missedAnswer = repository.answers.find((entry) => entry.matchId === game.matchId && entry.userId === 202 && entry.round === 1);
    assert.ok(missedAnswer);
    assert.equal(missedAnswer.answer, '');

    const left = waitForEvent<{ status: string; reason?: string }>(second, 'game:finish');
    first.emit('match:leave');
    const resultAfterLeave = await left;
    assert.equal(resultAfterLeave.status, 'cancelled');
    assert.equal(resultAfterLeave.reason, 'left');
    assert.deepEqual(repository.finished.at(-1), { matchId: game.matchId, status: 'cancelled', winnerUserId: null });
  } finally {
    first.disconnect();
    second.disconnect();
  }
});

test('opponent disconnect cancels an active match instead of leaving it stuck', async () => {
  const first = await connectClient(301);
  const second = await connectClient(302);
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
