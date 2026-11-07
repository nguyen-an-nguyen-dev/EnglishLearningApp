import type {
  AdminAnswerPayload,
  AdminDifficulty,
  AdminQuestion,
  AdminQuestionType,
  QuestionPayload,
} from '../types/admin'
import {
  AUDIO_QUESTION_TYPES,
  CHOICE_QUESTION_TYPES,
  MAX_ANSWERS,
  MIN_CHOICE_ANSWERS,
} from '../types/admin'

export interface AnswerDraft {
  answerText: string
  isCorrect: boolean
}

export interface QuestionDraft {
  questionText: string
  questionType: AdminQuestionType
  explanation: string
  audioUrl: string
  difficulty: AdminDifficulty
  wordBank: string
  answers: AnswerDraft[]
}

export type QuestionDraftIssue = 'required' | 'audio' | 'answers' | null

export function emptyAnswer(isCorrect = false): AnswerDraft {
  return { answerText: '', isCorrect }
}

export function emptyQuestionDraft(questionType: AdminQuestionType = 'multiple_choice'): QuestionDraft {
  const isChoice = CHOICE_QUESTION_TYPES.includes(questionType)
  return {
    questionText: '',
    questionType,
    explanation: '',
    audioUrl: '',
    difficulty: 'beginner',
    wordBank: '',
    answers: isChoice
      ? [emptyAnswer(true), emptyAnswer(false), emptyAnswer(false)]
      : [emptyAnswer(true)],
  }
}

export function questionDraftFrom(question: AdminQuestion): QuestionDraft {
  const type = question.question_type as AdminQuestionType
  return {
    questionText: question.question_text,
    questionType: type,
    explanation: question.explanation ?? '',
    audioUrl: question.audio_url ?? '',
    difficulty: question.difficulty as AdminDifficulty,
    wordBank: question.word_bank.join(', '),
    answers: question.answers.length > 0
      ? question.answers.map((answer) => ({
          answerText: answer.answer_text,
          isCorrect: answer.is_correct,
        }))
      : [emptyAnswer(true)],
  }
}

/** Commas, semicolons and line breaks all separate tokens; order is preserved. */
export function parseWordBankInput(value: string): string[] {
  return value
    .split(/[,\n;]+/)
    .map((entry) => entry.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 60)
}

export function answerCountFor(questionType: AdminQuestionType): { min: number; max: number } {
  return {
    min: CHOICE_QUESTION_TYPES.includes(questionType) ? MIN_CHOICE_ANSWERS : 1,
    max: MAX_ANSWERS,
  }
}

/**
 * Mirrors the backend rules so the admin sees the problem before the request:
 * one correct answer, enough options for a choice question, audio for listening.
 */
export function validateQuestionDraft(draft: QuestionDraft): QuestionDraftIssue {
  if (!draft.questionText.trim()) return 'required'

  const answers = draft.answers.filter((answer) => answer.answerText.trim().length > 0)
  const { min } = answerCountFor(draft.questionType)
  const correctCount = answers.filter((answer) => answer.isCorrect).length
  if (answers.length < min || correctCount !== 1) return 'answers'

  if (AUDIO_QUESTION_TYPES.includes(draft.questionType) && !draft.audioUrl.trim()) return 'audio'
  return null
}

export function buildQuestionPayload(draft: QuestionDraft): QuestionPayload {
  const answers: AdminAnswerPayload[] = draft.answers
    .filter((answer) => answer.answerText.trim().length > 0)
    .map((answer) => ({ answer_text: answer.answerText.trim(), is_correct: answer.isCorrect }))
  const wordBank = parseWordBankInput(draft.wordBank)

  return {
    question_text: draft.questionText.trim(),
    question_type: draft.questionType,
    explanation: draft.explanation.trim() || undefined,
    audio_url: draft.audioUrl.trim() || undefined,
    difficulty: draft.difficulty,
    word_bank: wordBank.length > 0 ? wordBank : undefined,
    answers,
  }
}

/** Switching away from a choice type keeps one correct answer and drops the extra options. */
export function withQuestionType(draft: QuestionDraft, questionType: AdminQuestionType): QuestionDraft {
  const answers = draft.answers.length > 0 ? draft.answers : [emptyAnswer(true)]
  const hasCorrect = answers.some((answer) => answer.isCorrect)
  const nextAnswers = hasCorrect
    ? answers
    : answers.map((answer, index) => ({ ...answer, isCorrect: index === 0 }))

  return {
    ...draft,
    questionType,
    answers: CHOICE_QUESTION_TYPES.includes(questionType) && nextAnswers.length < MIN_CHOICE_ANSWERS
      ? [...nextAnswers, ...(nextAnswers.length === 1 ? [emptyAnswer(false)] : [])]
      : nextAnswers,
  }
}

export function setCorrectAnswer(draft: QuestionDraft, index: number): QuestionDraft {
  return {
    ...draft,
    answers: draft.answers.map((answer, position) => ({
      ...answer,
      isCorrect: position === index,
    })),
  }
}
