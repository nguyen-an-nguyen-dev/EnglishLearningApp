import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowClockwise,
  ArrowRight,
  CheckCircle,
  Clock,
  Fire,
  Flag,
  ImageSquare,
  Lightning,
  Play,
  Sword,
  Timer,
  Trophy,
  UsersThree,
  X,
} from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useI18n } from '../../i18n'
import {
  createBattleSocket,
  getArenaSummaryApi,
  getPracticeQuestionsApi,
} from '../../services/battleService'
import type { BattleSocket } from '../../services/battleService'
import type {
  ArenaSummary,
  BattleFinish,
  BattleOpponent,
  BattleQuestion,
  BattleRoundEnd,
  BattleScore,
  BattleStart,
  PracticeQuestion,
} from '../../types/video'
import { matchOutcome } from '../../utils/arena'
import { setArenaLeaveGuard } from '../../utils/arenaGuard'
import { initialOf } from '../../utils/avatar'
import {
  clearBattleSession,
  readBattleSession,
  saveBattleSession,
  type BattleSessionSnapshot,
} from '../../utils/battleSession'

type ArenaMode = 'duel' | 'practice'
type DuelScreen = 'lobby' | 'queue' | 'match' | 'result'
type PracticeScreen = 'idle' | 'loading' | 'playing' | 'done'
type PracticeFeedback = { picked: string | null; correct: boolean } | null
type DuelConnection = { mode: 'queue' | 'resume'; matchId?: number; nonce: number }

const PRACTICE_SECONDS = 15
const DUEL_ROUNDS = 8
const DUEL_SECONDS = 25
const PRACTICE_COUNT = 12

/** Three colour bands so the prompt card reads as A / B / C at a glance. */
function levelBandOf(level: string): 'a' | 'b' | 'c' {
  const initial = level.trim().charAt(0).toUpperCase()
  if (initial === 'A') return 'a'
  if (initial === 'C') return 'c'
  return 'b'
}

/**
 * The prompt card always reserves a 16:9 media slot: a photo when the word has
 * one, an empty frame otherwise. Keeping the frame in place means the card does
 * not jump once images land in `battle_words.image_url`.
 */
function PromptFrame({ src, label }: { src: string | null; label: string }) {
  if (src) {
    return (
      <div className="arena-frame has-photo">
        <img src={src} alt="" loading="lazy" />
      </div>
    )
  }
  return (
    <div className="arena-frame" aria-hidden="true">
      <ImageSquare size={22} weight="regular" />
      <span>{label}</span>
    </div>
  )
}

function ArenaRecord({ summary, loading }: { summary: ArenaSummary | null; loading: boolean }) {
  const { t } = useI18n()
  const stats = [
    { label: t.arenaPlayed, value: summary?.played ?? 0 },
    { label: t.arenaWins, value: summary?.wins ?? 0 },
    { label: t.arenaWinRate, value: `${summary?.win_rate ?? 0}%` },
    { label: t.arenaWinStreak, value: summary?.win_streak ?? 0 },
  ]
  return (
    <dl className="arena-record">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dd>{loading ? '…' : stat.value}</dd>
          <dt>{stat.label}</dt>
        </div>
      ))}
    </dl>
  )
}

interface DuelPanelProps {
  currentUserId: number
  onSummaryRefresh: () => void
}

function DuelPanel({ currentUserId, onSummaryRefresh }: DuelPanelProps) {
  const { t } = useI18n()
  const { token } = useAuth()
  const [savedSession] = useState<BattleSessionSnapshot | null>(() => readBattleSession())
  const [screen, setScreen] = useState<DuelScreen>(savedSession ? 'match' : 'lobby')
  const [connection, setConnection] = useState<DuelConnection | null>(
    savedSession ? { mode: 'resume', matchId: savedSession.matchId, nonce: 0 } : null,
  )
  const [resuming, setResuming] = useState(Boolean(savedSession))
  const [opponent, setOpponent] = useState<BattleOpponent | null>(savedSession?.opponent ?? null)
  const [game, setGame] = useState<BattleStart | null>(savedSession?.game ?? null)
  const [question, setQuestion] = useState<BattleQuestion | null>(savedSession?.question ?? null)
  const [roundEnd, setRoundEnd] = useState<BattleRoundEnd | null>(savedSession?.roundEnd ?? null)
  const [wrongAnswer, setWrongAnswer] = useState(false)
  const [scores, setScores] = useState<BattleScore[]>(savedSession?.scores ?? [])
  const [finish, setFinish] = useState<BattleFinish | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [opponentAttempt, setOpponentAttempt] = useState('')
  const [opponentAway, setOpponentAway] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(DUEL_SECONDS)
  const [elapsedMs, setElapsedMs] = useState(0)
  const socketRef = useRef<BattleSocket | null>(null)
  const screenRef = useRef<DuelScreen>(screen)
  const gameRef = useRef<BattleStart | null>(game)
  const questionStartedRef = useRef(0)
  const wrongTimerRef = useRef<number | null>(null)
  const attemptClearRef = useRef<number | null>(null)

  const clearWrongFlash = useCallback(() => {
    if (wrongTimerRef.current !== null) {
      window.clearTimeout(wrongTimerRef.current)
      wrongTimerRef.current = null
    }
    setWrongAnswer(false)
  }, [])

  // The opponent's attempt fades out on its own if the round keeps going.
  const clearOpponentAttempt = useCallback(() => {
    if (attemptClearRef.current !== null) {
      window.clearTimeout(attemptClearRef.current)
      attemptClearRef.current = null
    }
    setOpponentAttempt('')
  }, [])

  useEffect(() => () => {
    if (wrongTimerRef.current !== null) window.clearTimeout(wrongTimerRef.current)
    if (attemptClearRef.current !== null) window.clearTimeout(attemptClearRef.current)
  }, [])

  useEffect(() => {
    screenRef.current = screen
  }, [screen])

  useEffect(() => {
    gameRef.current = game
  }, [game])

  const disconnectSocket = useCallback((emitLeave: boolean) => {
    const socket = socketRef.current
    if (!socket) return
    socketRef.current = null
    socket.removeAllListeners()
    if (!emitLeave || !socket.connected) {
      socket.disconnect()
      return
    }
    // Send the leave first and close a beat later: disconnecting in the same
    // tick can drop the packet, which strands the opponent in the match.
    socket.emit('match:leave')
    window.setTimeout(() => socket.disconnect(), 150)
  }, [])

  const resetDuel = useCallback(() => {
    disconnectSocket(true)
    clearBattleSession()
    setConnection(null)
    setResuming(false)
    setScreen('lobby')
    setOpponent(null)
    setGame(null)
    setQuestion(null)
    setRoundEnd(null)
    clearWrongFlash()
    setScores([])
    setFinish(null)
    setError(null)
    setAnswer('')
    setElapsedMs(0)
    clearOpponentAttempt()
  }, [clearOpponentAttempt, clearWrongFlash, disconnectSocket])

  const findOpponent = useCallback(() => {
    if (!token) {
      setError(t.arenaLoginRequired)
      return
    }
    disconnectSocket(true)
    clearBattleSession()
    setError(null)
    setResuming(false)
    setScreen('queue')
    setConnection({ mode: 'queue', nonce: Date.now() })
  }, [disconnectSocket, t.arenaLoginRequired, token])

  useEffect(() => {
    if (!connection || !token) return
    const socket = createBattleSocket(token)
    socketRef.current = socket

    socket.on('connect', () => {
      if (connection.mode === 'queue') socket.emit('match:join')
      else if (connection.matchId) socket.emit('game:resume', { matchId: connection.matchId })
    })
    socket.on('connect_error', (connectError) => {
      setError(connectError.message || t.arenaConnectError)
      setResuming(false)
      setScreen('lobby')
      setConnection(null)
      clearBattleSession()
    })
    socket.on('match:found', ({ opponent: foundOpponent }) => setOpponent(foundOpponent))
    socket.on('game:start', (startedGame) => {
      const initialScores = startedGame.players.map((player) => ({ ...player, score: 0 }))
      setGame(startedGame)
      setScores(initialScores)
      setScreen('match')
      setResuming(false)
      setError(null)
    })
    socket.on('game:question', (nextQuestion) => {
      setQuestion(nextQuestion)
      questionStartedRef.current = Date.now()
      setSecondsLeft(Math.ceil(nextQuestion.durationMs / 1000))
      setElapsedMs(0)
      setRoundEnd(null)
      setWrongAnswer(false)
      setAnswer('')
      setResuming(false)
      setScreen('match')
      clearOpponentAttempt()
      setOpponentAway(false)
    })
    socket.on('game:answerResult', () => {
      setWrongAnswer(true)
      if (wrongTimerRef.current !== null) window.clearTimeout(wrongTimerRef.current)
      wrongTimerRef.current = window.setTimeout(() => {
        wrongTimerRef.current = null
        setWrongAnswer(false)
      }, 2_000)
    })
    socket.on('game:opponentAttempt', ({ text }) => {
      setOpponentAttempt(text)
      if (attemptClearRef.current !== null) window.clearTimeout(attemptClearRef.current)
      attemptClearRef.current = window.setTimeout(() => {
        attemptClearRef.current = null
        setOpponentAttempt('')
      }, 3_200)
    })
    socket.on('game:opponentAway', ({ away }) => setOpponentAway(away))
    socket.on('game:roundEnd', (result) => {
      setRoundEnd(result)
      clearWrongFlash()
      clearOpponentAttempt()
      setOpponentAway(false)
      setScores(result.scores)
    })
    socket.on('game:resume', (resumed) => {
      setOpponent(resumed.opponent)
      setGame(resumed.game)
      setScores(resumed.scores)
      setRoundEnd(resumed.roundEnd)
      setWrongAnswer(false)
      setAnswer('')
      setError(null)
      setResuming(false)
      setScreen('match')
      if (resumed.question) {
        const elapsed = Math.max(0, resumed.question.durationMs - resumed.remainingMs)
        questionStartedRef.current = Date.now() - elapsed
        setQuestion(resumed.question)
        setElapsedMs(elapsed)
        setSecondsLeft(Math.max(0, Math.ceil(resumed.remainingMs / 1000)))
      } else {
        setQuestion(null)
        setElapsedMs(0)
        setSecondsLeft(0)
      }
    })
    socket.on('game:resumeFailed', (failed) => {
      clearBattleSession()
      setResuming(false)
      setConnection(null)
      setScreen('lobby')
      setQuestion(null)
      setRoundEnd(null)
      setFinish(null)
      setError(failed.message || t.arenaResumeFailed)
    })
    socket.on('game:finish', (result) => {
      clearBattleSession()
      setFinish(result)
      setScores(result.scores)
      setQuestion(null)
      setRoundEnd(null)
      setScreen('result')
      setResuming(false)
      onSummaryRefresh()
    })
    socket.on('game:error', (gameError) => {
      setError(gameError.message)
      if (gameError.code === 'MATCH_CREATION_FAILED' || gameError.code === 'USER_NOT_FOUND') {
        setScreen('lobby')
        setConnection(null)
        setResuming(false)
        clearBattleSession()
      }
    })
    socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect' || screenRef.current === 'result') return
      const currentGame = gameRef.current
      if (screenRef.current === 'match' && currentGame) {
        setError(t.arenaReconnecting)
        window.setTimeout(() => {
          if (screenRef.current !== 'match') return
          setConnection({ mode: 'resume', matchId: currentGame.matchId, nonce: Date.now() })
        }, 800)
        return
      }
      setFinish({
        matchId: currentGame?.matchId ?? 0,
        status: 'cancelled',
        winnerUserId: null,
        scores: [],
        totalRounds: currentGame?.totalRounds ?? 0,
        reason: 'opponent_disconnected',
      })
      setScreen(screenRef.current === 'lobby' || screenRef.current === 'queue' ? 'lobby' : 'result')
      setError(t.arenaConnectionLost)
    })
    socket.connect()

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [clearOpponentAttempt, clearWrongFlash, connection, onSummaryRefresh, t, token])

  useEffect(() => {
    if (screen !== 'match') return
    setArenaLeaveGuard(() => {
      const leave = window.confirm(t.arenaLeaveConfirm)
      if (leave) {
        clearBattleSession()
        disconnectSocket(true)
        setConnection(null)
        setResuming(false)
      }
      return leave
    })
    return () => setArenaLeaveGuard(null)
  }, [disconnectSocket, screen, t.arenaLeaveConfirm])

  useEffect(() => {
    if (screen !== 'match' || resuming || !game) return
    saveBattleSession({
      matchId: game.matchId,
      game,
      opponent,
      question,
      roundEnd,
      scores,
      savedAt: Date.now(),
    })
  }, [game, opponent, question, resuming, roundEnd, screen, scores])

  useEffect(() => {
    if (screen !== 'match' || !question || roundEnd || resuming) return
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - questionStartedRef.current
      setElapsedMs(Math.min(question.durationMs, Math.max(0, elapsed)))
      setSecondsLeft(Math.max(0, Math.ceil((question.durationMs - elapsed) / 1000)))
    }, 250)
    return () => window.clearInterval(interval)
  }, [resuming, roundEnd, screen, question])

  function submitAnswer() {
    const trimmed = answer.trim()
    const socket = socketRef.current
    if (!trimmed || !socket?.connected || !question || roundEnd) return
    // Only the submitted answer is shared, so the opponent sees what was tried
    // without watching every keystroke.
    socket.emit('game:attempt', { text: trimmed.slice(0, 48) })
    socket.emit('game:answer', {
      round: question.round,
      wordId: question.wordId,
      answer: trimmed,
    })
    setAnswer('')
  }

  const scoreFor = (userId: number) => scores.find((entry) => entry.userId === userId)?.score ?? 0
  const opponentId = opponent?.userId ?? game?.players.find((player) => player.userId !== currentUserId)?.userId ?? 0
  const outcome = finish ? matchOutcome(finish.winnerUserId, currentUserId) : null

  if (screen === 'queue') {
    return (
      <section className="arena-queue">
        <div className="arena-queue-rings" aria-hidden="true">
          <span /><span /><span />
        </div>
        <h2>{t.arenaQueueTitle}</h2>
        <p>{opponent ? t.arenaQueueOpponent(opponent.name) : t.arenaQueueDesc}</p>
        {error && <p className="arena-error">{error}</p>}
        <button type="button" className="arena-link" onClick={resetDuel}>
          <X size={15} /> {t.arenaCancel}
        </button>
      </section>
    )
  }

  if (screen === 'match' && resuming) {
    return (
      <section className="arena-queue">
        <span className="video-spinner" aria-hidden="true" />
        <h2>{t.arenaResuming}</h2>
        {error && <p className="arena-error">{error}</p>}
      </section>
    )
  }

  if (screen === 'match' && game) {
    const player = game.players.find((entry) => entry.userId === currentUserId)
    const opponentPlayer = game.players.find((entry) => entry.userId !== currentUserId)
    const revealedLetters = new Map<number, string>()
    if (question) {
      if (roundEnd) {
        for (let position = 0; position < roundEnd.answer.length; position += 1) {
          revealedLetters.set(position, roundEnd.answer[position])
        }
      } else {
        for (const step of question.hintSchedule ?? []) {
          if (step.atMs > elapsedMs) break
          for (const hint of step.letters) revealedLetters.set(hint.position, hint.letter)
        }
      }
    }
    const urgent = secondsLeft <= 5
    return (
      <section className="arena-match">
        <header className="arena-match-bar">
          <span className="arena-kicker">{t.arenaDuelTab}</span>
          <button
            type="button"
            className="arena-link"
            onClick={() => {
              if (window.confirm(t.arenaLeaveConfirm)) resetDuel()
            }}
          >
            <X size={13} /> {t.arenaLeaveMatch}
          </button>
        </header>

        <div className="arena-scoreboard">
          <div className="arena-side">
            <span className="arena-avatar" aria-hidden="true">{initialOf(player?.name ?? t.arenaYou)}</span>
            <div className="arena-side-copy">
              <span className="arena-side-name">{player?.name ?? t.arenaYou}</span>
              <strong className="arena-side-score">{scoreFor(currentUserId)}</strong>
              <small>{t.arenaRoundWins}</small>
            </div>
          </div>

          <div className="arena-score-mid">
            <span>{t.arenaRoundOf(question?.round ?? 1, game.totalRounds)}</span>
            <strong className={urgent ? 'is-urgent' : ''}>
              {String(secondsLeft).padStart(2, '0')}<i>s</i>
            </strong>
          </div>

          <div className="arena-side is-opponent">
            <div className="arena-side-copy">
              <span className="arena-side-name">{opponentPlayer?.name ?? t.arenaOpponent}</span>
              <strong className="arena-side-score">{scoreFor(opponentPlayer?.userId ?? opponentId)}</strong>
              <small>{t.arenaRoundWins}</small>
            </div>
            <span className="arena-avatar" aria-hidden="true">
              {initialOf(opponentPlayer?.name ?? t.arenaOpponent)}
            </span>
          </div>
        </div>

        <div className="arena-feed" aria-live="polite">
          {opponentAway && (
            <p className="arena-away">
              <span className="arena-away-dot" aria-hidden="true" />
              {t.arenaOpponentAway(opponentPlayer?.name ?? t.arenaOpponent)}
            </p>
          )}
          {opponentAttempt && (
            <div className="arena-attempt">
              <span className="arena-attempt-label">
                {t.arenaAttempted} · {opponentPlayer?.name ?? t.arenaOpponent}
              </span>
              <span className="arena-attempt-bubble">{opponentAttempt}</span>
            </div>
          )}
        </div>

        {question ? (
          <div className="arena-question">
            <div className={`arena-prompt is-${levelBandOf(question.cefrLevel)}`}>
              <PromptFrame src={question.imageUrl} label={t.arenaImageSlot} />
              <p className="arena-tags">
                {question.cefrLevel}<i>·</i>{question.partOfSpeech}
              </p>
              <p className="arena-label">{t.arenaTranslation}</p>
              <h2>{question.translation}</h2>
              <p className="arena-clue">{question.example}</p>
              {question.exampleVi && <p className="arena-clue-vi">{question.exampleVi}</p>}
            </div>

            <div className="arena-reply">
              <p className="arena-label">{t.arenaAnswerLabel}</p>
              <div className="arena-slots" aria-hidden="true">
                {Array.from({ length: question.letterCount }, (_, position) => {
                  const letter = revealedLetters.get(position)
                  return (
                    <span className={letter ? 'is-on' : ''} key={position}>
                      {letter ?? ''}
                    </span>
                  )
                })}
              </div>

              <div className="arena-answer">
                <input
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      submitAnswer()
                    }
                  }}
                  placeholder={t.arenaTypeAnswer}
                  aria-label={t.arenaTypeAnswer}
                  disabled={Boolean(roundEnd)}
                  autoFocus
                />
                <button
                  type="button"
                  className={`arena-cta is-compact${wrongAnswer ? ' is-wrong' : ''}`}
                  onClick={submitAnswer}
                  disabled={Boolean(roundEnd) || wrongAnswer || answer.trim().length === 0}
                >
                  {wrongAnswer ? t.arenaWrongShort : t.arenaSubmit}
                </button>
              </div>

              {error && <p className="arena-error">{error}</p>}

              {roundEnd && (
                <div className="arena-reveal">
                  <span className="arena-label">
                    {roundEnd.timedOut
                      ? t.arenaRoundTimeout
                      : roundEnd.winnerUserId === currentUserId
                        ? t.arenaRoundWinnerYou
                        : t.arenaRoundWinnerOpponent}
                  </span>
                  <h3>{roundEnd.answer}</h3>
                  <p>{roundEnd.example}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="arena-loading">
            <span className="video-spinner" aria-hidden="true" />
            <p>{t.arenaLoadingRound}</p>
          </div>
        )}
      </section>
    )
  }

  if (screen === 'result' && finish) {
    const isCancelled = finish.status === 'cancelled'
    const isForfeit = !isCancelled
      && (finish.reason === 'left' || finish.reason === 'opponent_disconnected')
    return (
      <section className={`arena-verdict is-${outcome ?? 'draw'}${isCancelled ? ' is-cancelled' : ''}`}>
        <span className="arena-verdict-icon" aria-hidden="true">
          {isCancelled
            ? <Flag size={40} weight="regular" />
            : outcome === 'win' ? <Trophy size={40} weight="regular" /> : <Sword size={40} weight="regular" />}
        </span>
        <span className="arena-kicker">{t.arenaResultKicker}</span>
        <h2>
          {isCancelled
            ? t.arenaMatchCancelled
            : outcome === 'win'
              ? t.arenaMatchWin
              : outcome === 'lose'
                ? t.arenaMatchLose
                : t.arenaMatchDraw}
        </h2>
        <p>
          {isCancelled
            ? t.arenaMatchCancelledDesc
            : isForfeit
              ? outcome === 'win' ? t.arenaForfeitWin : t.arenaForfeitLoss
              : t.arenaMatchScore(finish.scores, currentUserId)}
        </p>

        <div className="arena-verdict-scores">
          {finish.scores.map((entry) => (
            <div className={entry.userId === currentUserId ? 'is-you' : ''} key={entry.userId}>
              <span>{entry.name}</span>
              <strong>{entry.score}</strong>
            </div>
          ))}
        </div>

        {error && <p className="arena-error">{error}</p>}
        <div className="arena-verdict-actions">
          <button type="button" className="arena-cta is-compact" onClick={findOpponent}>
            <Lightning size={16} weight="fill" /> {t.arenaPlayAgain}
          </button>
          <button type="button" className="arena-link" onClick={resetDuel}>
            {t.arenaBackToLobby}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="arena-lobby">
      <div className="arena-lobby-copy">
        <span className="arena-kicker">01 · {t.arenaDuelTab}</span>
        <h2>{t.arenaDuelTitle}</h2>
        <p>{t.arenaDuelDesc}</p>
        <ul className="arena-facts">
          <li><UsersThree size={16} /><span>{t.arenaLiveQueue}</span></li>
          <li><Clock size={16} /><span>{t.arenaSecondsEach(DUEL_SECONDS)}</span></li>
          <li><Trophy size={16} /><span>{t.arenaRounds(DUEL_ROUNDS)}</span></li>
        </ul>
        {error && <p className="arena-error">{error}</p>}
        <button type="button" className="arena-cta" onClick={findOpponent}>
          <span>{t.arenaFindOpponent}</span>
          <ArrowRight size={18} weight="bold" />
        </button>
      </div>

      <aside className="arena-rules">
        <span className="arena-rules-label">{t.arenaRulesTitle}</span>
        <ol>
          <li><span>01</span><p>{t.arenaRuleOne}</p></li>
          <li><span>02</span><p>{t.arenaRuleTwo}</p></li>
          <li><span>03</span><p>{t.arenaRuleThree}</p></li>
        </ol>
      </aside>
    </section>
  )
}

function PracticePanel() {
  const { t } = useI18n()
  const [screen, setScreen] = useState<PracticeScreen>('idle')
  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<PracticeFeedback>(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(PRACTICE_SECONDS)
  const [error, setError] = useState<string | null>(null)
  const advanceTimer = useRef<number | null>(null)
  const answeredRef = useRef(false)

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
  }, [])

  useEffect(() => () => clearAdvanceTimer(), [clearAdvanceTimer])

  const advance = useCallback(() => {
    setFeedback(null)
    answeredRef.current = false
    setSecondsLeft(PRACTICE_SECONDS)
    setIndex((current) => {
      if (current >= questions.length - 1) {
        setScreen('done')
        return current
      }
      return current + 1
    })
  }, [questions.length])

  const settleAnswer = useCallback((picked: string | null) => {
    if (answeredRef.current) return
    answeredRef.current = true
    const question = questions[index]
    if (!question) return
    const correct = picked === question.answer
    setFeedback({ picked, correct })
    if (correct) {
      setScore((current) => current + 1)
      const nextStreak = streak + 1
      setStreak(nextStreak)
      setBestStreak((best) => Math.max(best, nextStreak))
    } else {
      setStreak(0)
    }
    clearAdvanceTimer()
    advanceTimer.current = window.setTimeout(advance, 1_500)
  }, [advance, clearAdvanceTimer, index, questions, streak])

  useEffect(() => {
    if (screen !== 'playing' || feedback) return
    answeredRef.current = false
    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((PRACTICE_SECONDS * 1000 - (Date.now() - startedAt)) / 1000))
      setSecondsLeft(left)
      if (left <= 0) {
        window.clearInterval(interval)
        settleAnswer(null)
      }
    }, 500)
    return () => window.clearInterval(interval)
  }, [screen, index, feedback, settleAnswer])

  async function startPractice() {
    setScreen('loading')
    setError(null)
    try {
      const loaded = await getPracticeQuestionsApi(PRACTICE_COUNT)
      setQuestions(loaded)
      setIndex(0)
      setScore(0)
      setStreak(0)
      setBestStreak(0)
      setFeedback(null)
      answeredRef.current = false
      setSecondsLeft(PRACTICE_SECONDS)
      setScreen('playing')
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : t.arenaPracticeError)
      setScreen('idle')
    }
  }

  if (screen === 'idle' || screen === 'loading') {
    return (
      <section className="arena-lobby">
        <div className="arena-lobby-copy">
          <span className="arena-kicker">02 · {t.arenaPracticeTab}</span>
          <h2>{t.arenaPracticeTitle}</h2>
          <p>{t.arenaPracticeDesc}</p>
          <ul className="arena-facts">
            <li><Lightning size={16} /><span>{t.arenaPracticeCount(PRACTICE_COUNT)}</span></li>
            <li><Timer size={16} /><span>{t.arenaPracticeSeconds(PRACTICE_SECONDS)}</span></li>
            <li><Trophy size={16} /><span>{t.arenaPracticeLevel}</span></li>
          </ul>
          {error && <p className="arena-error">{error}</p>}
          <button
            type="button"
            className="arena-cta"
            onClick={() => void startPractice()}
            disabled={screen === 'loading'}
          >
            {screen === 'loading'
              ? <span className="video-spinner is-small" aria-hidden="true" />
              : <Play size={16} weight="fill" />}
            <span>{screen === 'loading' ? t.arenaPracticeLoading : t.arenaPracticeStart}</span>
          </button>
        </div>

        <aside className="arena-rules">
          <span className="arena-rules-label">{t.arenaPracticeRulesTitle}</span>
          <ol>
            <li><span>01</span><p>{t.arenaPracticeRuleOne}</p></li>
            <li><span>02</span><p>{t.arenaPracticeRuleTwo}</p></li>
            <li><span>03</span><p>{t.arenaPracticeRuleThree}</p></li>
          </ol>
        </aside>
      </section>
    )
  }

  if (screen === 'done') {
    return (
      <section className="arena-verdict is-draw">
        <span className="arena-verdict-icon" aria-hidden="true"><Trophy size={40} weight="regular" /></span>
        <span className="arena-kicker">{t.arenaPracticeTab}</span>
        <h2>{t.arenaPracticeDoneTitle}</h2>
        <p>{t.arenaPracticeDoneDesc(score, questions.length)}</p>
        <div className="arena-verdict-scores">
          <div className="is-you"><span>{t.arenaCorrect}</span><strong>{score}</strong></div>
          <div><span>{t.arenaBestStreak}</span><strong>{bestStreak}</strong></div>
        </div>
        <div className="arena-verdict-actions">
          <button type="button" className="arena-cta is-compact" onClick={() => void startPractice()}>
            <ArrowClockwise size={16} /> {t.arenaRestart}
          </button>
        </div>
      </section>
    )
  }

  const question = questions[index]
  if (!question) {
    return (
      <section className="arena-verdict">
        <p>{t.arenaPracticeError}</p>
        <button type="button" className="arena-cta is-compact" onClick={() => void startPractice()}>
          {t.retry}
        </button>
      </section>
    )
  }

  return (
    <section className="arena-practice">
      <header className="arena-practice-head">
        <div>
          <span className="arena-kicker">{t.arenaPracticeTab}</span>
          <h2>{t.arenaPracticeQuestion(index + 1, questions.length)}</h2>
        </div>
        <div className="arena-run">
          <span><Fire size={15} weight="fill" /> {streak}</span>
          <span className={secondsLeft <= 5 ? 'is-urgent' : ''}>
            <Timer size={15} weight="fill" /> {secondsLeft}s
          </span>
          <span><Trophy size={15} weight="fill" /> {score}</span>
        </div>
      </header>

      <div className="arena-question">
        <div className={`arena-prompt is-${levelBandOf(question.cefr_level)}`}>
          <PromptFrame src={question.image_url} label={t.arenaImageSlot} />
          <p className="arena-tags">
            {question.cefr_level}<i>·</i>{question.part_of_speech}
          </p>
          <p className="arena-label">{t.arenaChooseTranslation}</p>
          <h2>{question.translation}</h2>
          <p className="arena-clue">{question.example}</p>
          {question.example_vi && <p className="arena-clue-vi">{question.example_vi}</p>}
        </div>

        <div className="arena-reply">
          <ol className="arena-options">
            {question.options.map((option, position) => {
              const isCorrect = option === question.answer
              const isPicked = feedback?.picked === option
              const stateClass = feedback
                ? isCorrect ? ' is-correct' : isPicked ? ' is-wrong' : ''
                : ''
              return (
                <li key={option}>
                  <button
                    type="button"
                    className={`arena-option${stateClass}`}
                    onClick={() => settleAnswer(option)}
                    disabled={Boolean(feedback)}
                  >
                    <span className="arena-option-key">{String.fromCharCode(65 + position)}</span>
                    <span className="arena-option-text">{option}</span>
                    {feedback && isCorrect && <CheckCircle size={18} weight="fill" />}
                    {feedback && isPicked && !isCorrect && <X size={18} />}
                  </button>
                </li>
              )
            })}
          </ol>

          {feedback && (
            <p className={`arena-feedback${feedback.correct ? ' is-correct' : ' is-wrong'}`}>
              {feedback.correct
                ? t.arenaCorrect
                : feedback.picked === null
                  ? t.arenaPracticeTimeout(question.answer)
                  : t.arenaPracticeWrong(question.answer)}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

export function ArenaView() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [mode, setMode] = useState<ArenaMode>('duel')
  const [summary, setSummary] = useState<ArenaSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryKey, setSummaryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    getArenaSummaryApi()
      .then((data) => {
        if (cancelled) return
        setSummary(data)
        setSummaryLoading(false)
      })
      .catch(() => {
        if (!cancelled) setSummaryLoading(false)
      })
    return () => { cancelled = true }
  }, [summaryKey])

  const refreshSummary = useCallback(() => {
    setSummaryLoading(true)
    setSummaryKey((key) => key + 1)
  }, [])

  return (
    <div className="tab-view-container arena-view">
      <header className="arena-head">
        <div>
          <span className="page-eyebrow">{t.arenaEyebrow}</span>
          <h1>{t.arenaTitle}</h1>
          <p>{t.arenaDesc}</p>
        </div>
        <ArenaRecord summary={summary} loading={summaryLoading} />
      </header>

      <div className="arena-switch" role="tablist" aria-label={t.arenaTitle}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'duel'}
          className={`arena-switch-tab${mode === 'duel' ? ' is-active' : ''}`}
          onClick={() => setMode('duel')}
        >
          <span>{t.arenaDuelTab}</span>
          <small>{t.arenaDuelTabDesc}</small>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'practice'}
          className={`arena-switch-tab${mode === 'practice' ? ' is-active' : ''}`}
          onClick={() => setMode('practice')}
        >
          <span>{t.arenaPracticeTab}</span>
          <small>{t.arenaPracticeTabDesc}</small>
        </button>
      </div>

      {mode === 'duel'
        ? <DuelPanel currentUserId={user?.id ?? 0} onSummaryRefresh={refreshSummary} />
        : <PracticePanel />}
    </div>
  )
}
