import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  answerCountFor,
  buildQuestionPayload,
  emptyQuestionDraft,
  parseWordBankInput,
  questionDraftFrom,
  setCorrectAnswer,
  validateQuestionDraft,
  withQuestionType,
  type QuestionDraft,
} from './adminForm'
import type { AdminQuestion } from '../types/admin'

function draft(overrides: Partial<QuestionDraft> = {}): QuestionDraft {
  return {
    ...emptyQuestionDraft('multiple_choice'),
    questionText: 'Tháng trong tiếng Anh là gì?',
    answers: [
      { answerText: 'month', isCorrect: true },
      { answerText: 'week', isCorrect: false },
    ],
    ...overrides,
  }
}

describe('admin question form', () => {
  test('a complete multiple-choice question passes validation', () => {
    assert.equal(validateQuestionDraft(draft()), null)
  })

  test('a missing prompt is reported before anything else', () => {
    assert.equal(validateQuestionDraft(draft({ questionText: '   ' })), 'required')
  })

  test('a choice question needs at least two answers', () => {
    assert.equal(
      validateQuestionDraft(draft({ answers: [{ answerText: 'month', isCorrect: true }] })),
      'answers',
    )
  })

  test('exactly one answer may be correct', () => {
    assert.equal(
      validateQuestionDraft(draft({
        answers: [
          { answerText: 'month', isCorrect: true },
          { answerText: 'week', isCorrect: true },
        ],
      })),
      'answers',
    )
  })

  test('listening questions require an audio link', () => {
    const listening = draft({ questionType: 'listening', answers: [{ answerText: 'month', isCorrect: true }] })
    assert.equal(validateQuestionDraft(listening), 'audio')
    assert.equal(validateQuestionDraft({ ...listening, audioUrl: 'listening/a.mp3' }), null)
  })

  test('switching to a choice type tops the answer list up to two', () => {
    const wordOrder = draft({
      questionType: 'word_order',
      answers: [{ answerText: 'I go to school', isCorrect: true }],
    })
    const switched = withQuestionType(wordOrder, 'multiple_choice')
    assert.equal(switched.questionType, 'multiple_choice')
    assert.equal(switched.answers.length, 2)
    assert.equal(switched.answers.filter((answer) => answer.isCorrect).length, 1)
    assert.deepEqual(answerCountFor('multiple_choice'), { min: 2, max: 8 })
    assert.deepEqual(answerCountFor('word_order'), { min: 1, max: 8 })
  })

  test('picking a correct answer clears the previous one', () => {
    const picked = setCorrectAnswer(draft(), 1)
    assert.deepEqual(picked.answers.map((answer) => answer.isCorrect), [false, true])
  })

  test('payload trims text, drops empty answers and omits an empty word bank', () => {
    const payload = buildQuestionPayload(draft({
      questionText: '  Tháng  ',
      explanation: '  month = tháng ',
      answers: [
        { answerText: ' month ', isCorrect: true },
        { answerText: '   ', isCorrect: false },
        { answerText: 'week', isCorrect: false },
      ],
    }))
    assert.equal(payload.question_text, 'Tháng')
    assert.equal(payload.explanation, 'month = tháng')
    assert.equal(payload.word_bank, undefined)
    assert.deepEqual(payload.answers, [
      { answer_text: 'month', is_correct: true },
      { answer_text: 'week', is_correct: false },
    ])
  })

  test('word bank input accepts commas, semicolons and line breaks', () => {
    assert.deepEqual(parseWordBankInput('I, go; to\nschool'), ['I', 'go', 'to', 'school'])
    assert.deepEqual(parseWordBankInput('   '), [])
  })

  test('an existing question round-trips into an editable draft', () => {
    const question: AdminQuestion = {
      id: 7,
      lesson_id: 3,
      question_text: 'Sắp xếp câu',
      question_type: 'word_order',
      explanation: null,
      audio_url: null,
      word_bank: ['She', 'likes', 'apples'],
      difficulty: 'intermediate',
      sort_order: 2,
      answers: [{ id: 1, answer_text: 'She likes apples', is_correct: true, sort_order: 1 }],
    }
    const parsed = questionDraftFrom(question)
    assert.equal(parsed.questionType, 'word_order')
    assert.equal(parsed.difficulty, 'intermediate')
    assert.equal(parsed.wordBank, 'She, likes, apples')
    assert.equal(parsed.answers[0].isCorrect, true)
  })
})
