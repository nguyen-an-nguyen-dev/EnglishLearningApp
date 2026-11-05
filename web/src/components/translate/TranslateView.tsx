import { useEffect, useRef, useState } from 'react'
import type { DragEvent, FormEvent, KeyboardEvent } from 'react'
import {
  ArrowsLeftRight,
  ArrowRight,
  CaretLeft,
  CaretRight,
  Check,
  CopySimple,
  FileText,
  TrashSimple,
  UploadSimple,
  X,
} from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import {
  clearTranslationHistoryApi,
  listTranslationHistoryApi,
  translateFileApi,
  translateTextApi,
  type TranslateLanguage,
  type TranslationResult,
} from '../../services/translationService'

const MAX_CHARACTERS = 10_000
const MAX_FILE_BYTES = 20 * 1024
const HISTORY_LIMIT = 10
const HISTORY_PAGE_SIZE = 4
const HISTORY_ROW_MIN_HEIGHT = 44

type TranslateTab = 'text' | 'file'

interface PickedFile {
  name: string
  size: number
  text: string
}

function historyKey(entry: TranslationResult): string {
  return `${entry.fileName ?? ''}|${entry.sourceLanguage}|${entry.targetLanguage}|${entry.originalText}`
}

function dedupeHistory(items: TranslationResult[]): TranslationResult[] {
  const seen = new Set<string>()
  const out: TranslationResult[] = []
  for (const entry of items) {
    const key = historyKey(entry)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(entry)
  }
  return out
}

export function TranslateView() {
  const { t, lang } = useI18n()
  const [tab, setTab] = useState<TranslateTab>('text')
  const [sourceLanguage, setSourceLanguage] = useState<TranslateLanguage>('en')
  const [input, setInput] = useState('')
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null)
  const [result, setResult] = useState<TranslationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<TranslationResult[]>([])
  const [historyPage, setHistoryPage] = useState(0)
  const [historyPageSize, setHistoryPageSize] = useState(HISTORY_PAGE_SIZE)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const historyListRef = useRef<HTMLUListElement | null>(null)
  const clearDialogRef = useRef<HTMLDialogElement | null>(null)

  const targetLanguage: TranslateLanguage = sourceLanguage === 'en' ? 'vi' : 'en'
  const languageName = (code: TranslateLanguage) => (
    code === 'en' ? t.translateLanguageEn : t.translateLanguageVi
  )

  useEffect(() => {
    let active = true
    listTranslationHistoryApi()
      .then((items) => {
        if (active) setHistory(items)
      })
      .catch(() => {
        /* history is optional; the workspace still works without it */
      })
    return () => {
      active = false
    }
  }, [])

  const hasHistory = history.length > 0

  useEffect(() => {
    const node = historyListRef.current
    if (!node) return
    const measure = () => {
      const rows = Math.floor(node.clientHeight / HISTORY_ROW_MIN_HEIGHT)
      setHistoryPageSize(Math.max(1, Math.min(HISTORY_PAGE_SIZE, rows)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasHistory])

  useEffect(() => {
    const dialog = clearDialogRef.current
    if (!dialog) return
    if (clearDialogOpen && !dialog.open) dialog.showModal()
    if (!clearDialogOpen && dialog.open) dialog.close()
  }, [clearDialogOpen])

  useEffect(() => {
    if (!clearDialogOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [clearDialogOpen])

  function remember(entry: TranslationResult) {
    setHistory((current) => [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, HISTORY_LIMIT))
    setHistoryPage(0)
  }

  function restoreHistory(entry: TranslationResult) {
    // Keep the current language direction untouched and only fill in the fields.
    // Map each side by language: if the entry was saved in the opposite direction,
    // its translatedText is the source text now and vice versa.
    const originalIsCurrentSource = entry.sourceLanguage === sourceLanguage
    const inputText = originalIsCurrentSource ? entry.originalText : entry.translatedText
    const resultText = originalIsCurrentSource ? entry.translatedText : entry.originalText
    setTab('text')
    setPickedFile(null)
    setInput(inputText)
    setResult({
      ...entry,
      originalText: inputText,
      translatedText: resultText,
      sourceLanguage,
      targetLanguage,
      wordDetails: originalIsCurrentSource ? entry.wordDetails : null,
    })
    setError(null)
    setCopied(false)
  }

  function openClearDialog() {
    setClearError(null)
    setClearDialogOpen(true)
  }

  async function confirmClearHistory() {
    if (clearing) return
    setClearing(true)
    setClearError(null)
    try {
      await clearTranslationHistoryApi()
      setHistory([])
      setHistoryPage(0)
      setClearDialogOpen(false)
    } catch (value) {
      setClearError(describeError(value, t.translateHistoryClearError))
    } finally {
      setClearing(false)
    }
  }

  function formatHistoryDate(value?: string | Date) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit' })
  }

  function describeError(value: unknown, fallback: string): string {
    if (value instanceof DOMException && (value.name === 'TimeoutError' || value.name === 'AbortError')) {
      return t.translateTimeout
    }
    return value instanceof Error && value.message ? value.message : fallback
  }

  function partOfSpeechLabel(part: string): string {
    switch (part) {
      case 'noun': return t.translatePosNoun
      case 'verb': return t.translatePosVerb
      case 'adjective': return t.translatePosAdjective
      case 'adverb': return t.translatePosAdverb
      case 'pronoun': return t.translatePosPronoun
      case 'preposition': return t.translatePosPreposition
      case 'conjunction': return t.translatePosConjunction
      case 'interjection': return t.translatePosInterjection
      default: return part || t.translatePosOther
    }
  }

  function switchTab(nextTab: TranslateTab) {
    setTab(nextTab)
    setError(null)
  }

  function toggleDirection() {
    setSourceLanguage((current) => (current === 'en' ? 'vi' : 'en'))
    setResult(null)
    setError(null)
  }

  async function acceptFile(file: File) {
    setError(null)
    if (!file.name.toLowerCase().endsWith('.txt')) {
      setError(t.translateFileInvalid)
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(t.translateFileTooLarge)
      return
    }
    try {
      const text = await file.text()
      if (!text.trim()) {
        setError(t.translateFileEmpty)
        return
      }
      setPickedFile({ name: file.name, size: file.size, text })
      setResult(null)
    } catch {
      setError(t.translateFileReadError(file.name))
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void acceptFile(file)
  }

  function handleDropzoneKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    fileInputRef.current?.click()
  }

  async function submitText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!input.trim() || loading) return
    setLoading(true)
    setError(null)
    setCopied(false)
    try {
      const data = await translateTextApi(input, sourceLanguage, targetLanguage)
      setResult(data)
      remember(data)
    } catch (submitError) {
      setError(describeError(submitError, t.translateError))
    } finally {
      setLoading(false)
    }
  }

  async function submitFile() {
    if (!pickedFile || loading) return
    setLoading(true)
    setError(null)
    setCopied(false)
    try {
      const data = await translateFileApi(pickedFile.text, pickedFile.name, sourceLanguage, targetLanguage)
      setResult(data)
      remember(data)
    } catch (submitError) {
      setError(describeError(submitError, t.translateFileError))
    } finally {
      setLoading(false)
    }
  }

  async function copyResult() {
    if (!result?.translatedText) return
    try {
      await navigator.clipboard.writeText(result.translatedText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard API unavailable (non-secure context) */
    }
  }

  const formattedCount = input.length.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')
  const fileSize = pickedFile ? `${Math.max(1, Math.round(pickedFile.size / 1024))} KB` : ''

  const cappedHistory = history.slice(0, HISTORY_LIMIT)
  const uniqueHistory = dedupeHistory(cappedHistory)
  const historyPageCount = Math.max(1, Math.ceil(uniqueHistory.length / historyPageSize))
  const activeHistoryPage = Math.min(historyPage, historyPageCount - 1)
  const pagedHistory = uniqueHistory.slice(
    activeHistoryPage * historyPageSize,
    activeHistoryPage * historyPageSize + historyPageSize,
  )

  return (
    <div
      className="tab-view-container translate-page"
      data-translate-tab={tab}
      data-source-lang={sourceLanguage}
      data-target-lang={targetLanguage}
      data-source-text={tab === 'text' ? input : (pickedFile?.name || '')}
      data-result-text={result?.translatedText || ''}
      data-detected-pos={result?.wordDetails?.partOfSpeech || ''}
      data-detected-meanings={result?.wordDetails?.meaning || ''}
    >
      <div className="translate-desk">
        <aside className="translate-rail">
          <div className="translate-rail-head">
            <span className="translate-kicker">
              <span className="translate-kicker-rule" aria-hidden="true" />
              {t.translateKicker}
            </span>
            <h1>
              {t.translateTitle}
              <em>{t.translateTitleAccent}</em>
            </h1>
            <p>{t.translateDesc}</p>
          </div>

          <div className="translate-pair">
            <div className="translate-pair-side">
              <span className="translate-pair-label">{t.translateSourceLabel}</span>
              <span className="translate-pair-lang">{languageName(sourceLanguage)}</span>
            </div>
            <button
              type="button"
              className="translate-swap"
              onClick={toggleDirection}
              aria-label={t.translateSwap}
              title={t.translateSwap}
            >
              <ArrowsLeftRight size={17} weight="bold" />
            </button>
            <div className="translate-pair-side">
              <span className="translate-pair-label">{t.translateTargetLabel}</span>
              <span className="translate-pair-lang">{languageName(targetLanguage)}</span>
            </div>
          </div>

          <div className="translate-history">
            <div className="translate-history-head">
              <span className="translate-history-title">{t.translateHistory}</span>
              {uniqueHistory.length > 0 && (
                <button type="button" className="translate-history-clear" onClick={openClearDialog}>
                  <TrashSimple size={11} weight="bold" aria-hidden="true" />
                  <span>{t.translateHistoryClear}</span>
                </button>
              )}
            </div>
            {uniqueHistory.length === 0 ? (
              <p className="translate-history-empty">{t.translateHistoryEmpty}</p>
            ) : (
              <>
                <ul className="translate-history-list" ref={historyListRef}>
                  {pagedHistory.map((entry) => (
                    <li key={entry.id ?? `${entry.createdAt}-${entry.originalText.slice(0, 16)}`}>
                      <button
                        type="button"
                        className="translate-history-item"
                        onClick={() => restoreHistory(entry)}
                        title={entry.fileName ?? entry.originalText}
                      >
                        <span className="translate-history-date">{formatHistoryDate(entry.createdAt)}</span>
                        <span className="translate-history-text">
                          {entry.fileName ?? entry.originalText}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {historyPageCount > 1 && (
                  <div className="translate-history-pager">
                    <button
                      type="button"
                      className="translate-history-page"
                      onClick={() => setHistoryPage(activeHistoryPage - 1)}
                      disabled={activeHistoryPage === 0}
                      aria-label={t.translateHistoryPrev}
                      title={t.translateHistoryPrev}
                    >
                      <CaretLeft size={10} weight="bold" />
                    </button>
                    <span className="translate-history-page-label">
                      {activeHistoryPage + 1}/{historyPageCount}
                    </span>
                    <button
                      type="button"
                      className="translate-history-page"
                      onClick={() => setHistoryPage(activeHistoryPage + 1)}
                      disabled={activeHistoryPage >= historyPageCount - 1}
                      aria-label={t.translateHistoryNext}
                      title={t.translateHistoryNext}
                    >
                      <CaretRight size={10} weight="bold" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="translate-rail-foot">
            <ul className="translate-facts">
              <li>{t.translateShortcut}</li>
            </ul>
            {loading && (
              <div className="translate-status is-busy" role="status">
                <span className="translate-status-dot" aria-hidden="true" />
                <span>{t.translateWorking}</span>
              </div>
            )}
          </div>
        </aside>

        <section className="translate-sheet" aria-label={t.translateKicker}>
          <div className="translate-toolbar">
            <div className="translate-tabs" role="tablist">
              {(['text', 'file'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={`translate-tab${tab === id ? ' is-active' : ''}`}
                  onClick={() => switchTab(id)}
                >
                  {id === 'text' ? t.translateTabText : t.translateTabFile}
                </button>
              ))}
            </div>
            <span className="translate-counter">
              {tab === 'text' ? `${formattedCount} / 10.000` : fileSize}
            </span>
          </div>

          <div className="translate-sheet-body">
            <div className="translate-block is-source">
              <div className="translate-block-head">
                <span className="translate-block-index" aria-hidden="true">01</span>
                <span className="translate-block-label">
                  {tab === 'text' ? t.translateTabText : t.translateTabFile}
                </span>
                <span className="translate-block-rule" aria-hidden="true" />
              </div>

              {tab === 'text' ? (
                <form className="translate-form" onSubmit={(event) => void submitText(event)}>
                  <textarea
                    className="translate-textarea"
                    value={input}
                    maxLength={MAX_CHARACTERS}
                    onChange={(event) => {
                      setInput(event.target.value)
                      setResult(null)
                    }}
                    onKeyDown={(event) => {
                      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                        event.preventDefault()
                        event.currentTarget.form?.requestSubmit()
                      }
                    }}
                    placeholder={sourceLanguage === 'en' ? t.translatePlaceholderEn : t.translatePlaceholderVi}
                    aria-label={sourceLanguage === 'en' ? t.translatePlaceholderEn : t.translatePlaceholderVi}
                  />
                  <div className="translate-form-foot">
                    <p className="translate-hint">
                      <kbd>Ctrl</kbd>
                      <span aria-hidden="true">+</span>
                      <kbd>Enter</kbd>
                    </p>
                    <button type="submit" className="translate-cta" disabled={!input.trim() || loading}>
                      <span>{t.translateTextAction}</span>
                      <ArrowRight size={16} weight="bold" />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="translate-form">
                  <div
                    className={`translate-dropzone${dragging ? ' is-dragging' : ''}${pickedFile ? ' has-file' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={t.translateChooseFile}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={handleDropzoneKey}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setDragging(true)
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      className="translate-file-input"
                      type="file"
                      accept=".txt,text/plain"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (file) void acceptFile(file)
                      }}
                    />
                    <FileText className="translate-dropzone-icon" size={28} weight="light" aria-hidden="true" />
                    <strong>{pickedFile?.name ?? t.translateChooseFile}</strong>
                    {pickedFile && <small>{fileSize}</small>}
                    {pickedFile && (
                      <button
                        type="button"
                        className="translate-file-clear"
                        aria-label={t.translateRemoveFile}
                        title={t.translateRemoveFile}
                        onClick={(event) => {
                          event.stopPropagation()
                          setPickedFile(null)
                          setResult(null)
                          setError(null)
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="translate-form-foot">
                    {pickedFile && <p className="translate-hint">{t.translateFileLong}</p>}
                    <button
                      type="button"
                      className="translate-cta"
                      disabled={!pickedFile || loading}
                      onClick={() => void submitFile()}
                    >
                      <span>{t.translateFileAction}</span>
                      <UploadSimple size={16} weight="bold" />
                    </button>
                  </div>
                </div>
              )}

              {error && <div className="translate-error" role="alert">{error}</div>}
            </div>

            <div className="translate-block is-result" aria-live="polite">
              <div className="translate-block-head">
                <span className="translate-block-index" aria-hidden="true">02</span>
                <span className="translate-block-label">{t.translateResultLabel}</span>
                <span className="translate-block-rule" aria-hidden="true" />
                <button
                  type="button"
                  className={`translate-copy-btn${copied ? ' is-copied' : ''}`}
                  onClick={() => void copyResult()}
                  disabled={!result}
                  aria-label={copied ? t.translateCopied : t.translateCopy}
                  title={copied ? t.translateCopied : t.translateCopy}
                >
                  {copied ? <Check size={14} weight="bold" /> : <CopySimple size={14} weight="bold" />}
                  <span>{copied ? t.translateCopied : t.translateCopy}</span>
                </button>
              </div>

              <div className="translate-result-body">
                {loading ? (
                  <div className="translate-loading" role="status" aria-label={t.translateWorking}>
                    <span className="translate-loading-label">{t.translateWorking}</span>
                    <div className="translate-skeleton" aria-hidden="true">
                      <span className="translate-skeleton-line is-wide" />
                      <span className="translate-skeleton-line" />
                      <span className="translate-skeleton-line" />
                      <span className="translate-skeleton-line is-short" />
                    </div>
                  </div>
                ) : result ? (
                  <>
                    <div className="translate-result-text">{result.translatedText}</div>

                    {result.fileName && (
                      <details className="translate-source">
                        <summary>
                          <FileText size={13} />
                          <span className="translate-source-name">{result.fileName}</span>
                          <span className="translate-source-label">{t.translateOriginalLabel}</span>
                        </summary>
                        <p>{result.originalText}</p>
                      </details>
                    )}

                    {result.wordDetails && (
                      <aside className="translate-note">
                        <div className="translate-note-head">
                          <strong>{result.wordDetails.word}</strong>
                          {result.wordDetails.phonetic && <em>/{result.wordDetails.phonetic}/</em>}
                          <span className="translate-pos">{partOfSpeechLabel(result.wordDetails.partOfSpeech)}</span>
                        </div>
                        <p className="translate-meaning">{result.wordDetails.meaning}</p>
                        {result.wordDetails.example && (
                          <p className="translate-example">“{result.wordDetails.example}”</p>
                        )}
                      </aside>
                    )}
                  </>
                ) : (
                  <div className="translate-empty">
                    <strong>{t.translateEmptyTitle}</strong>
                    <p>{t.translateEmptyDesc}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <dialog
        ref={clearDialogRef}
        className="translate-clear-dialog"
        aria-labelledby="translate-clear-title"
        aria-describedby="translate-clear-desc"
        onClose={() => setClearDialogOpen(false)}
        onCancel={(event) => {
          if (clearing) event.preventDefault()
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !clearing) clearDialogRef.current?.close()
        }}
      >
        <div className="translate-clear-panel">
          <span className="translate-clear-kicker">{t.translateHistory}</span>
          <h2 id="translate-clear-title" className="translate-clear-title">
            {t.translateHistoryClearTitle}
          </h2>
          <p id="translate-clear-desc" className="translate-clear-desc">
            {t.translateHistoryClearDesc}
          </p>
          {clearError && (
            <p className="translate-clear-error" role="alert">{clearError}</p>
          )}
          <div className="translate-clear-actions">
            <button
              type="button"
              className="translate-clear-cancel"
              onClick={() => clearDialogRef.current?.close()}
              disabled={clearing}
              autoFocus
            >
              {t.translateHistoryClearCancel}
            </button>
            <button
              type="button"
              className="translate-clear-confirm"
              onClick={() => void confirmClearHistory()}
              disabled={clearing}
            >
              <TrashSimple size={14} weight="bold" aria-hidden="true" />
              <span>{clearing ? t.translateHistoryClearWorking : t.translateHistoryClearConfirm}</span>
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
