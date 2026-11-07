import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowClockwise,
  Books,
  CaretDown,
  CaretUp,
  CheckCircle,
  Flag,
  HandPointing,
  ListChecks,
  PencilSimple,
  Plus,
  Question,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import { useLearning } from '../../context/LearningContext'
import {
  createLessonApi,
  createQuestionApi,
  createStageApi,
  deleteLessonApi,
  deleteQuestionApi,
  deleteStageApi,
  getAdminContentApi,
  getAdminLessonQuestionsApi,
  moveLessonApi,
  moveQuestionApi,
  moveStageApi,
  updateLessonApi,
  updateQuestionApi,
  updateStageApi,
} from '../../services/adminService'
import type {
  AdminDifficulty,
  AdminQuestion,
  AdminQuestionType,
  AdminStage,
  AdminStageTheme,
} from '../../types/admin'
import { DIFFICULTIES, QUESTION_TYPES, STAGE_THEME_KEYS } from '../../types/admin'
import { STAGE_VISUALS, type StageThemeKey } from '../../roadmap'
import {
  answerCountFor,
  buildQuestionPayload,
  emptyAnswer,
  emptyQuestionDraft,
  questionDraftFrom,
  setCorrectAnswer,
  validateQuestionDraft,
  withQuestionType,
  type QuestionDraft,
} from '../../utils/adminForm'
import { AdminDialog } from './AdminDialog'
import { AdminSkeleton } from './AdminSkeleton'

type StageDraft = {
  mode: 'create' | 'edit'
  id?: number
  title: string
  description: string
  themeKey: AdminStageTheme
}

type LessonDraft = {
  mode: 'create' | 'edit'
  id?: number
  stageId: number | null
  title: string
  topic: string
}

type QuestionDraftState = {
  mode: 'create' | 'edit'
  id?: number
  draft: QuestionDraft
}

const THEME_LABELS: Record<AdminStageTheme, string> = {
  forest: 'Forest',
  river: 'River',
  autumn: 'Autumn',
  alpine: 'Alpine',
  coast: 'Coast',
  sakura: 'Sakura',
}

function isStageTheme(value: string): value is AdminStageTheme {
  return (STAGE_THEME_KEYS as readonly string[]).includes(value)
}

export function AdminLessonsPanel() {
  const { t } = useI18n()
  const { refresh } = useLearning()

  const [stages, setStages] = useState<AdminStage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [stageId, setStageId] = useState<number | null>(null)
  const [lessonId, setLessonId] = useState<number | null>(null)

  const [questionData, setQuestionData] = useState<{ lessonId: number; questions: AdminQuestion[] } | null>(null)
  const [questionFailure, setQuestionFailure] = useState<{ lessonId: number; message: string } | null>(null)
  const [questionReloadKey, setQuestionReloadKey] = useState(0)

  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const [stageDraft, setStageDraft] = useState<StageDraft | null>(null)
  const [lessonDraft, setLessonDraft] = useState<LessonDraft | null>(null)
  const [questionDraft, setQuestionDraft] = useState<QuestionDraftState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getAdminContentApi()
      .then((loaded) => {
        if (cancelled) return
        setStages(loaded)
        setLoading(false)
        setLoadError(null)
        setStageId((current) => current ?? loaded[0]?.id ?? null)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : t.adminLoadError)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [reloadKey, t.adminLoadError])

  const selectedStage = useMemo(
    () => stages.find((stage) => stage.id === stageId) ?? stages[0] ?? null,
    [stages, stageId],
  )

  const selectedLesson = useMemo(
    () => selectedStage?.lessons.find((lesson) => lesson.id === lessonId) ?? null,
    [selectedStage, lessonId],
  )

  const selectedLessonId = selectedLesson?.id ?? null

  // Only state writes happen inside the promise callbacks, so switching lessons
  // never triggers a synchronous re-render cascade.
  useEffect(() => {
    if (selectedLessonId === null) return
    let cancelled = false
    getAdminLessonQuestionsApi(selectedLessonId)
      .then((loaded) => {
        if (cancelled) return
        setQuestionData({ lessonId: selectedLessonId, questions: loaded })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setQuestionFailure({
          lessonId: selectedLessonId,
          message: error instanceof Error ? error.message : t.adminLoadError,
        })
      })
    return () => { cancelled = true }
  }, [selectedLessonId, questionReloadKey, t.adminLoadError])

  const questions = questionData?.lessonId === selectedLessonId ? questionData.questions : []
  const questionsError = questionFailure?.lessonId === selectedLessonId ? questionFailure.message : null
  const questionsLoading = selectedLessonId !== null && !questionsError
    && questionData?.lessonId !== selectedLessonId

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5_000)
    return () => window.clearTimeout(timer)
  }, [notice])

  function reloadContent() {
    setLoading(true)
    setReloadKey((key) => key + 1)
    refresh()
  }

  function reloadQuestions() {
    setQuestionData(null)
    setQuestionFailure(null)
    setQuestionReloadKey((key) => key + 1)
  }

  function reportError(error: unknown) {
    setNotice({ tone: 'error', text: error instanceof Error ? error.message : t.adminSaveError })
  }

  // ─── Stages ────────────────────────────────────────────────────────────────

  function openCreateStage() {
    setFormError(null)
    const currentTheme = selectedStage && isStageTheme(selectedStage.theme_key)
      ? selectedStage.theme_key
      : 'river'
    setStageDraft({
      mode: 'create',
      title: '',
      description: '',
      themeKey: currentTheme,
    })
  }

  function openEditStage(stage: AdminStage) {
    setFormError(null)
    setStageDraft({
      mode: 'edit',
      id: stage.id,
      title: stage.title,
      description: stage.description ?? '',
      themeKey: isStageTheme(stage.theme_key) ? stage.theme_key : 'river',
    })
  }

  async function submitStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!stageDraft || busy) return
    if (!stageDraft.title.trim()) {
      setFormError(t.adminRequired)
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      if (stageDraft.mode === 'create') {
        const created = await createStageApi({
          title: stageDraft.title.trim(),
          description: stageDraft.description.trim(),
          theme_key: stageDraft.themeKey,
        })
        setStageId(created.id)
        setLessonId(null)
        setNotice({ tone: 'ok', text: t.adminStageSaved })
      } else if (stageDraft.id) {
        await updateStageApi(stageDraft.id, {
          title: stageDraft.title.trim(),
          description: stageDraft.description.trim(),
          theme_key: stageDraft.themeKey,
        })
        setNotice({ tone: 'ok', text: t.adminStageSaved })
      }
      setStageDraft(null)
      reloadContent()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t.adminSaveError)
    } finally {
      setBusy(false)
    }
  }

  async function removeStage(stage: AdminStage) {
    if (!window.confirm(t.adminDeleteStageConfirm(stage.title))) return
    setBusy(true)
    try {
      await deleteStageApi(stage.id)
      if (stageId === stage.id) {
        setStageId(null)
        setLessonId(null)
      }
      setNotice({ tone: 'ok', text: t.adminStageDeleted(stage.title) })
      reloadContent()
    } catch (error) {
      const message = error instanceof Error ? error.message : t.adminSaveError
      setNotice({
        tone: 'error',
        text: stage.lessons.length > 0 ? t.adminStageNotEmpty : message,
      })
    } finally {
      setBusy(false)
    }
  }

  async function moveStage(stage: AdminStage, direction: 'up' | 'down') {
    setBusy(true)
    try {
      await moveStageApi(stage.id, direction)
      reloadContent()
    } catch (error) {
      reportError(error)
    } finally {
      setBusy(false)
    }
  }

  // ─── Lessons ───────────────────────────────────────────────────────────────

  function openCreateLesson() {
    if (!selectedStage) {
      setNotice({ tone: 'error', text: t.adminStageEmpty })
      return
    }
    setFormError(null)
    setLessonDraft({ mode: 'create', stageId: selectedStage.id, title: '', topic: '' })
  }

  function openEditLesson(lessonId: number, title: string, topic: string) {
    setFormError(null)
    setLessonDraft({
      mode: 'edit',
      id: lessonId,
      stageId: selectedStage?.id ?? null,
      title,
      topic,
    })
  }

  async function submitLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!lessonDraft || busy) return
    const title = lessonDraft.title.trim()
    const topic = lessonDraft.topic.trim()
    if (!title || !topic) {
      setFormError(t.adminRequired)
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      if (lessonDraft.mode === 'create') {
        if (!lessonDraft.stageId) {
          setFormError(t.adminRequired)
          return
        }
        const created = await createLessonApi({ stage_id: lessonDraft.stageId, title, topic })
        setStageId(created.stage_id)
        setLessonId(created.id)
        setNotice({ tone: 'ok', text: t.adminLessonSaved })
      } else if (lessonDraft.id) {
        await updateLessonApi(lessonDraft.id, { title, topic })
        setNotice({ tone: 'ok', text: t.adminLessonSaved })
      }
      setLessonDraft(null)
      reloadContent()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t.adminSaveError)
    } finally {
      setBusy(false)
    }
  }

  async function removeLesson(id: number, title: string) {
    if (!window.confirm(t.adminDeleteLessonConfirm(title))) return
    setBusy(true)
    try {
      await deleteLessonApi(id)
      if (lessonId === id) setLessonId(null)
      setNotice({ tone: 'ok', text: t.adminLessonDeleted(title) })
      reloadContent()
    } catch (error) {
      reportError(error)
    } finally {
      setBusy(false)
    }
  }

  async function moveLesson(id: number, direction: 'up' | 'down') {
    setBusy(true)
    try {
      await moveLessonApi(id, direction)
      reloadContent()
    } catch (error) {
      reportError(error)
    } finally {
      setBusy(false)
    }
  }

  // ─── Questions ─────────────────────────────────────────────────────────────

  function openCreateQuestion() {
    if (!selectedLesson) {
      setNotice({ tone: 'error', text: t.adminSelectLesson })
      return
    }
    setFormError(null)
    setQuestionDraft({ mode: 'create', draft: emptyQuestionDraft('multiple_choice') })
  }

  function openEditQuestion(question: AdminQuestion) {
    setFormError(null)
    setQuestionDraft({ mode: 'edit', id: question.id, draft: questionDraftFrom(question) })
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!questionDraft || busy) return
    const issue = validateQuestionDraft(questionDraft.draft)
    if (issue === 'required') {
      setFormError(t.adminRequired)
      return
    }
    if (issue === 'audio') {
      setFormError(t.adminAudioRequired)
      return
    }
    if (issue === 'answers') {
      setFormError(t.adminAnswersInvalid)
      return
    }

    setBusy(true)
    setFormError(null)
    try {
      const payload = buildQuestionPayload(questionDraft.draft)
      if (questionDraft.mode === 'create') {
        if (!selectedLesson) {
          setFormError(t.adminSelectLesson)
          return
        }
        await createQuestionApi(selectedLesson.id, payload)
      } else if (questionDraft.id) {
        await updateQuestionApi(questionDraft.id, payload)
      }
      setQuestionDraft(null)
      setNotice({ tone: 'ok', text: t.adminQuestionSaved })
      reloadQuestions()
      reloadContent()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t.adminSaveError)
    } finally {
      setBusy(false)
    }
  }

  async function removeQuestion(question: AdminQuestion) {
    if (!window.confirm(t.adminDeleteQuestionConfirm)) return
    setBusy(true)
    try {
      await deleteQuestionApi(question.id)
      setNotice({ tone: 'ok', text: t.adminQuestionDeleted })
      reloadQuestions()
      reloadContent()
    } catch (error) {
      reportError(error)
    } finally {
      setBusy(false)
    }
  }

  async function moveQuestion(question: AdminQuestion, direction: 'up' | 'down') {
    setBusy(true)
    try {
      await moveQuestionApi(question.id, direction)
      reloadQuestions()
    } catch (error) {
      reportError(error)
    } finally {
      setBusy(false)
    }
  }

  // ─── Labels ────────────────────────────────────────────────────────────────

  const questionTypeLabels: Record<AdminQuestionType, string> = {
    multiple_choice: t.adminQuestionTypeMultiple,
    fill_choice: t.adminQuestionTypeFill,
    listen_choice: t.adminQuestionTypeListen,
    word_order: t.adminQuestionTypeWordOrder,
    listening: t.adminQuestionTypeListening,
  }

  const difficultyLabels: Record<AdminDifficulty, string> = {
    beginner: t.adminDifficultyBeginner,
    intermediate: t.adminDifficultyIntermediate,
    advanced: t.adminDifficultyAdvanced,
  }

  function stageThemeOf(stage: AdminStage): StageThemeKey {
    return isStageTheme(stage.theme_key) ? stage.theme_key : 'river'
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="admin-panel">
        <div className="admin-columns" aria-busy="true">
          <section className="admin-column">
            <header className="admin-column-head">
              <h3 className="admin-column-label">{t.adminStageColumn}</h3>
            </header>
            <div className="admin-column-body"><AdminSkeleton rows={4} /></div>
          </section>
          <section className="admin-column">
            <header className="admin-column-head">
              <h3 className="admin-column-label">{t.adminLessonColumn}</h3>
            </header>
            <div className="admin-column-body"><AdminSkeleton rows={4} /></div>
          </section>
          <section className="admin-column">
            <header className="admin-column-head">
              <h3 className="admin-column-label">{t.adminQuestionColumn}</h3>
            </header>
            <div className="admin-column-body"><AdminSkeleton rows={5} /></div>
          </section>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="video-state-card">
        <p>{loadError}</p>
        <button type="button" className="video-ghost-btn" onClick={reloadContent}>
          <ArrowClockwise size={16} />
          <span>{t.retry}</span>
        </button>
      </div>
    )
  }

  return (
    <section className="admin-panel" aria-label={t.adminTabLessons}>
      {notice && (
        <div className={`video-toast is-${notice.tone}`} role="status">
          {notice.tone === 'ok' ? <CheckCircle size={16} weight="fill" /> : <WarningCircle size={16} weight="fill" />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={t.close}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="admin-columns">
        {/* Chặng */}
        <section className="admin-column" aria-label={t.adminStageColumn}>
          <header className="admin-column-head">
            <h3 className="admin-column-label">{t.adminStageColumn}</h3>
            {stages.length > 0 && <span className="admin-column-count">{stages.length}</span>}
            <button type="button" className="admin-icon-btn" onClick={openCreateStage} title={t.adminAddStage} aria-label={t.adminAddStage}>
              <Plus size={16} weight="bold" />
            </button>
          </header>

          <div className="admin-column-body">
            {stages.length === 0 ? (
              <div className="admin-empty">
                <Flag size={20} weight="fill" aria-hidden="true" />
                <p className="admin-empty-hint">{t.adminStageEmpty}</p>
                <button type="button" className="admin-link-btn" onClick={openCreateStage}>
                  <Plus size={14} weight="bold" />
                  <span>{t.adminAddStage}</span>
                </button>
              </div>
            ) : (
              <ul className="admin-list is-compact">
              {stages.map((stage, index) => {
                const theme = stageThemeOf(stage)
                const active = selectedStage?.id === stage.id
                return (
                  <li key={stage.id} className={`admin-row is-stage${active ? ' is-active' : ''}`}>
                    <span className="admin-swatch" style={{ background: STAGE_VISUALS[theme].soft }} aria-hidden="true" />
                    <button type="button" className="admin-row-select" onClick={() => { setStageId(stage.id); setLessonId(null) }}>
                      <strong>{stage.title}</strong>
                      <small>{t.adminLessonCount(stage.lessons.length)}</small>
                    </button>
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        className="admin-icon-btn"
                        onClick={() => void moveStage(stage, 'up')}
                        disabled={busy || index === 0}
                        aria-label={t.adminMoveUp}
                        title={t.adminMoveUp}
                      >
                        <CaretUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn"
                        onClick={() => void moveStage(stage, 'down')}
                        disabled={busy || index === stages.length - 1}
                        aria-label={t.adminMoveDown}
                        title={t.adminMoveDown}
                      >
                        <CaretDown size={14} />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn"
                        onClick={() => openEditStage(stage)}
                        aria-label={t.adminEdit}
                        title={t.adminEdit}
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn is-danger"
                        onClick={() => void removeStage(stage)}
                        disabled={busy}
                        aria-label={t.adminDelete}
                        title={t.adminDelete}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </li>
                )
              })}
              </ul>
            )}
          </div>
        </section>

        {/* Bài học */}
        <section className="admin-column" aria-label={t.adminLessonColumn}>
          <header className="admin-column-head">
            <h3 className="admin-column-label">{t.adminLessonColumn}</h3>
            {selectedStage && selectedStage.lessons.length > 0 && (
              <span className="admin-column-count">{selectedStage.lessons.length}</span>
            )}
            <button
              type="button"
              className="admin-icon-btn"
              onClick={openCreateLesson}
              disabled={!selectedStage || busy}
              title={t.adminAddLesson}
              aria-label={t.adminAddLesson}
            >
              <Plus size={16} weight="bold" />
            </button>
          </header>

          <div className="admin-column-body">
            {!selectedStage ? (
              <div className="admin-empty">
                <HandPointing size={20} weight="fill" aria-hidden="true" />
                <p className="admin-empty-hint">{t.adminSelectStage}</p>
              </div>
            ) : selectedStage.lessons.length === 0 ? (
              <div className="admin-empty">
                <Books size={20} weight="fill" aria-hidden="true" />
                <p className="admin-empty-hint">{t.adminLessonEmpty}</p>
                <button type="button" className="admin-link-btn" onClick={openCreateLesson}>
                  <Plus size={14} weight="bold" />
                  <span>{t.adminAddLesson}</span>
                </button>
              </div>
            ) : (
              <ul className="admin-list is-compact">
              {selectedStage.lessons.map((lesson, index) => {
                const active = selectedLesson?.id === lesson.id
                return (
                  <li key={lesson.id} className={`admin-row is-lesson${active ? ' is-active' : ''}`}>
                    <button type="button" className="admin-row-select" onClick={() => setLessonId(lesson.id)}>
                      <strong>{lesson.title}</strong>
                      <small>{lesson.topic} · {t.adminQuestionCount(lesson.question_count)}</small>
                      {lesson.question_count === 0 && (
                        <span className="admin-chip is-warn">{t.adminNoQuestionBadge}</span>
                      )}
                    </button>
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        className="admin-icon-btn"
                        onClick={() => void moveLesson(lesson.id, 'up')}
                        disabled={busy || index === 0}
                        aria-label={t.adminMoveUp}
                        title={t.adminMoveUp}
                      >
                        <CaretUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn"
                        onClick={() => void moveLesson(lesson.id, 'down')}
                        disabled={busy || index === selectedStage.lessons.length - 1}
                        aria-label={t.adminMoveDown}
                        title={t.adminMoveDown}
                      >
                        <CaretDown size={14} />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn"
                        onClick={() => openEditLesson(lesson.id, lesson.title, lesson.topic)}
                        aria-label={t.adminEdit}
                        title={t.adminEdit}
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn is-danger"
                        onClick={() => void removeLesson(lesson.id, lesson.title)}
                        disabled={busy}
                        aria-label={t.adminDelete}
                        title={t.adminDelete}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </li>
                )
              })}
              </ul>
            )}
          </div>
        </section>

        {/* Câu hỏi */}
        <section className="admin-column" aria-label={t.adminQuestionColumn}>
          <header className="admin-column-head">
            <h3 className="admin-column-label">{t.adminQuestionColumn}</h3>
            {questions.length > 0 && <span className="admin-column-count">{questions.length}</span>}
            <button
              type="button"
              className="admin-icon-btn"
              onClick={openCreateQuestion}
              disabled={!selectedLesson || busy}
              title={t.adminAddQuestion}
              aria-label={t.adminAddQuestion}
            >
              <Plus size={16} weight="bold" />
            </button>
          </header>

          <div className="admin-column-body">
            {!selectedLesson ? (
              <div className="admin-empty">
                <HandPointing size={20} weight="fill" aria-hidden="true" />
                <p className="admin-empty-hint">{t.adminSelectLesson}</p>
              </div>
            ) : questionsLoading ? (
              <AdminSkeleton rows={4} />
            ) : questionsError ? (
              <div className="admin-inline-state">
                <WarningCircle size={16} weight="fill" />
                <span>{questionsError}</span>
                <button type="button" className="admin-link-btn" onClick={reloadQuestions}>{t.retry}</button>
              </div>
            ) : questions.length === 0 ? (
              <div className="admin-empty">
                <Question size={20} weight="fill" aria-hidden="true" />
                <p className="admin-empty-hint">{t.adminQuestionEmpty}</p>
                <button type="button" className="admin-link-btn" onClick={openCreateQuestion}>
                  <Plus size={14} weight="bold" />
                  <span>{t.adminAddQuestion}</span>
                </button>
              </div>
            ) : (
              <ul className="admin-list is-compact">
                {questions.map((question, index) => (
                  <li key={question.id} className="admin-row is-question">
                    <div className="admin-row-main">
                      <strong>{question.question_text}</strong>
                      <div className="admin-row-meta">
                        <span className="admin-chip">
                          {questionTypeLabels[question.question_type as AdminQuestionType] ?? question.question_type}
                        </span>
                        <span className="admin-row-meta-text">
                          {difficultyLabels[question.difficulty as AdminDifficulty] ?? question.difficulty}
                          {' · '}
                          {t.adminQuestionCount(question.answers.length)}
                        </span>
                      </div>
                    </div>
                    <div className="admin-row-actions">
                    <button
                      type="button"
                      className="admin-icon-btn"
                      onClick={() => void moveQuestion(question, 'up')}
                      disabled={busy || index === 0}
                      aria-label={t.adminMoveUp}
                      title={t.adminMoveUp}
                    >
                      <CaretUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn"
                      onClick={() => void moveQuestion(question, 'down')}
                      disabled={busy || index === questions.length - 1}
                      aria-label={t.adminMoveDown}
                      title={t.adminMoveDown}
                    >
                      <CaretDown size={14} />
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn"
                      onClick={() => openEditQuestion(question)}
                      aria-label={t.adminEdit}
                      title={t.adminEdit}
                    >
                      <PencilSimple size={14} />
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn is-danger"
                      onClick={() => void removeQuestion(question)}
                      disabled={busy}
                      aria-label={t.adminDelete}
                      title={t.adminDelete}
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            )}
          </div>
        </section>
      </div>

      {/* Stage dialog */}
      <AdminDialog
        open={stageDraft !== null}
        title={stageDraft?.mode === 'edit' ? t.adminEdit : t.adminAddStage}
        busy={busy}
        onClose={() => setStageDraft(null)}
        footer={(
          <div className="admin-dialog-actions">
            <button type="button" className="video-ghost-btn" onClick={() => setStageDraft(null)} disabled={busy}>
              <span>{t.cancel}</span>
            </button>
            <button type="submit" form="admin-stage-form" className="video-primary-btn" disabled={busy}>
              <span>{busy ? t.saving : t.adminSaveStage}</span>
            </button>
          </div>
        )}
      >
        {stageDraft && (
          <form id="admin-stage-form" className="admin-form" onSubmit={(event) => void submitStage(event)}>
            <div className="admin-section">
              <h4 className="admin-section-title">{t.adminSectionInfo}</h4>
              <label className="admin-field">
                <span>{t.adminStageTitleLabel}</span>
                <input
                  type="text"
                  data-autofocus
                  value={stageDraft.title}
                  maxLength={120}
                  onChange={(event) => setStageDraft({ ...stageDraft, title: event.target.value })}
                  disabled={busy}
                />
              </label>
              <label className="admin-field">
                <span>{t.adminStageDescLabel}</span>
                <textarea
                  value={stageDraft.description}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => setStageDraft({ ...stageDraft, description: event.target.value })}
                  disabled={busy}
                />
              </label>
            </div>
            <div className="admin-section">
              <h4 className="admin-section-title">{t.adminSectionAppearance}</h4>
              <div className="admin-theme-grid" role="radiogroup" aria-label={t.adminThemeLabel}>
                {STAGE_THEME_KEYS.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    role="radio"
                    aria-checked={stageDraft.themeKey === theme}
                    className={`admin-theme-option${stageDraft.themeKey === theme ? ' is-active' : ''}`}
                    onClick={() => setStageDraft({ ...stageDraft, themeKey: theme })}
                    disabled={busy}
                  >
                    <span className="admin-swatch" style={{ background: STAGE_VISUALS[theme].soft }} aria-hidden="true" />
                    <span>{THEME_LABELS[theme]}</span>
                    {stageDraft.themeKey === theme && <CheckCircle size={14} weight="fill" className="admin-theme-check" />}
                  </button>
                ))}
              </div>
            </div>
            {formError && <p className="video-import-error" role="alert">{formError}</p>}
          </form>
        )}
      </AdminDialog>

      {/* Lesson dialog */}
      <AdminDialog
        open={lessonDraft !== null}
        title={lessonDraft?.mode === 'edit' ? t.adminEdit : t.adminAddLesson}
        scope={lessonDraft && selectedStage ? selectedStage.title : undefined}
        busy={busy}
        onClose={() => setLessonDraft(null)}
        footer={(
          <div className="admin-dialog-actions">
            <button type="button" className="video-ghost-btn" onClick={() => setLessonDraft(null)} disabled={busy}>
              <span>{t.cancel}</span>
            </button>
            <button type="submit" form="admin-lesson-form" className="video-primary-btn" disabled={busy}>
              <span>{busy ? t.saving : t.adminSaveLesson}</span>
            </button>
          </div>
        )}
      >
        {lessonDraft && (
          <form id="admin-lesson-form" className="admin-form" onSubmit={(event) => void submitLesson(event)}>
            <div className="admin-section">
              <h4 className="admin-section-title">{t.adminSectionInfo}</h4>
              <label className="admin-field">
                <span>{t.adminLessonTitleLabel}</span>
                <input
                  type="text"
                  data-autofocus
                  value={lessonDraft.title}
                  maxLength={120}
                  onChange={(event) => setLessonDraft({ ...lessonDraft, title: event.target.value })}
                  disabled={busy}
                />
              </label>
              <label className="admin-field">
                <span>{t.adminLessonTopicLabel}</span>
                <input
                  type="text"
                  value={lessonDraft.topic}
                  maxLength={120}
                  onChange={(event) => setLessonDraft({ ...lessonDraft, topic: event.target.value })}
                  disabled={busy}
                />
              </label>
            </div>
            {formError && <p className="video-import-error" role="alert">{formError}</p>}
          </form>
        )}
      </AdminDialog>

      {/* Question dialog */}
      <AdminDialog
        open={questionDraft !== null}
        title={questionDraft?.mode === 'edit' ? t.adminEdit : t.adminAddQuestion}
        scope={questionDraft && selectedLesson ? selectedLesson.title : undefined}
        busy={busy}
        onClose={() => setQuestionDraft(null)}
        footer={(
          <div className="admin-dialog-actions">
            <button type="button" className="video-ghost-btn" onClick={() => setQuestionDraft(null)} disabled={busy}>
              <span>{t.cancel}</span>
            </button>
            <button type="submit" form="admin-question-form" className="video-primary-btn" disabled={busy}>
              <ListChecks size={16} weight="bold" />
              <span>{busy ? t.saving : t.adminSaveQuestion}</span>
            </button>
          </div>
        )}
      >
        {questionDraft && (
          <form id="admin-question-form" className="admin-form" onSubmit={(event) => void submitQuestion(event)}>
            <div className="admin-section">
              <h4 className="admin-section-title">{t.adminSectionQuestion}</h4>
              <label className="admin-field">
                <span>{t.adminQuestionTypeLabel}</span>
                <select
                  value={questionDraft.draft.questionType}
                  onChange={(event) => setQuestionDraft({
                    ...questionDraft,
                    draft: withQuestionType(questionDraft.draft, event.target.value as AdminQuestionType),
                  })}
                  disabled={busy}
                >
                  {QUESTION_TYPES.map((type) => (
                    <option key={type} value={type}>{questionTypeLabels[type]}</option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>{t.adminQuestionTextLabel}</span>
                <textarea
                  data-autofocus
                  value={questionDraft.draft.questionText}
                  rows={3}
                  maxLength={5000}
                  onChange={(event) => setQuestionDraft({
                    ...questionDraft,
                    draft: { ...questionDraft.draft, questionText: event.target.value },
                  })}
                  disabled={busy}
                />
              </label>

              <label className="admin-field">
                <span>{t.adminQuestionExplanationLabel}</span>
                <input
                  type="text"
                  value={questionDraft.draft.explanation}
                  maxLength={2000}
                  onChange={(event) => setQuestionDraft({
                    ...questionDraft,
                    draft: { ...questionDraft.draft, explanation: event.target.value },
                  })}
                  disabled={busy}
                />
              </label>
            </div>

            <div className="admin-section">
              <h4 className="admin-section-title">{t.adminSectionSettings}</h4>

              {(questionDraft.draft.questionType === 'listening' || questionDraft.draft.questionType === 'listen_choice') && (
                <label className="admin-field">
                  <span>{t.adminQuestionAudioLabel}</span>
                  <input
                    type="text"
                    value={questionDraft.draft.audioUrl}
                    maxLength={2048}
                    onChange={(event) => setQuestionDraft({
                      ...questionDraft,
                      draft: { ...questionDraft.draft, audioUrl: event.target.value },
                    })}
                    disabled={busy}
                  />
                </label>
              )}

              <label className="admin-field">
                <span>{t.adminQuestionDifficultyLabel}</span>
                <select
                  value={questionDraft.draft.difficulty}
                  onChange={(event) => setQuestionDraft({
                    ...questionDraft,
                    draft: { ...questionDraft.draft, difficulty: event.target.value as AdminDifficulty },
                  })}
                  disabled={busy}
                >
                  {DIFFICULTIES.map((level) => (
                    <option key={level} value={level}>{difficultyLabels[level]}</option>
                  ))}
                </select>
              </label>

              {(questionDraft.draft.questionType === 'word_order' || questionDraft.draft.questionType === 'listening') && (
                <label className="admin-field">
                  <span>{t.adminQuestionWordBankLabel}</span>
                  <textarea
                    value={questionDraft.draft.wordBank}
                    rows={2}
                    onChange={(event) => setQuestionDraft({
                      ...questionDraft,
                      draft: { ...questionDraft.draft, wordBank: event.target.value },
                    })}
                    disabled={busy}
                  />
                  <p className="admin-field-hint">{t.adminQuestionWordBankHint}</p>
                </label>
              )}
            </div>

            <div className="admin-section">
              <h4 className="admin-section-title">{t.adminQuestionAnswersLabel}</h4>
              <p className="admin-field-hint">{t.adminAnswerHint}</p>
              <ul className="admin-answers">
                {questionDraft.draft.answers.map((answer, index) => (
                  <li key={index} className={`admin-answer-row${answer.isCorrect ? ' is-correct' : ''}`}>
                    <label className="admin-answer-correct">
                      <input
                        type="radio"
                        name="admin-correct-answer"
                        aria-label={t.adminAnswerCorrect}
                        checked={answer.isCorrect}
                        onChange={() => setQuestionDraft({
                          ...questionDraft,
                          draft: setCorrectAnswer(questionDraft.draft, index),
                        })}
                        disabled={busy}
                      />
                    </label>
                    <input
                      type="text"
                      className="admin-answer-input"
                      value={answer.answerText}
                      maxLength={500}
                      placeholder={t.adminAnswerPlaceholder}
                      onChange={(event) => setQuestionDraft({
                        ...questionDraft,
                        draft: {
                          ...questionDraft.draft,
                          answers: questionDraft.draft.answers.map((entry, position) => (
                            position === index ? { ...entry, answerText: event.target.value } : entry
                          )),
                        },
                      })}
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="admin-icon-btn is-danger"
                      onClick={() => setQuestionDraft({
                        ...questionDraft,
                        draft: {
                          ...questionDraft.draft,
                          answers: questionDraft.draft.answers.filter((_, position) => position !== index),
                        },
                      })}
                      disabled={busy || questionDraft.draft.answers.length <= answerCountFor(questionDraft.draft.questionType).min}
                      aria-label={t.adminRemoveAnswer}
                      title={t.adminRemoveAnswer}
                    >
                      <Trash size={14} />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="admin-link-btn"
                onClick={() => setQuestionDraft({
                  ...questionDraft,
                  draft: {
                    ...questionDraft.draft,
                    answers: [...questionDraft.draft.answers, emptyAnswer(false)],
                  },
                })}
                disabled={busy || questionDraft.draft.answers.length >= answerCountFor(questionDraft.draft.questionType).max}
              >
                <Plus size={14} weight="bold" />
                <span>{t.adminAddAnswer}</span>
              </button>
            </div>

            {formError && <p className="video-import-error" role="alert">{formError}</p>}
          </form>
        )}
      </AdminDialog>
    </section>
  )
}
