import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CheckCircle, Lightbulb, Question, XCircle } from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import { answerReviewItemApi } from '../../services/analyticsService'
import type { ReviewAnswerResult, ReviewItem } from '../../types/analytics'
import { copyFor, type ReviewCopy } from './copy'

interface ReviewSessionProps {
  items: ReviewItem[]
  onClose: () => void
}

function formatInterval(copy: ReviewCopy, days: number): string {
  if (days <= 0) return copy.dueNow
  return copy.inDays(Math.max(1, days))
}

interface ReviewCardProps {
  item: ReviewItem
  index: number
  total: number
  onGraded: (correct: boolean) => void
  onNext: () => void
}

/**
 * One card of the session. It is mounted per item (keyed by the item id), so
 * every piece of state — the typed answer, the picked option, the verdict —
 * belongs to that item and resets by unmounting, not by an effect.
 */
function ReviewCard({ item, index, total, onGraded, onNext }: ReviewCardProps) {
  const { lang } = useI18n()
  const copy = copyFor(lang)
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<ReviewAnswerResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startedAtRef = useRef(0)

  // The clock starts when the card appears. A ref, not state: reading it must
  // not re-render, and `Date.now()` in an effect keeps render pure.
  useEffect(() => {
    startedAtRef.current = Date.now()
  }, [])

  const isWord = item.kind === 'word'
  const answer = isWord ? input.trim() : selected ?? ''
  const ready = answer.length > 0

  const options = useMemo(() => {
    if (!item.question) return []
    // Deterministic shuffle: the same item always presents options in the same
    // order, so re-entering a session does not feel like a different question.
    const list = [...item.question.answers]
    let seed = item.id * 2654435761
    for (let i = list.length - 1; i > 0; i -= 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      const j = seed % (i + 1)
      ;[list[i], list[j]] = [list[j], list[i]]
    }
    return list
  }, [item])

  async function check() {
    if (!ready || checking) return
    setChecking(true)
    setError(null)
    try {
      const response = await answerReviewItemApi(item.id, answer, Date.now() - startedAtRef.current)
      setResult(response)
      setChecked(true)
      onGraded(response.is_correct)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : copy.error)
    } finally {
      setChecking(false)
    }
  }

  const isCorrect = result?.is_correct === true
  const optionState = (text: string): string => {
    if (!checked || !result) return selected === text ? ' is-selected' : ''
    if (text === result.correct_answer) return ' is-correct'
    if (text === answer && !isCorrect) return ' is-wrong'
    return ''
  }

  return (
    <div className="review-card">
      <span className="review-card-kicker">
        {isWord ? <Lightbulb size={14} weight="fill" /> : <Question size={14} weight="fill" />}
        {isWord ? copy.sessionRecallWord : copy.sessionRecallQuestion}
      </span>

      {isWord && item.word && (
        <>
          <h1>{item.word.translation}</h1>
          <div className="review-word-hint">
            <span className="review-chip">{item.word.part_of_speech}</span>
            <span className="review-chip">{item.word.cefr_level}</span>
            {item.word.ipa && <span className="review-chip">{item.word.ipa}</span>}
            {item.word.example_vi && <span className="review-chip">{item.word.example_vi}</span>}
          </div>
          <p className="review-card-sub">{copy.sessionRecallWordHint}</p>
        </>
      )}

      {!isWord && item.question && (
        <>
          <h1>{item.question.prompt}</h1>
          <p className="review-card-sub">{item.question.lesson_title} · {copy.sessionRecallQuestionHint}</p>
          <div className="review-options">
            {options.map((option, optionIndex) => (
              <button
                key={option.id}
                type="button"
                className={`review-option${optionState(option.answer_text)}`}
                disabled={checked}
                onClick={() => setSelected(option.answer_text)}
              >
                <span className="review-option-letter">{String.fromCharCode(65 + optionIndex)}</span>
                <span>{option.answer_text}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {isWord && (
        <input
          className="review-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            if (checked) onNext()
            else void check()
          }}
          placeholder={copy.sessionTypedPlaceholder}
          disabled={checked}
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
      )}

      {checked && result && (
        <div className={`review-feedback ${isCorrect ? 'is-correct' : 'is-wrong'}`}>
          <strong>
            {isCorrect ? <CheckCircle size={15} weight="fill" /> : <XCircle size={15} weight="fill" />}
            {' '}
            {isCorrect ? copy.sessionCorrect : copy.sessionWrong}
          </strong>
          {!isCorrect && <span>{copy.sessionAnswerWas(result.correct_answer)}</span>}
          {result.explanation && <small>{result.explanation}</small>}
          <small>{formatInterval(copy, result.interval_days)}</small>
        </div>
      )}

      {error && <p className="review-feedback is-wrong">{error}</p>}

      <div className="review-session-footer">
        {!checked ? (
          <button type="button" className="review-cta" onClick={() => void check()} disabled={!ready || checking}>
            {checking ? copy.sessionChecking : copy.sessionCheck}
            {!checking && <ArrowRight size={15} weight="bold" />}
          </button>
        ) : (
          <button type="button" className="review-cta" onClick={onNext}>
            {index + 1 >= total ? copy.sessionFinish : copy.sessionNext}
            <ArrowRight size={15} weight="bold" />
          </button>
        )}
      </div>
    </div>
  )
}

export function ReviewSession({ items, onClose }: ReviewSessionProps) {
  const { lang } = useI18n()
  const copy = copyFor(lang)
  const [index, setIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [done, setDone] = useState(false)
  const total = items.length

  if (done) {
    return (
      <div className="review-session" role="dialog" aria-modal="true" aria-label={copy.sessionTitle}>
        <header className="review-session-head">
          <button type="button" className="review-session-close" onClick={onClose}>{copy.sessionClose}</button>
          <span />
          <span className="review-session-counter">{total}/{total}</span>
        </header>
        <div className="review-session-body">
          <div className="review-card">
            <span className="review-card-kicker"><CheckCircle size={14} weight="fill" />{copy.sessionDone}</span>
            <h1>{copy.sessionSummary(correctCount, total)}</h1>
            <p className="review-card-sub">{copy.sessionDoneBody}</p>
            <div className="review-session-footer">
              <button type="button" className="review-cta" onClick={onClose}>
                {copy.sessionAgain}
                <ArrowRight size={15} weight="bold" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const item = items[index]

  function next() {
    if (index + 1 >= total) {
      setDone(true)
      return
    }
    setIndex((current) => current + 1)
  }

  return (
    <div className="review-session" role="dialog" aria-modal="true" aria-label={copy.sessionTitle}>
      <header className="review-session-head">
        <button type="button" className="review-session-close" onClick={onClose}>{copy.sessionClose}</button>
        <div
          className="review-session-progress"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index + 1}
        >
          <span style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
        <span className="review-session-counter">{index + 1}/{total}</span>
      </header>

      <div className="review-session-body">
        <ReviewCard
          key={item.id}
          item={item}
          index={index}
          total={total}
          onGraded={(correct) => {
            if (correct) setCorrectCount((count) => count + 1)
          }}
          onNext={next}
        />
      </div>
    </div>
  )
}
