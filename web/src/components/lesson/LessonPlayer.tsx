import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
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
  token: string
  isLast: boolean
  onCorrect: (answer: string) => void
}

type ExerciseKind = 'NGHE' | 'ĐỌC' | 'VIẾT'

function kindOf(type: string): ExerciseKind {
  if (type === 'listening' || type === 'listen_choice') return 'NGHE'
  if (type === 'multiple_choice' || type === 'fill_choice') return 'ĐỌC'
  return 'VIẾT'
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
  token,
  isLast,
  onCorrect,
}: QuestionBodyProps) {
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
  const [input, setInput] = useState('')
  const [checked, setChecked] = useState(false)
  const [feedback, setFeedback] = useState<CheckAnswerFeedback | null>(null)
  const [checking, setChecking] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const selectedOption = options.find((option) => option.id === selectedOptionId) ?? null
  const selectedWords = selectedWordIds
    .map((wordId) => question.word_bank[wordId])
    .filter((word): word is string => Boolean(word))
  const answer = isOptions
    ? selectedOptionId !== null ? String(selectedOptionId) : ''
    : isWordBank
      ? selectedWords.join(' ')
      : input.trim()
  const ready = answer.length > 0
  const kind = kindOf(question.question_type)
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
      if (audio.ended) audio.currentTime = 0
      void audio.play().catch(() => setInlineError('Không phát được âm thanh của câu này.'))
    } else {
      audio.pause()
    }
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

  async function checkAnswer() {
    if (!ready || checking) return
    setChecking(true)
    setInlineError(null)
    audioRef.current?.pause()
    try {
      const result = await checkLessonAnswerApi(lessonId, question.id, answer, token)
      setFeedback(result)
      setChecked(true)
    } catch (error: unknown) {
      setInlineError(error instanceof Error ? error.message : 'Không kiểm tra được đáp án.')
    } finally {
      setChecking(false)
    }
  }

  function handleAction() {
    if (!ready || checking) return
    if (!checked) {
      void checkAnswer()
      return
    }
    if (feedback && !feedback.is_correct) {
      setChecked(false)
      setFeedback(null)
      return
    }
    onCorrect(answer)
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleAction()
  }

  const actionLabel = checking
    ? 'Đang kiểm tra…'
    : !checked
      ? 'Kiểm tra'
      : feedback?.is_correct
        ? isLast ? 'Hoàn thành' : 'Tiếp tục'
        : 'Thử lại'

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
      <div className="lesson-question-scroll">
        <div className="lesson-content">
          <div className="lesson-kind-row">
            <span className="lesson-kind">{kind}</span>
            <span className="lesson-title-small">{lessonTitle}</span>
          </div>

          <h1 className="lesson-prompt">{prompt}</h1>

          {(question.question_type === 'listening' || question.question_type === 'listen_choice') && (
            <div className="lesson-audio-row">
              {question.audio_url ? (
                <>
                  <audio
                    ref={audioRef}
                    src={question.audio_url}
                    preload="metadata"
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                  />
                  <button type="button" className="lesson-audio-button" onClick={toggleAudio}>
                    {playing ? 'Tạm dừng' : 'Nghe'}
                  </button>
                  <span className="lesson-audio-note">Nghe đoạn âm thanh rồi trả lời bên dưới.</span>
                </>
              ) : (
                <span className="lesson-audio-note">Câu này chưa có âm thanh.</span>
              )}
            </div>
          )}

          {isOptions && (
            <div className="lesson-options">
              {options.map((option, index) => {
                const selected = selectedOptionId === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`lesson-option${selected ? ' is-selected' : ''}${highlightedCorrect(option) ? ' is-correct' : ''}${highlightedWrong(option) ? ' is-wrong' : ''}`}
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
          )}

          {!isOptions && !isWordBank && (
            <input
              className="lesson-text-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Nhập câu trả lời..."
              disabled={checked}
              autoComplete="off"
              autoFocus
            />
          )}

          {inlineError && <p className="lesson-inline-error">{inlineError}</p>}
        </div>
      </div>

      <div className="lesson-footer">
        <div className="lesson-footer-inner">
          {checked && feedback && (
            <div className={`lesson-feedback ${feedback.is_correct ? 'is-correct' : 'is-wrong'}`}>
              <strong>{feedback.is_correct ? 'Chính xác' : 'Chưa đúng'}</strong>
              {!feedback.is_correct && (
                <span className="lesson-correct-answer">Đáp án đúng: {feedback.correct_answer}</span>
              )}
              {feedback.meaning_vi && <span className="lesson-meaning">{feedback.meaning_vi}</span>}
            </div>
          )}
          <button
            type="button"
            className="lesson-primary-button"
            onClick={handleAction}
            disabled={checking || (!checked && !ready)}
          >
            {actionLabel}
          </button>
        </div>
      </div>
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
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [answersLog, setAnswersLog] = useState<SubmittedAnswer[]>([])
  const [result, setResult] = useState<CompleteLessonResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadKey, setLoadKey] = useState(0)

  useEffect(() => {
    if (!token) return
    let active = true
    getLessonQuestionsApi(lessonId, token)
      .then((data) => {
        if (!active) return
        setQuestions(data)
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

  const currentQuestion = questions[index]

  function finish(log: SubmittedAnswer[]) {
    setSubmitting(true)
    setError(null)
    submitLessonCompletionApi(lessonId, log, token ?? undefined)
      .then((data) => {
        setResult(data)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Không lưu được kết quả bài học.')
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  function handleCorrect(answer: string) {
    if (!currentQuestion) return
    const nextLog = [
      ...answersLog.filter((entry) => entry.questionId !== currentQuestion.id),
      { questionId: currentQuestion.id, answer },
    ]
    setAnswersLog(nextLog)
    if (index + 1 < questions.length) {
      setIndex((value) => value + 1)
    } else {
      finish(nextLog)
    }
  }

  function restart() {
    setResult(null)
    setIndex(0)
    setAnswersLog([])
    setSubmitting(false)
    setError(null)
    setLoading(true)
    setLoadKey((value) => value + 1)
  }

  if (loading || submitting) {
    return (
      <div className="lesson-player">
        <div className="lesson-state">
          <p>{submitting ? 'Đang lưu kết quả…' : 'Đang chuẩn bị bài học…'}</p>
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
            <button type="button" className="lesson-primary-button" onClick={restart}>Thử lại</button>
            <button type="button" className="lesson-secondary-button" onClick={onClose}>Quay lại lộ trình</button>
          </div>
        </div>
      </div>
    )
  }

  if (result) {
    const completed = result.lesson_status === 'completed'
    return (
      <div className="lesson-player">
        <div className="lesson-result">
          <span className="lesson-kind">KẾT QUẢ</span>
          <h1>{completed ? 'Hoàn thành bài học' : 'Chưa đạt'}</h1>
          <p className="lesson-result-title">{lessonTitle}</p>
          {result.stage_completed && <p className="lesson-result-note">Bạn đã hoàn thành toàn bộ chặng này.</p>}

          <div className="lesson-result-stats">
            <div><span>Điểm</span><strong>{result.score}%</strong></div>
            <div><span>Đúng</span><strong>{result.correct_answers}/{result.total_questions}</strong></div>
            <div><span>XP</span><strong>+{result.xp_earned}</strong></div>
          </div>

          {result.badges_awarded.length > 0 && (
            <div className="lesson-badges">
              <span className="lesson-kind">HUY HIỆU MỚI</span>
              {result.badges_awarded.map((badge) => (
                <div key={badge.code} className="lesson-badge-row">
                  <strong>{badge.name}</strong>
                  <span>{badge.description}</span>
                </div>
              ))}
            </div>
          )}

          <div className="lesson-result-actions">
            <button
              type="button"
              className="lesson-primary-button"
              onClick={completed ? onCompleted : restart}
            >
              {completed ? 'Về lộ trình' : 'Làm lại bài'}
            </button>
            {completed && (
              <button type="button" className="lesson-secondary-button" onClick={restart}>
                Học lại
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="lesson-player">
        <div className="lesson-state">
          <h1>Bài học chưa có câu hỏi</h1>
          <p>Bài này hiện chưa có nội dung để làm.</p>
          <button type="button" className="lesson-secondary-button" onClick={onClose}>Quay lại lộ trình</button>
        </div>
      </div>
    )
  }

  return (
    <div className="lesson-player">
      <header className="lesson-header">
        <button type="button" className="lesson-close" onClick={onClose}>Đóng</button>
        <div className="lesson-progress" role="progressbar" aria-valuemin={1} aria-valuemax={questions.length} aria-valuenow={index + 1}>
          <span style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
        </div>
        <span className="lesson-counter">{index + 1}/{questions.length}</span>
      </header>

      <QuestionBody
        key={currentQuestion.id}
        question={currentQuestion}
        lessonId={lessonId}
        lessonTitle={lessonTitle}
        token={token ?? ''}
        isLast={index === questions.length - 1}
        onCorrect={handleCorrect}
      />
    </div>
  )
}
