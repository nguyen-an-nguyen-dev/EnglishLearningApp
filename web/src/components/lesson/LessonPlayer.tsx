import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ArrowClockwise, SpeakerHigh, X } from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import { speakText, stopSpeaking } from '../../utils/speech'
import { SpeakingPractice } from './SpeakingPractice'
import { useSpeakingMode } from './useSpeakingMode'
import { useAuth } from '../../context/AuthContext'
import {
  LESSON_MAX_HEARTS,
  advanceLessonRun,
  clearedQuestionCount,
  loseHeart,
  startLessonRun,
} from '../../utils/lessonRun'
import type { LessonRun } from '../../utils/lessonRun'
import {
  checkLessonAnswerApi,
  getLessonQuestionsApi,
  submitLessonCompletionApi,
} from '../../services/learningService'
import type {
  AnswerOption,
  CheckAnswerFeedback,
  CompleteLessonResult,
  Question,
  SubmittedAnswer,
} from '../../types/learning'

interface LessonPlayerProps {
  lessonId: number
  lessonTitle: string
  onClose: () => void
  onCompleted: () => void
}

interface QuestionBodyProps {
  question: Question
  lessonId: number
  lessonTitle: string
  heartsLeft: number
  isLast: boolean
  /** 1 on the first look; 2+ when this is a repeat of a missed question. */
  attempt: number
  onMissed: () => void
  onCorrect: (answer: string) => void
  onWrong: (answer: string, correctAnswer: string) => void
}

const MAX_HEARTS = LESSON_MAX_HEARTS

/** Hearts are drawn, not shipped as bitmaps, so the last one can beat and crack. */
function Heart({ state }: { state: 'full' | 'last' | 'crack' | 'empty' }) {
  const filled = state === 'full' || state === 'last'
  return (
    <svg
      className={`lesson-heart is-${state}`}
      viewBox="0 0 32 30"
      width="30"
      height="28"
      aria-hidden="true"
    >
      <path
        d="M16 27C5 19 2 13 2 9a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 4-3 10-14 18z"
        className={filled ? 'lesson-heart-fill' : 'lesson-heart-empty'}
      />
      {state === 'crack' && (
        <path className="lesson-heart-crack" d="M17 6l-4 7 5 3-4 8" />
      )}
    </svg>
  )
}

function Hearts({ hearts, justLost }: { hearts: number; justLost?: boolean }) {
  return (
    <div className="lesson-hearts" role="img" aria-label={`${hearts} trên ${MAX_HEARTS} trái tim còn lại`}>
      {Array.from({ length: MAX_HEARTS }, (_, index) => {
        let state: 'full' | 'last' | 'crack' | 'empty' = 'empty'
        if (index < hearts) state = hearts === 1 ? 'last' : 'full'
        else if (justLost && index === hearts) state = 'crack'
        return <Heart key={index} state={state} />
      })}
    </div>
  )
}

function Star({ on, delay }: { on: boolean; delay: number }) {
  return (
    <svg
      className={`lesson-star${on ? ' is-on' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
      viewBox="0 0 32 31"
      width={on ? 52 : 44}
      height={on ? 50 : 42}
      aria-hidden="true"
    >
      <path d="M16 2l4.2 9 9.8 1.2-7.2 6.8 1.9 9.7L16 23.8 7.3 28.7l1.9-9.7L2 12.2 11.8 11z" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <path d="M5 11.5l4 4L17 7" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconCross() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}

function IconRedo() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
      <path d="M36 22a14 14 0 1 1-4.5-10.3" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M33 4v9h-9" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type ExerciseKind = 'NGHE' | 'ĐỌC' | 'VIẾT' | 'NÓI'

function kindOf(type: string): ExerciseKind {
  if (type === 'speaking') return 'NÓI'
  if (type === 'listening' || type === 'listen_choice') return 'NGHE'
  if (type === 'multiple_choice' || type === 'fill_choice') return 'ĐỌC'
  return 'VIẾT'
}

/** `m:ss` clock for the audio player. */
function formatSeconds(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00'
  const total = Math.round(value)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function shuffleAnswers(answers: AnswerOption[]): AnswerOption[] {
  const copy = [...answers]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

function shuffleIndices(length: number): number[] {
  const copy = Array.from({ length }, (_, index) => index)
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

function QuestionBody({
  question,
  lessonId,
  lessonTitle,
  heartsLeft,
  isLast,
  attempt,
  onMissed,
  onCorrect,
  onWrong,
}: QuestionBodyProps) {
  const { t } = useI18n()
  const isSpeaking = question.question_type === 'speaking'
  const { remainingMs, setMuted } = useSpeakingMode(isSpeaking)
  const isTypingSpeech = isSpeaking && remainingMs > 0
  const isOptions = ['multiple_choice', 'fill_choice', 'listen_choice'].includes(question.question_type)
  const isWordBank = (question.question_type === 'word_order' || question.question_type === 'listening')
    && question.word_bank.length > 0
  const options = useMemo(
    () => shuffleAnswers(question.answers),
    [question],
  )
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null)
  const [selectedWordIds, setSelectedWordIds] = useState<number[]>([])
  const [wordOrder] = useState(() => shuffleIndices(question.word_bank.length))
  const [mode, setMode] = useState<'tap' | 'type'>('tap')
  const [input, setInput] = useState('')
  const [spokenAnswer, setSpokenAnswer] = useState('')
  const [checkedAnswer, setCheckedAnswer] = useState('')
  const [speakingBusy, setSpeakingBusy] = useState(false)
  const [checked, setChecked] = useState(false)
  const [feedback, setFeedback] = useState<CheckAnswerFeedback | null>(null)
  const [checking, setChecking] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [audioTime, setAudioTime] = useState(0)
  const [audioLength, setAudioLength] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const actionRef = useRef<HTMLButtonElement | null>(null)
  // QuestionBody is keyed per question, so mount time is the moment the
  // question appeared. That makes the timing sample belong to this question.
  const shownAtRef = useRef(0)

  useEffect(() => {
    shownAtRef.current = Date.now()
    const sample = audioRef.current
    return () => {
      if (!isSpeaking) return
      sample?.pause()
      stopSpeaking()
    }
  }, [isSpeaking])

  const selectedOption = options.find((option) => option.id === selectedOptionId) ?? null
  const selectedWords = selectedWordIds
    .map((wordId) => question.word_bank[wordId])
    .filter((word): word is string => Boolean(word))
  const answer = isSpeaking && !isTypingSpeech ? spokenAnswer : isOptions
    ? selectedOptionId !== null ? String(selectedOptionId) : ''
    : isWordBank && mode === 'tap'
      ? selectedWords.join(' ')
      : input.trim()
  const ready = answer.length > 0
  const kind = kindOf(question.question_type)
  const hasAudio = question.question_type === 'listening' || question.question_type === 'listen_choice'
  const highlightedCorrect = (option: AnswerOption) => (
    checked && feedback !== null && feedback.correct_answer === option.answer_text
  )
  const highlightedWrong = (option: AnswerOption) => (
    checked && feedback !== null && !feedback.is_correct && selectedOptionId === option.id
  )

  function toggleAudio() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      if (audio.ended || audio.currentTime >= audio.duration - 0.05) audio.currentTime = 0
      void audio.play().catch(() => setInlineError('Không phát được âm thanh của câu này.'))
    } else {
      audio.pause()
    }
  }

  function replayAudio() {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    void audio.play().catch(() => setInlineError('Không phát được âm thanh của câu này.'))
  }

  function switchMode(next: 'tap' | 'type') {
    if (checked) return
    setMode(next)
    setInlineError(null)
  }

  function addWord(wordId: number) {
    if (checked) return
    setSelectedWordIds((current) => (
      current.includes(wordId) ? current : [...current, wordId]
    ))
  }

  function removeWord(wordId: number) {
    if (checked) return
    setSelectedWordIds((current) => current.filter((id) => id !== wordId))
  }

  async function checkAnswer(submitted = answer) {
    if (!submitted.trim() || checking || checked) return
    setChecking(true)
    setInlineError(null)
    audioRef.current?.pause()
    if (isSpeaking) stopSpeaking()
    try {
      const result = await checkLessonAnswerApi(
        lessonId,
        question.id,
        submitted,
        Date.now() - shownAtRef.current,
      )
      setCheckedAnswer(submitted)
      setFeedback(result)
      setChecked(true)
      // The heart is spent the moment the verdict appears, not on the click
      // that leaves the screen, so the header never disagrees with the copy.
      if (!result.is_correct) onMissed()
    } catch (error: unknown) {
      setInlineError(error instanceof Error ? error.message : 'Không kiểm tra được đáp án.')
    } finally {
      setChecking(false)
    }
  }

  function handleAction() {
    if ((!ready && !checked) || checking || speakingBusy) return
    if (!checked) {
      void checkAnswer()
      return
    }
    if (feedback && !feedback.is_correct) {
      onWrong(checkedAnswer, feedback.correct_answer)
      return
    }
    onCorrect(checkedAnswer)
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleAction()
  }

  // 1–4 picks an option and Enter drives the footer, the way the practice
  // screen behaves everywhere else in the app.
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return
      if (event.key === 'Enter') {
        event.preventDefault()
        handleAction()
        return
      }
      if (!isOptions || checked) return
      const index = Number(event.key) - 1
      if (!Number.isInteger(index) || index < 0 || index >= options.length) return
      setSelectedOptionId(options[index].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Once a verdict is showing, the footer button is the only sensible target.
  useEffect(() => {
    if (checked && !checking) actionRef.current?.focus({ preventScroll: true })
  }, [checked, checking])

  const actionLabel = checking
    ? 'Đang kiểm tra...'
    : !checked
      ? 'Kiểm tra'
      : feedback?.is_correct
        ? isLast ? 'Hoàn thành' : 'Tiếp tục'
        : heartsLeft > 0 ? 'Câu tiếp theo' : 'Xem kết quả'

  const verdictTone = !checked ? 'idle' : feedback?.is_correct ? 'correct' : 'wrong'

  const prompt = isOptions && question.question_text.includes('___')
    ? question.question_text.split('___').map((part, index, parts) => (
        <span key={`${question.id}-part-${index}`}>
          {part}
          {index < parts.length - 1 && (
            <span className="lesson-fill-word">{selectedOption?.answer_text ?? '____'}</span>
          )}
        </span>
      ))
    : question.question_text

  return (
    <div className="lesson-question">
      <main className="lesson-stage">
        <div className="lesson-stage-inner">
          <div className="lesson-tags">
            <span className="lesson-chip">{kind}</span>
            {attempt > 1 && <span className="lesson-redo-chip">Làm lại lần {attempt}</span>}
            <span className="lesson-topic">{lessonTitle}</span>
          </div>

          <h1 className="lesson-prompt">{isTypingSpeech ? t.speakingListenAndType : prompt}</h1>

          {isSpeaking && (
            <div className="speaking-practice">
              <button type="button" className="speaking-control" disabled={speakingBusy}
                onClick={() => {
                  setInlineError(null)
                  if (question.audio_url) {
                    replayAudio()
                  } else if (!speakText(question.question_text, 'en')) {
                    setInlineError(t.speakingSampleError)
                  }
                }}>
                <SpeakerHigh size={18} aria-hidden="true" /> {t.speakingListen}
              </button>
              {question.audio_url && <audio ref={audioRef} src={question.audio_url} preload="none" />}
              {isTypingSpeech ? (
                <div className="speaking-mode">
                  <span>{t.speakingMuted(formatSeconds(Math.ceil(remainingMs / 1000)))}</span>
                  <button type="button" className="speaking-control" onClick={() => setMuted(false)}>{t.speakingResume}</button>
                </div>
              ) : (
                <>
                  <SpeakingPractice
                    sample={question.question_text}
                    disabled={checked || checking}
                    onStart={() => {
                      audioRef.current?.pause()
                      stopSpeaking()
                      setInlineError(null)
                      setSpokenAnswer('')
                    }}
                    onBusyChange={setSpeakingBusy}
                    onResult={({ transcript }) => {
                      setSpokenAnswer(transcript)
                      void checkAnswer(transcript)
                    }}
                  />
                  {!checked && !checking && (
                    <button type="button" className="speaking-control" onClick={() => {
                      setSpeakingBusy(false)
                      setMuted(true)
                    }}>{t.speakingMute}</button>
                  )}
                </>
              )}
            </div>
          )}

          {hasAudio && (
            question.audio_url ? (
              <div className={`lesson-audio${playing ? ' is-playing' : ''}`}>
                <audio
                  ref={audioRef}
                  src={question.audio_url}
                  preload="metadata"
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => {
                    setPlaying(false)
                    setAudioTime(0)
                  }}
                  onTimeUpdate={(event) => setAudioTime(event.currentTarget.currentTime)}
                  onLoadedMetadata={(event) => setAudioLength(event.currentTarget.duration)}
                />
                <button
                  type="button"
                  className="lesson-audio-play"
                  onClick={toggleAudio}
                  aria-label={playing ? 'Tạm dừng' : 'Nghe đoạn hội thoại'}
                >
                  {playing
                    ? <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 3h4v12H4zM10 3h4v12h-4z" fill="currentColor" /></svg>
                    : <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 3l10 6-10 6z" fill="currentColor" /></svg>}
                </button>
                <div className="lesson-audio-body">
                  <span className="lesson-audio-label">Nghe đoạn hội thoại</span>
                  <div className="lesson-audio-track">
                    <span style={{ width: `${audioLength ? (audioTime / audioLength) * 100 : 0}%` }} />
                  </div>
                </div>
                <span className="lesson-audio-time">
                  {formatSeconds(audioTime)} / {formatSeconds(audioLength)}
                </span>
                <button
                  type="button"
                  className="lesson-audio-replay"
                  onClick={replayAudio}
                  aria-label="Nghe lại từ đầu"
                >
                  <ArrowClockwise size={16} weight="bold" />
                </button>
              </div>
            ) : (
              <p className="lesson-audio-note">Câu này chưa có âm thanh.</p>
            )
          )}

          {isOptions && (
            <div className="lesson-options" role="radiogroup" aria-label={question.question_text}>
              {options.map((option, index) => {
                const selected = selectedOptionId === option.id
                const stateClass = highlightedCorrect(option)
                  ? ' is-correct'
                  : highlightedWrong(option)
                    ? ' is-wrong'
                    : ''
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`lesson-option${selected ? ' is-selected' : ''}${stateClass}`}
                    onClick={() => {
                      if (checked) return
                      setSelectedOptionId(option.id)
                    }}
                    disabled={checked}
                  >
                    <span className="lesson-option-letter">{String.fromCharCode(65 + index)}</span>
                    <span>{option.answer_text}</span>
                  </button>
                )
              })}
            </div>
          )}

          {isWordBank && (
            <>
              <div className="lesson-mode" role="tablist" aria-label="Cách trả lời">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'tap'}
                  className={`lesson-mode-tab${mode === 'tap' ? ' is-active' : ''}`}
                  onClick={() => switchMode('tap')}
                  disabled={checked}
                >
                  Chạm từ
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'type'}
                  className={`lesson-mode-tab${mode === 'type' ? ' is-active' : ''}`}
                  onClick={() => switchMode('type')}
                  disabled={checked}
                >
                  Tự viết
                </button>
              </div>

              {mode === 'tap' ? (
                <>
                  <div className="lesson-word-answer">
                    {selectedWordIds.length === 0 ? (
                      <span className="lesson-word-placeholder">Chạm các từ bên dưới để xếp câu.</span>
                    ) : (
                      selectedWordIds.map((wordId, position) => (
                        <button
                          key={`${wordId}-${position}`}
                          type="button"
                          className="lesson-word is-selected"
                          onClick={() => removeWord(wordId)}
                          disabled={checked}
                        >
                          {question.word_bank[wordId]}
                        </button>
                      ))
                    )}
                  </div>
                  {selectedWordIds.length > 0 && !checked && (
                    <button type="button" className="lesson-clear" onClick={() => setSelectedWordIds([])}>
                      Xóa hết
                    </button>
                  )}
                  <div className="lesson-word-bank">
                    {wordOrder
                      .filter((wordId) => !selectedWordIds.includes(wordId))
                      .map((wordId) => (
                        <button
                          key={wordId}
                          type="button"
                          className="lesson-word"
                          onClick={() => addWord(wordId)}
                          disabled={checked}
                        >
                          {question.word_bank[wordId]}
                        </button>
                      ))}
                  </div>
                </>
              ) : (
                <input
                  className="lesson-text-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={hasAudio ? 'Nghe rồi viết lại cả câu...' : 'Viết lại cả câu bằng tiếng Anh...'}
                  disabled={checked}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                />
              )}
            </>
          )}

          {!isOptions && !isWordBank && (!isSpeaking || isTypingSpeech) && (
            <input
              className="lesson-text-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={isSpeaking ? t.speakingType : 'Nhập câu trả lời...'}
              aria-label={isSpeaking ? t.speakingType : undefined}
              maxLength={isSpeaking ? 500 : undefined}
              disabled={checked || checking}
              autoComplete="off"
              autoFocus
            />
          )}

          {inlineError && <p className="lesson-inline-error">{inlineError}</p>}
        </div>
      </main>

      <footer className={`lesson-foot is-${verdictTone}`}>
        <div className="lesson-foot-inner">
          {checked && feedback && (
            <div className="lesson-verdict" role="status">
              <span className="lesson-verdict-icon">
                {feedback.is_correct ? <IconCheck /> : <IconCross />}
              </span>
              <div className="lesson-verdict-copy">
                <b>{feedback.is_correct ? 'Chính xác!' : 'Chưa đúng!'}</b>
                {feedback.is_correct
                  ? (feedback.meaning_vi && <p>{feedback.meaning_vi}</p>)
                  : (
                    <p>
                      Đáp án đúng: <strong>{feedback.correct_answer}</strong>
                      {heartsLeft > 0
                        ? ' · Câu này sẽ quay lại sau vài câu nữa.'
                        : ' · Đó là trái tim cuối cùng của lượt này.'}
                    </p>
                  )}
              </div>
            </div>
          )}
          <button
            ref={actionRef}
            type="button"
            className={`lesson-cta ${verdictTone === 'correct' ? 'is-next' : verdictTone === 'wrong' ? 'is-warn' : 'is-check'}`}
            onClick={handleAction}
            disabled={checking || speakingBusy || (!checked && !ready)}
          >
            {actionLabel}
          </button>
        </div>
      </footer>
    </div>
  )
}

export function LessonPlayer({
  lessonId,
  lessonTitle,
  onClose,
  onCompleted,
}: LessonPlayerProps) {
  const { token } = useAuth()
  const [run, setRun] = useState<LessonRun<Question>>(() => startLessonRun<Question>([]))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answersLog, setAnswersLog] = useState<SubmittedAnswer[]>([])
  const [result, setResult] = useState<CompleteLessonResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadKey, setLoadKey] = useState(0)
  const [view, setView] = useState<'quiz' | 'result' | 'redo' | 'out'>('quiz')
  const [redoFrom, setRedoFrom] = useState<'result' | 'out'>('out')
  const [mode, setMode] = useState<'lesson' | 'review'>('lesson')
  const [attemptNo, setAttemptNo] = useState(1)
  const [bestScore, setBestScore] = useState<number | null>(null)
  const [missedIds, setMissedIds] = useState<number[]>([])
  const [corrections, setCorrections] = useState<Record<number, string>>({})
  const [questionById, setQuestionById] = useState<Record<number, Question>>({})
  const [exitOpen, setExitOpen] = useState(false)
  const startedAtRef = useRef<number>(0)

  // The run owns the queue, the hearts and the verdict; the first queue entry
  // is the question on screen. Progress counts cleared questions, never
  // screens seen, so a requeued question cannot push the bar backwards.
  const currentEntry = run.queue[0]
  const currentQuestion = currentEntry?.question
  const clearedCount = clearedQuestionCount(run)
  const elapsedSeconds = () => Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000))

  useEffect(() => {
    if (!token) return
    let active = true
    startedAtRef.current = Date.now()
    getLessonQuestionsApi(lessonId)
      .then((data) => {
        if (!active) return
        setRun(startLessonRun(data))
        setQuestionById(Object.fromEntries(data.map((question) => [question.id, question])))
        setMissedIds([])
        setAnswersLog([])
        setMode('lesson')
        setResult(null)
        setView('quiz')
        startedAtRef.current = Date.now()
        setLoading(false)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setLoading(false)
        setError(reason instanceof Error ? reason.message : 'Không mở được bài học.')
      })
    return () => {
      active = false
    }
  }, [lessonId, token, loadKey])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  function finish(log: SubmittedAnswer[]) {
    setSubmitting(true)
    setError(null)
    submitLessonCompletionApi(lessonId, log, elapsedSeconds())
      .then((data) => {
        setResult(data)
        setBestScore((previous) => Math.max(previous ?? 0, data.score))
        setView('result')
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Không lưu được kết quả bài học.')
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  function handleAnswer(answer: string, isCorrect: boolean, correctAnswer?: string) {
    if (!currentQuestion) return
    const nextLog = [
      ...answersLog.filter((entry) => entry.questionId !== currentQuestion.id),
      { questionId: currentQuestion.id, answer },
    ]
    setAnswersLog(nextLog)

    if (!isCorrect) {
      const missedQuestionId = currentQuestion.id
      setMissedIds((previous) => (
        previous.includes(missedQuestionId) ? previous : [...previous, missedQuestionId]
      ))
      if (correctAnswer) {
        setCorrections((previous) => ({ ...previous, [missedQuestionId]: correctAnswer }))
      }
    }

    const nextRun = advanceLessonRun(run, isCorrect)
    setRun(nextRun)
    if (nextRun.status !== 'cleared') return

    if (mode === 'review') {
      setView('result')
      return
    }
    finish(nextLog)
  }

  function missHeart() {
    setRun((current) => loseHeart(current))
  }

  /** Full replay: the same lesson from the first question, one attempt later. */
  function restart() {
    setResult(null)
    setRun(startLessonRun<Question>([]))
    setAnswersLog([])
    setMissedIds([])
    setCorrections({})
    setSubmitting(false)
    setError(null)
    setMode('lesson')
    setAttemptNo((value) => value + 1)
    setView('quiz')
    setLoading(true)
    setLoadKey((value) => value + 1)
  }

  /** Practice only the questions missed in the last attempt — no rewards. */
  function startReview() {
    const questions = missedIds
      .map((id) => questionById[id])
      .filter((question): question is Question => Boolean(question))
    if (questions.length === 0) return
    setRun(startLessonRun(questions))
    setAnswersLog([])
    setMissedIds([])
    setMode('review')
    setView('quiz')
  }

  if (loading || submitting) {
    return (
      <div className="lesson-player">
        <div className="lesson-state">
          <p>{submitting ? 'Đang lưu kết quả...' : 'Đang chuẩn bị bài học...'}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="lesson-player">
        <div className="lesson-state">
          <h1>Không thể mở bài học</h1>
          <p>{error}</p>
          <div className="lesson-state-actions">
            <button type="button" className="lesson-cta is-check" onClick={restart}>Thử lại</button>
            <button type="button" className="lesson-cta is-ghost" onClick={onClose}>Quay lại lộ trình</button>
          </div>
        </div>
      </div>
    )
  }

  const total = run.total
  const firstTryCorrect = Math.max(0, total - missedIds.filter((id) => questionById[id]).length)
  const ratio = total > 0 ? firstTryCorrect / total : 0
  const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1
  const missedQuestions = missedIds
    .map((id) => questionById[id])
    .filter((question): question is Question => Boolean(question))
  const passed = mode === 'review' ? true : result?.lesson_status === 'completed'
  const leveledUp = Boolean(result && result.level_after > result.level_before)

  if (view === 'result') {
    const reviewMode = mode === 'review'
    return (
      <div className="lesson-player">
        <main className="lesson-result-wrap">
          <section className={`lesson-card${passed ? ' is-passed' : ' is-failed'}`} aria-labelledby="lesson-result-title">
            <div className="lesson-stars" role="img" aria-label={`${stars} trên 3 sao`}>
              {[0, 1, 2].map((index) => <Star key={index} on={index < stars} delay={index * 140} />)}
            </div>
            <h1 id="lesson-result-title">
              {reviewMode
                ? 'Ôn xong các câu sai!'
                : passed ? 'Hoàn thành bài học!' : 'Chưa đạt bài này'}
            </h1>
            <p className="lesson-card-sub">{lessonTitle}</p>

            <div className="lesson-score">{firstTryCorrect}<small>/{total}</small></div>
            <p className="lesson-card-sub">câu đúng ngay từ lần đầu</p>

            {!reviewMode && result && passed && (
              <div className="lesson-prizes">
                <span className="lesson-prize">+{result.xp_earned} XP</span>
                <span className="lesson-prize"><i className="lesson-coin" aria-hidden="true" />+{result.rc_earned} RC</span>
                <span className="lesson-prize"><Hearts hearts={run.hearts} /></span>
              </div>
            )}
            {reviewMode && (
              <p className="lesson-card-sub">Lượt ôn tập không tính XP hay Race Coin.</p>
            )}

            {!reviewMode && result && !passed && (
              <p className="lesson-note is-failed">
                Cần đúng cả {result.total_questions} câu trong một lượt để hoàn thành bài.
              </p>
            )}
            {!reviewMode && result && !result.is_first_completion && passed && (
              <p className="lesson-note">Học lại bài: bạn nhận 50% XP của lần hoàn thành đầu tiên.</p>
            )}
            {leveledUp && result && (
              <p className="lesson-note is-level">Lên cấp {result.level_after}! Mở Gara để xem vật phẩm vừa mở khoá.</p>
            )}
            {!reviewMode && result?.stage_reward && (
              <p className="lesson-note is-stage">
                Hoàn thành chặng: +{result.stage_reward.rc} RC, +{result.stage_reward.xp} XP
              </p>
            )}

            {!reviewMode && result && result.badges_awarded.length > 0 && (
              <div className="lesson-badges">
                <span className="lesson-chip">HUY HIỆU MỚI</span>
                {result.badges_awarded.map((badge) => (
                  <div key={badge.code} className="lesson-badge-row">
                    <div>
                      <strong>{badge.name}</strong>
                      <span>{badge.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {missedQuestions.length > 0 && (
              <div className="lesson-review">
                <h2>Câu cần ôn ({missedQuestions.length})</h2>
                <ul>
                  {missedQuestions.map((question) => (
                    <li key={question.id}>
                      <b>{question.question_text}</b>
                      <span>
                        {corrections[question.id] && <em>{corrections[question.id]}</em>}
                        {corrections[question.id] && question.explanation ? ' · ' : ''}
                        {question.explanation ?? ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="lesson-card-actions">
              <button type="button" className="lesson-cta is-ghost" onClick={() => { setRedoFrom('result'); setView('redo') }}>
                Học lại bài
              </button>
              {missedQuestions.length > 0 && (
                <button type="button" className="lesson-cta is-warn" onClick={startReview}>
                  Ôn câu sai ({missedQuestions.length})
                </button>
              )}
              <button type="button" className="lesson-cta is-next" onClick={passed ? onCompleted : onClose}>
                Về lộ trình
              </button>
            </div>
          </section>
        </main>
      </div>
    )
  }

  if (view === 'redo') {
    return (
      <div className="lesson-player">
        <main className="lesson-result-wrap">
          <section className="lesson-card" aria-labelledby="lesson-redo-title">
            <span className="lesson-card-icon"><IconRedo /></span>
            <h1 id="lesson-redo-title">Học lại bài này?</h1>
            <p className="lesson-card-sub">Làm lại từ câu đầu tiên để nhớ chắc hơn.</p>
            <div className="lesson-rows">
              <div><span>Điểm cao nhất</span><b>{bestScore === null ? '—' : `${bestScore}%`}</b></div>
              <div><span>Số câu</span><b>{total}</b></div>
              <div><span>Lượt thử lại</span><b>{MAX_HEARTS} tim</b></div>
              <div><span>Lần học</span><b>Lần {attemptNo + 1}</b></div>
            </div>
            <p className="lesson-card-sub">Điểm cao nhất chỉ đổi khi bạn vượt qua nó.</p>
            <div className="lesson-card-actions">
              <button type="button" className="lesson-cta is-ghost" onClick={() => setView(redoFrom)}>Để sau</button>
              <button type="button" className="lesson-cta is-check" autoFocus onClick={restart}>Bắt đầu học lại</button>
            </div>
          </section>
        </main>
      </div>
    )
  }

  if (run.status === 'failed' || view === 'out') {
    return (
      <div className="lesson-player">
        <main className="lesson-result-wrap">
          <section className="lesson-card is-failed" role="alert">
            <Hearts hearts={0} />
            <h1>Hết lượt thử lại</h1>
            <p className="lesson-card-sub">
              Bạn đã dùng hết {MAX_HEARTS} trái tim cho bài này. Lượt học chưa được tính hoàn thành,
              và lượt này không có XP hay Race Coin.
            </p>
            <div className="lesson-card-actions">
              <button type="button" className="lesson-cta is-check" onClick={() => { setRedoFrom('out'); setView('redo') }}>
                Học lại bài
              </button>
              <button type="button" className="lesson-cta is-ghost" onClick={onClose}>Về lộ trình</button>
            </div>
          </section>
        </main>
      </div>
    )
  }

  if (!currentQuestion || !currentEntry) {
    return (
      <div className="lesson-player">
        <div className="lesson-state">
          <h1>Bài học chưa có câu hỏi</h1>
          <p>Bài này hiện chưa có nội dung để làm.</p>
          <button type="button" className="lesson-cta is-ghost" onClick={onClose}>Quay lại lộ trình</button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="lesson-player"
      data-lesson-title={lessonTitle}
      data-question-prompt={currentQuestion.question_text}
      data-question-index={`${clearedCount}/${run.total}`}
      data-question-type={currentQuestion.question_type}
      data-question-explanation={currentQuestion.explanation || ''}
      data-question-attempt={currentEntry.attempt}
    >
      <header className="lesson-header">
        <button type="button" className="lesson-exit" onClick={() => setExitOpen(true)}>
          <X size={15} weight="bold" aria-hidden="true" />
          Đóng
        </button>
        <div
          className="lesson-progress"
          role="progressbar"
          aria-label="Số câu đã trả lời đúng"
          aria-valuemin={0}
          aria-valuemax={Math.max(run.total, 1)}
          aria-valuenow={clearedCount}
        >
          <i style={{ width: `${(clearedCount / Math.max(run.total, 1)) * 100}%` }} />
        </div>
        <span className="lesson-counter" title="Số câu đã trả lời đúng, kể cả câu phải làm lại">
          {clearedCount}/{run.total}
        </span>
        <Hearts hearts={run.hearts} justLost={false} />
      </header>

      {mode === 'review' && (
        <div className="lesson-banner">
          <span>Ôn câu sai · {run.total} câu</span>
        </div>
      )}

      <QuestionBody
        key={`${currentEntry.question.id}-${currentEntry.attempt}`}
        question={currentQuestion}
        lessonId={lessonId}
        lessonTitle={lessonTitle}
        heartsLeft={run.hearts}
        isLast={run.queue.length === 1}
        attempt={currentEntry.attempt}
        onMissed={missHeart}
        onCorrect={(answer) => handleAnswer(answer, true)}
        onWrong={(answer, correctAnswer) => handleAnswer(answer, false, correctAnswer)}
      />

      {exitOpen && (
        <div
          className="lesson-overlay"
          onClick={() => setExitOpen(false)}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div
            className="lesson-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lesson-exit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="lesson-exit-title">Thoát bài học?</h2>
            <p className="lesson-card-sub">Tiến độ của lượt học này sẽ không được lưu.</p>
            <button type="button" className="lesson-cta is-check" autoFocus onClick={() => setExitOpen(false)}>
              Ở lại học tiếp
            </button>
            <button type="button" className="lesson-cta is-ghost" onClick={onClose}>Thoát</button>
          </div>
        </div>
      )}
    </div>
  )
}
