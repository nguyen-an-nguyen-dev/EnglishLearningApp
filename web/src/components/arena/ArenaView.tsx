import { useCallback, useEffect, useRef, useState } from 'react'
import {
  House,
  ImageSquare,
  Lightning,
  X,
} from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useWallet } from '../../context/WalletContext'
import { useI18n } from '../../i18n'
import { AvatarFrame } from '../cosmetics/AvatarFrame'
import { CarBadge } from '../cosmetics/CarBadge'
import { TurboMascot } from '../cosmetics/TurboMascot'
import { Nameplate } from '../cosmetics/Nameplate'
import { saveWordApi } from '../../services/videoService'
import {
  createBattleSocket,
  getArenaSummaryApi,
} from '../../services/battleService'
import type { BattleSocket } from '../../services/battleService'
import type {
  ArenaRecentResult,
  ArenaSummary,
  BattleFinish,
  BattleOpponent,
  BattleQuestion,
  BattleRoundEnd,
  BattleScore,
  BattleStart,
} from '../../types/video'
import { formatCompact } from '../../utils/format'
import { matchOutcome } from '../../utils/arena'
import { setArenaLeaveGuard } from '../../utils/arenaGuard'
import { initialOf } from '../../utils/avatar'
import {
  clearBattleSession,
  readBattleSession,
  saveBattleSession,
  type BattleSessionSnapshot,
} from '../../utils/battleSession'

type DuelScreen = 'lobby' | 'queue' | 'match' | 'result'
type DuelConnection = { mode: 'queue' | 'resume'; matchId?: number; nonce: number }

const DUEL_ROUNDS = 8
const DUEL_SECONDS = 25

/** Where a score puts its car on the lane, kept clear of both end caps. */
function lanePercent(score: number, best: number): number {
  return Math.min(88, Math.max(5, Math.round((score / Math.max(best, 1)) * 88)))
}

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
  const { wallet } = useWallet()
  const coins = wallet?.coins ?? 0
  const level = wallet?.level ?? 1
  // `summary === null` after loading means the request failed. Showing zeros
  // would read as a real 0-0 record, so show a dash instead.
  const unavailable = !loading && summary === null
  const dash = (value: number | string) => (loading ? '...' : unavailable ? '—' : value)
  const stats = [
    { label: t.arenaPlayed, value: dash(summary?.played ?? '—') },
    { label: t.arenaWins, value: dash(summary?.wins ?? '—') },
    { label: t.arenaWinRate, value: dash(summary ? `${summary.win_rate}%` : '—') },
    { label: t.arenaWinStreak, value: dash(summary?.win_streak ?? '—') },
  ]
  return (
    <div className="arena-chips">
      <span className="gc-pill">
        <i className="gc-coin" aria-hidden="true" />
        {formatCompact(coins)} RC
      </span>
      <span className="gc-pill">{t.walletLevel} {level}</span>
      {stats.map((stat) => (
        <span key={stat.label} className="gc-pill">
          {stat.value}
          <small>{stat.label}</small>
        </span>
      ))}
    </div>
  )
}

interface DuelPanelProps {
  currentUserId: number
  onSummaryRefresh: () => void
  /** Newest-first recent results, shown in the lobby and on the result screen. */
  recent: ArenaRecentResult[]
}

function DuelPanel({ currentUserId, onSummaryRefresh, recent }: DuelPanelProps) {
  const { t } = useI18n()
  const { token, user } = useAuth()
  const { wallet } = useWallet()
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
  // Rounds the learner did not take, kept for the "words to review" list on the
  // result screen. `translation` is captured from the question that was on
  // screen, so the review list reads like a glossary rather than an answer key.
  const [missedWords, setMissedWords] = useState<Array<{ answer: string; translation: string }>>([])
  // The round-end event carries the word but not its meaning, so the current
  // question's translation is stashed here while the round is live.
  const questionTranslationRef = useRef('')
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
    setMissedWords([])
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
    setOpponent(null)
    setScreen('queue')
    setConnection({ mode: 'queue', nonce: Date.now() })
  }, [disconnectSocket, t.arenaLoginRequired, token])

  /**
   * "Ôn lại từ sai" from the result screen: push this match's missed words into
   * the saved-vocabulary list, then drop back to the lobby. Saving is
   * best-effort — a failure must not trap the learner on the result screen.
   */
  const reviewMissed = useCallback(() => {
    const words = missedWords
    resetDuel()
    for (const word of words) {
      void saveWordApi({ word: word.answer, meaningVi: word.translation }).catch(() => undefined)
    }
  }, [missedWords, resetDuel])

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
      questionTranslationRef.current = nextQuestion.translation
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
      // A round the learner did not win is vocabulary worth revisiting.
      if (result.winnerUserId !== currentUserId) {
        const translation = questionTranslationRef.current
        setMissedWords((prev) => (
          prev.some((word) => word.answer === result.answer)
            ? prev
            : [...prev, { answer: result.answer, translation }]
        ))
      }
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
  }, [clearOpponentAttempt, clearWrongFlash, connection, currentUserId, onSummaryRefresh, t, token])

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
  const isSearching = screen === 'queue'

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
      <section
        className="arena-match"
        data-round={question?.round ?? 1}
        data-total-rounds={game.totalRounds}
        data-my-score={scoreFor(currentUserId)}
        data-opponent-name={opponentPlayer?.name ?? t.arenaOpponent}
        data-opponent-score={scoreFor(opponentPlayer?.userId ?? opponentId)}
        data-question-translation={question?.translation ?? ''}
        data-question-example={question?.example ?? ''}
        data-question-level={question?.cefrLevel ?? ''}
      >
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
            <AvatarFrame
              name={player?.name ?? t.arenaYou}
              visualKey={wallet?.equipment.frame?.visual_key ?? null}
              size={44}
            />
            <div className="arena-side-copy">
              <Nameplate visualKey={wallet?.equipment.nameplate?.visual_key ?? null} dense>
                {player?.name ?? t.arenaYou}
              </Nameplate>
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
    const reward = finish.rewards?.[currentUserId] ?? null
    const leveledUp = Boolean(reward && reward.level_after > reward.level_before)
    const myScore = scoreFor(currentUserId)
    // `opponentPlayer` lives in the match branch, so read the rival from the
    // finished scoreboard instead.
    const rivalEntry = finish.scores.find((entry) => entry.userId !== currentUserId)
    const rivalScore = rivalEntry?.score ?? 0
    const myEntry = finish.scores.find((entry) => entry.userId === currentUserId)
    const myName = myEntry?.name ?? t.arenaYou
    const best = Math.max(myScore, rivalScore, 1)
    const verdict = isCancelled
      ? t.arenaMatchCancelled
      : outcome === 'win' ? t.arenaMatchWin : outcome === 'lose' ? t.arenaMatchLose : t.arenaMatchDraw

    return (
      <section className={`arena-result-v2 is-${outcome ?? 'draw'}${isCancelled ? ' is-cancelled' : ''}`}>
        {/* The reference layout: a checkered masthead, the two drivers facing a
            rotated verdict, two lanes showing how far each one got, then the
            payout as three cards. Kept as one board so the result reads as a
            single race, not a stack of panels. */}
        <div className="arena-v2-board">
          <div className="arena-v2-checker" aria-hidden="true" />

          <div className="arena-v2-seats">
            <div className="arena-v2-seat is-you">
              <AvatarFrame
                name={myName}
                visualKey={wallet?.equipment.frame?.visual_key ?? null}
                size={64}
              />
              <div className="arena-v2-seat-copy">
                <span className="arena-v2-tag">{t.arenaYou}</span>
                <span className="arena-v2-name">{myName}</span>
                <strong className={`arena-v2-score${outcome === 'win' ? ' is-winner' : ''}`}>{myScore}</strong>
              </div>
            </div>

            <div className="arena-v2-ribbon">{verdict}</div>

            <div className="arena-v2-seat is-rival">
              <AvatarFrame name={rivalEntry?.name ?? null} visualKey={null} size={64} />
              <div className="arena-v2-seat-copy">
                <span className="arena-v2-tag">
                  {!isCancelled && finish.winnerUserId === rivalEntry?.userId ? t.arenaWinnerTag : t.arenaOpponent}
                </span>
                <span className="arena-v2-name">{rivalEntry?.name ?? t.arenaOpponent}</span>
                <strong className={`arena-v2-score${outcome === 'lose' ? ' is-winner' : ''}`}>{rivalScore}</strong>
              </div>
            </div>
          </div>

          {/* Each car sits where its score put it on the track. */}
          <div className="arena-v2-lane" aria-hidden="true">
            <span className="arena-v2-car" style={{ left: `${lanePercent(myScore, best)}%` }}>
              <CarBadge visualKey={wallet?.equipment.car?.visual_key ?? null} size={40} />
            </span>
            <span className="arena-v2-finish" />
          </div>
          <div className="arena-v2-lane" aria-hidden="true">
            <span className="arena-v2-car" style={{ left: `${lanePercent(rivalScore, best)}%` }}>
              <CarBadge visualKey={null} size={40} />
            </span>
            <span className="arena-v2-finish" />
          </div>
        </div>

        {/* Reward next: this is what the round was for. */}
        {!isCancelled && reward && (
          <ul className="arena-v2-payouts" aria-label={t.arenaRewardTitle}>
            <li className="arena-v2-payout">
              <span className="arena-v2-orb is-rc" aria-hidden="true">RC</span>
              <span className="arena-v2-payout-body">
                <span>Race Coin</span>
                <b>{reward.rc > 0 ? `+${reward.rc}` : '0'}</b>
              </span>
            </li>
            <li className="arena-v2-payout">
              <span className="arena-v2-orb is-xp" aria-hidden="true">XP</span>
              <span className="arena-v2-payout-body">
                <span>XP</span>
                <b>{reward.xp > 0 ? `+${reward.xp}` : '0'}</b>
              </span>
            </li>
            <li className="arena-v2-payout">
              <span className="arena-v2-orb is-rp" aria-hidden="true">★</span>
              <span className="arena-v2-payout-body">
                <span>Điểm đua</span>
                <b>{reward.rp > 0 ? `+${reward.rp}` : '0'}</b>
              </span>
            </li>
          </ul>
        )}

        {!isCancelled && reward && !reward.counted && (
          <div className="arena-v2-notes">
            <p className="arena-v2-note">Trận này không tính thưởng — bạn đã đạt giới hạn đấu có thưởng trong ngày.</p>
          </div>
        )}
        {!isCancelled && leveledUp && (
          <div className="arena-v2-notes">
            <p className="arena-v2-note is-level">
              Lên cấp {reward!.level_after}! Mở Gara để xem vật phẩm vừa mở khoá.
            </p>
          </div>
        )}

        <div className="arena-v2-lower">
          <section className="arena-v2-panel">
            <span className="gc-label">5 trận gần nhất</span>
            {recent.length === 0 ? (
              <p className="arena-v2-form-empty">Chưa có trận nào trước đây.</p>
            ) : (
              <div className="arena-v2-form">
                {recent.map((entry) => (
                  <i
                    key={entry.match_id}
                    className={entry.won ? '' : 'is-loss'}
                    title={`${entry.won ? 'Thắng' : 'Thua'} · ${entry.opponent_name}`}
                  >
                    {entry.won ? 'T' : 'B'}
                  </i>
                ))}
              </div>
            )}

            {missedWords.length > 0 && (
              <>
                <span className="gc-label">Từ cần ôn lại</span>
                {/* Capped at four: a full 0-8 loss would otherwise push the
                    next-step panel off-screen. */}
                <ul className="arena-v2-words">
                  {missedWords.slice(0, 4).map((word) => (
                    <li key={word.answer}>
                      <b>{word.answer}</b>
                      <span>{word.translation}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="arena-v2-panel arena-v2-next">
            <div className="arena-v2-coach">
              <div className="gara-bubble">
                <span className="gara-bubble-name">Bác Turbo</span>
                <br />
                {outcome === 'win'
                  ? 'Thắng rồi! Nối thêm một trận nữa để chuỗi dài hơn, điểm đua tuần này cũng dày hơn.'
                  : 'Thua một trận thôi, đừng nản! Ôn mấy từ bên cạnh rồi gỡ lại ngay nhé.'}
              </div>
              <div className="gara-stall-mascot">
                <TurboMascot />
              </div>
            </div>

            <h3>{outcome === 'win' ? 'Giữ chuỗi thắng?' : 'Gỡ lại ngay?'}</h3>
            <p>
              {outcome === 'win'
                ? 'Đấu thêm một trận để nối chuỗi và cộng thêm điểm đua cho tuần này.'
                : 'Mỗi trận vẫn trả Race Coin, nên đấu lại là cách nhanh nhất để lấy lại điểm.'}
            </p>
            {error && <p className="arena-v2-error">{error}</p>}
            <div className="arena-v2-actions">
              <button type="button" className="gc-btn is-primary" onClick={findOpponent}>
                <Lightning size={16} weight="fill" /> {t.arenaPlayAgain}
              </button>
              <div className="arena-v2-actions-row">
                <button type="button" className="gc-btn is-quiet" onClick={reviewMissed}>
                  Ôn lại từ sai
                </button>
                <button type="button" className="gc-btn is-quiet" onClick={resetDuel}>
                  <House size={15} weight="bold" /> {t.arenaBackToLobby}
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>
    )
  }

  return (
    <>
      {/* The lobby pairs a recent-results strip with the versus card; matchmaking
          stays in this card so learners can cancel without leaving the lobby. */}
      <section className={`arena-lobby-card${isSearching ? ' is-searching' : ''}`}>
        <div className="arena-v2-checker" aria-hidden="true" />

        <div className="arena-v2-hero">
          <div className="arena-v2-hero-copy">
            <span className="arena-v2-eyebrow">01 · {t.arenaDuelTab}</span>
            <h2>{t.arenaDuelTitle}</h2>
            <p>{t.arenaDuelDesc}</p>

            <div className="arena-v2-info">
              <span>{t.arenaLiveQueue}</span>
              <span>{t.arenaSecondsEach(DUEL_SECONDS)}</span>
              <span>{t.arenaRounds(DUEL_ROUNDS)}</span>
            </div>

            <div className="arena-v2-history" role="group" aria-label={t.arenaRecentMatches}>
              <span className="arena-v2-history-title">{t.arenaRecentMatches}</span>
              {recent.length === 0 ? (
                <span className="arena-v2-history-empty">{t.arenaNoRecentMatches}</span>
              ) : (
                <ol>
                  {recent.slice(0, 8).map((entry) => (
                    <li
                      key={entry.match_id}
                      className={entry.won ? 'is-win' : 'is-loss'}
                      title={`${entry.won ? t.arenaMatchWin : t.arenaMatchLose} · ${entry.opponent_name}`}
                      aria-label={`${entry.won ? t.arenaMatchWin : t.arenaMatchLose} · ${entry.opponent_name}`}
                    >
                      {entry.won ? t.arenaWinShort : t.arenaLossShort}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {error && <p className="arena-error">{error}</p>}

          </div>

          <div className="arena-v2-matchmaking">
            <div className="arena-v2-versus">
              <div className="arena-v2-versus-players">
                <div className="arena-v2-versus-slot">
                  <AvatarFrame
                    name={user?.name ?? null}
                    visualKey={wallet?.equipment.frame?.visual_key ?? null}
                    size={92}
                  />
                  <strong>{user?.name ?? t.arenaYou}</strong>
                  <small>{t.walletLevel} {wallet?.level ?? 1}</small>
                </div>
                <div className="arena-v2-versus-badge">VS</div>
                <div className={`arena-v2-versus-slot is-empty${isSearching ? ' is-searching' : ''}`}>
                  {isSearching ? (
                    <span className="arena-v2-search-orb" aria-hidden="true">
                      <i /><i /><i />
                    </span>
                  ) : (
                    <span className="arena-v2-versus-empty">?</span>
                  )}
                  <strong>{isSearching && opponent ? t.arenaQueueOpponent(opponent.name) : isSearching ? t.arenaSearching : t.arenaWaitingSeat}</strong>
                  <small>
                    {isSearching ? (
                      <span className="arena-v2-search-dots" role="status" aria-label={t.arenaSearching}>
                        <i /><i /><i />
                      </span>
                    ) : t.arenaWaitingSeatHint}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className={`gc-btn arena-v2-cta${isSearching ? ' is-cancel' : ' is-primary'}`}
                data-buddy-target="control:arena-start"
                aria-label={isSearching ? t.arenaCancel : t.arenaFindOpponent}
                onClick={isSearching ? resetDuel : findOpponent}
              >
                {isSearching ? t.arenaCancel : t.arenaFindOpponent}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="arena-v2-rules-block">
        <span className="gc-label">{t.arenaRulesTitle}</span>
        <ol className="arena-v2-rules">
          <li>
            <i>1</i>
            <p>{t.arenaRuleOne}</p>
          </li>
          <li>
            <i>2</i>
            <p>{t.arenaRuleTwo}</p>
          </li>
          <li>
            <i>3</i>
            <p>{t.arenaRuleThree}</p>
          </li>
        </ol>
      </section>

      <section className="arena-v2-tip">
        <div className="gara-bubble">
          <span className="gara-bubble-name">Bác Turbo</span>
          <br />
          {t.arenaLobbyTip}
        </div>
        <div className="gara-stall-mascot">
          <TurboMascot />
          <span className="gara-stall-shadow" aria-hidden="true" />
        </div>
      </section>
    </>
  )
}

export function ArenaView() {
  const { t } = useI18n()
  const { user } = useAuth()
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
    <div
      className="tab-view-container arena-view"
      data-played={summary?.played ?? 0}
      data-wins={summary?.wins ?? 0}
      data-win-rate={summary?.win_rate ?? 0}
      data-win-streak={summary?.win_streak ?? 0}
    >
      <header className="arena-head">
        <div>
          <span className="page-eyebrow">{t.arenaEyebrow}</span>
          <h1>{t.arenaTitle}</h1>
          <p>{t.arenaDesc}</p>
        </div>
        <ArenaRecord summary={summary} loading={summaryLoading} />
      </header>      <DuelPanel
        currentUserId={user?.id ?? 0}
        onSummaryRefresh={refreshSummary}
        recent={summary?.recent ?? []}
      />
    </div>
  )
}
