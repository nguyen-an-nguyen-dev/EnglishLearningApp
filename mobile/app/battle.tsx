import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { BattleResultScreen } from '@/components/battle/BattleResultScreen';
import { FindOpponentScreen } from '@/components/battle/FindOpponentScreen';
import { WaitingScreen } from '@/components/battle/WaitingScreen';
import { WordBattleScreen } from '@/components/battle/WordBattleScreen';
import { useAuth } from '@/contexts/auth-context';
import {
  createBattleSocket,
  type BattleAnswerResult,
  type BattleFinish,
  type BattleOpponent,
  type BattleQuestion,
  type BattleScore,
  type BattleStart,
} from '@/services/battle';

type Screen = 'find' | 'waiting' | 'game' | 'result';

export default function BattleRoute() {
  const router = useRouter();
  const { token, user } = useAuth();
  const socketRef = useRef<ReturnType<typeof createBattleSocket> | null>(null);
  const screenRef = useRef<Screen>('find');
  const gameRef = useRef<BattleStart | null>(null);
  const scoresRef = useRef<BattleScore[]>([]);
  const [screen, setScreen] = useState<Screen>('find');
  const [opponent, setOpponent] = useState<BattleOpponent | null>(null);
  const [game, setGame] = useState<BattleStart | null>(null);
  const [question, setQuestion] = useState<BattleQuestion | null>(null);
  const [answerResult, setAnswerResult] = useState<BattleAnswerResult | null>(null);
  const [scores, setScores] = useState<BattleScore[]>([]);
  const [finish, setFinish] = useState<BattleFinish | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  screenRef.current = screen;
  gameRef.current = game;
  scoresRef.current = scores;

  useEffect(() => () => {
    socketRef.current?.emit('match:leave');
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

  const reset = () => {
    socketRef.current?.emit('match:leave');
    socketRef.current?.disconnect();
    socketRef.current = null;
    setScreen('find');
    setOpponent(null);
    setGame(null);
    gameRef.current = null;
    setQuestion(null);
    setAnswerResult(null);
    setScores([]);
    scoresRef.current = [];
    setFinish(null);
    setSubmitted(false);
    setError(null);
  };

  const findOpponent = () => {
    if (!token) {
      setError('Vui lòng đăng nhập để tìm đối thủ.');
      return;
    }
    setError(null);
    setScreen('waiting');
    const socket = createBattleSocket(token);
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('match:join'));
    socket.on('connect_error', (connectError) => {
      setError(connectError.message || 'Không thể kết nối tới máy chủ trò chơi.');
      setScreen('find');
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    });
    socket.on('match:found', ({ opponent: foundOpponent }) => setOpponent(foundOpponent));
    socket.on('game:start', (startedGame) => {
      gameRef.current = startedGame;
      setGame(startedGame);
      const initialScores = startedGame.players.map((player) => ({ ...player, score: 0 }));
      scoresRef.current = initialScores;
      setScores(initialScores);
      setError(null);
      setScreen('game');
    });
    socket.on('game:question', (nextQuestion) => {
      setQuestion(nextQuestion);
      setAnswerResult(null);
      setSubmitted(false);
      setError(null);
    });
    socket.on('game:nextQuestion', () => {
      setQuestion(null);
      setAnswerResult(null);
      setSubmitted(false);
    });
    socket.on('game:answerResult', (result) => {
      setAnswerResult(result);
      if (!result.correct) setSubmitted(false);
      scoresRef.current = result.scores;
      setScores(result.scores);
    });
    socket.on('game:finish', (result) => {
      setFinish(result);
      scoresRef.current = result.scores;
      setScores(result.scores);
      setQuestion(null);
      setScreen('result');
    });
    socket.on('game:error', (gameError) => {
      setError(gameError.message);
      if (gameError.code === 'INVALID_ANSWER') setSubmitted(false);
      if (gameError.code === 'MATCH_CREATION_FAILED' || gameError.code === 'USER_NOT_FOUND') {
        setScreen('find');
        socket.disconnect();
        if (socketRef.current === socket) socketRef.current = null;
      }
    });
    socket.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect' && screenRef.current !== 'result') {
        const currentGame = gameRef.current;
        const currentScores = scoresRef.current;
        setFinish((current) => current ?? {
          matchId: currentGame?.matchId ?? 0,
          status: 'cancelled',
          winnerUserId: null,
          scores: currentScores,
          totalRounds: currentGame?.totalRounds ?? 0,
          reason: 'opponent_disconnected',
        });
        setScreen((current) => current === 'find' || current === 'waiting' ? 'find' : 'result');
        setError('Kết nối tới trận đấu đã bị gián đoạn.');
      }
    });
    socket.connect();
  };

  const submitAnswer = (answer: string) => {
    if (!question || !socketRef.current?.connected || submitted) return;
    setSubmitted(true);
    socketRef.current.emit('game:answer', {
      round: question.round,
      questionId: question.questionId,
      answer,
    });
  };

  if (screen === 'waiting') {
    return (
      <WaitingScreen
        error={error}
        onBack={() => router.back()}
        onCancel={reset}
        opponentName={opponent?.name}
      />
    );
  }
  if (screen === 'game' && game) {
    return (
      <WordBattleScreen
        answerResult={answerResult}
        currentUserId={user?.id ?? 0}
        error={error}
        game={game}
        onBack={reset}
        onSubmit={submitAnswer}
        question={question}
        scores={scores}
        submitted={submitted}
      />
    );
  }
  if (screen === 'result' && finish) {
    return (
      <BattleResultScreen
        currentUserId={user?.id ?? 0}
        error={error}
        onBack={reset}
        result={finish}
      />
    );
  }
  return (
    <FindOpponentScreen
      error={error}
      onBack={() => router.back()}
      onFind={findOpponent}
    />
  );
}
