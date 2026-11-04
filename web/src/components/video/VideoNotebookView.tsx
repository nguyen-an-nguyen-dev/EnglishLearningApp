import { useMemo, useState } from 'react'
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Check,
  Eye,
  SpeakerHigh,
  Sparkle,
  Trash,
  Trophy,
} from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import { deleteSavedWordApi } from '../../services/videoService'
import type { SavedWord } from '../../types/video'
import { speakEnglish } from '../../utils/speech'

interface VideoNotebookViewProps {
  words: SavedWord[]
  onBack: () => void
  onWordsChange: (words: SavedWord[]) => void
}

type NotebookMode = 'list' | 'review'

function shuffleWords(words: SavedWord[]): SavedWord[] {
  const deck = [...words]
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const current = deck[index]
    deck[index] = deck[swap]
    deck[swap] = current
  }
  return deck
}

export function VideoNotebookView({ words, onBack, onWordsChange }: VideoNotebookViewProps) {
  const { t } = useI18n()
  const [mode, setMode] = useState<NotebookMode>('list')
  const [deck, setDeck] = useState<SavedWord[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [results, setResults] = useState<boolean[]>([])
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const total = words.length
  const withMeaning = useMemo(() => words.filter((word) => Boolean(word.meaning_vi)).length, [words])
  const current = deck[index]
  const remembered = results.filter(Boolean).length
  const missed = deck.filter((_, position) => results[position] === false)

  async function removeWord(word: SavedWord) {
    setRemoving(word.word)
    setError(null)
    try {
      await deleteSavedWordApi(word.word)
      onWordsChange(words.filter((entry) => entry.id !== word.id))
    } catch {
      setError(t.videoNotebookRemoveError)
    } finally {
      setRemoving(null)
    }
  }

  function startReview(selection: SavedWord[] = words) {
    if (selection.length === 0) return
    setDeck(shuffleWords(selection))
    setIndex(0)
    setRevealed(false)
    setResults([])
    setError(null)
    setMode('review')
  }

  function finishCard(rememberedCard: boolean) {
    setResults((previous) => [...previous, rememberedCard])
    setIndex((previous) => previous + 1)
    setRevealed(false)
  }

  if (mode === 'review' && deck.length > 0) {
    const done = index >= deck.length

    if (done) {
      return (
        <div className="tab-view-container notebook-page">
          <div className="video-detail-top">
            <button type="button" className="video-back-btn" onClick={() => setMode('list')}>
              <ArrowLeft size={19} />
              <span>{t.videoNotebookBackToList}</span>
            </button>
            <span className="video-chip is-owned">
              <BookOpenText size={13} /> {deck.length}
            </span>
          </div>

          <section className="notebook-result">
            <span className="notebook-result-star is-a" aria-hidden="true">*</span>
            <span className="notebook-result-star is-b" aria-hidden="true">*</span>
            <span className="notebook-result-icon" aria-hidden="true"><Trophy size={52} weight="regular" /></span>
            <span className="notebook-eyebrow">{t.videoNotebookPracticeEyebrow}</span>
            <h2>{t.videoNotebookResultTitle}</h2>
            <p>{t.videoNotebookResultDesc(remembered, deck.length)}</p>
            <div className="notebook-result-stats">
              <div>
                <strong>{remembered}</strong>
                <span>{t.videoNotebookRemembered}</span>
              </div>
              <div>
                <strong>{deck.length - remembered}</strong>
                <span>{t.videoNotebookForgot}</span>
              </div>
            </div>
            <div className="notebook-result-actions">
              {missed.length > 0 && (
                <button type="button" className="notebook-solid-btn" onClick={() => startReview(missed)}>
                  <ArrowClockwise size={16} weight="bold" />
                  <span>{t.videoNotebookRetryMissed(missed.length)}</span>
                </button>
              )}
              <button type="button" className="notebook-ghost-btn" onClick={() => startReview(words)}>
                <Sparkle size={15} weight="fill" />
                <span>{t.videoNotebookRestart}</span>
              </button>
              <button type="button" className="notebook-ghost-btn" onClick={() => setMode('list')}>
                <span>{t.videoNotebookBackToList}</span>
              </button>
            </div>
          </section>
        </div>
      )
    }

    const progress = Math.round((index / deck.length) * 100)
    return (
      <div className="tab-view-container notebook-page">
        <div className="video-detail-top">
          <button type="button" className="video-back-btn" onClick={() => setMode('list')}>
            <ArrowLeft size={19} />
            <span>{t.videoNotebookBackToList}</span>
          </button>
          <span className="notebook-review-count">{index + 1} / {deck.length}</span>
        </div>

        <div className="notebook-review-meter" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        <section className="notebook-review">
          <span className="notebook-eyebrow">{t.videoNotebookPracticeEyebrow}</span>
          <div className="notebook-review-word">
            <h2>{current.word}</h2>
            <button
              type="button"
              className="notebook-speak-btn"
              onClick={() => speakEnglish(current.word)}
              aria-label={t.videoSpeakWord(current.word)}
            >
              <SpeakerHigh size={20} weight="regular" />
            </button>
          </div>
          {current.ipa && <span className="notebook-review-ipa">{current.ipa}</span>}

          {revealed ? (
            <div className="notebook-review-answer">
              <span>{t.videoNotebookMeaningLabel}</span>
              <strong>{current.meaning_vi || t.videoNotebookNoMeaning}</strong>
              {current.detail_vi && <small>{current.detail_vi}</small>}
            </div>
          ) : (
            <div className="notebook-review-mask">
              <span aria-hidden="true">* * *</span>
              <p>{t.videoNotebookPracticeHint}</p>
              <button type="button" className="notebook-reveal-btn" onClick={() => setRevealed(true)}>
                <Eye size={17} weight="regular" />
                <span>{t.videoNotebookReveal}</span>
              </button>
            </div>
          )}

          <div className="notebook-review-actions">
            {revealed ? (
              <>
                <button type="button" className="notebook-rate-btn is-again" onClick={() => finishCard(false)}>
                  <ArrowClockwise size={16} weight="bold" />
                  <span>{t.videoNotebookForgot}</span>
                </button>
                <button type="button" className="notebook-rate-btn is-known" onClick={() => finishCard(true)}>
                  <Check size={17} weight="bold" />
                  <span>{t.videoNotebookRemembered}</span>
                </button>
              </>
            ) : (
              <button type="button" className="notebook-skip-btn" onClick={() => finishCard(false)}>
                <span>{t.videoNotebookSkip}</span>
                <ArrowRight size={15} weight="bold" />
              </button>
            )}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="tab-view-container notebook-page">
      <div className="video-detail-top">
        <button type="button" className="video-back-btn" onClick={onBack}>
          <ArrowLeft size={19} />
          <span>{t.videoNotebookBack}</span>
        </button>
        {total > 0 && (
          <span className="video-chip is-owned">
            <BookOpenText size={13} /> {total}
          </span>
        )}
      </div>

      <section className="notebook-hero">
        <div className="notebook-hero-copy">
          <span className="notebook-eyebrow">{t.videoNotebookEyebrow}</span>
          <h1>{t.videoNotebookTitle}</h1>
          <p>{t.videoNotebookDesc}</p>
          <div className="notebook-hero-stats">
            <span><BookOpenText size={14} weight="bold" /> {t.videoNotebookCount(total)}</span>
            <span><Check size={14} weight="bold" /> {t.videoNotebookWithMeaning(withMeaning)}</span>
          </div>
        </div>
        <div className="notebook-hero-action">
          <span className="notebook-hero-mark" aria-hidden="true">
            <strong>{String(total).padStart(2, '0')}</strong>
            <small>{t.videoNotebookWordsUnit}</small>
          </span>
          <button
            type="button"
            className="notebook-practice-btn"
            onClick={() => startReview(words)}
            disabled={total === 0}
          >
            <Sparkle size={17} weight="fill" />
            <span>{t.videoNotebookPractice}</span>
            <ArrowRight size={17} weight="bold" />
          </button>
          <small className="notebook-hero-note">{t.videoNotebookPracticeHintList}</small>
        </div>
      </section>

      {error && <p className="video-import-error" role="alert">{error}</p>}

      {total === 0 ? (
        <div className="notebook-empty">
          <span className="notebook-empty-icon"><BookOpenText size={40} weight="regular" /></span>
          <p>{t.videoNotebookEmpty}</p>
          <small>{t.videoNoSavedWords}</small>
        </div>
      ) : (
        <div className="video-notebook-grid">
          {words.map((word, position) => (
            <article className="video-notebook-card" key={word.id}>
              <span className="notebook-card-index" aria-hidden="true">
                {String(position + 1).padStart(2, '0')}
              </span>
              <div className="video-notebook-head">
                <div>
                  <strong>{word.word}</strong>
                  {word.ipa && <span>{word.ipa}</span>}
                </div>
                <div className="video-notebook-actions">
                  <button
                    type="button"
                    className="video-speak-btn"
                    onClick={() => speakEnglish(word.word)}
                    aria-label={t.videoSpeakWord(word.word)}
                  >
                    <SpeakerHigh size={19} weight="regular" />
                  </button>
                  <button
                    type="button"
                    className="video-notebook-remove"
                    onClick={() => void removeWord(word)}
                    disabled={removing === word.word}
                    aria-label={t.videoRemoveWord(word.word)}
                  >
                    <Trash size={18} weight="regular" />
                  </button>
                </div>
              </div>
              <p>{word.meaning_vi || t.videoNotebookNoMeaning}</p>
              {word.detail_vi && <small>{word.detail_vi}</small>}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
