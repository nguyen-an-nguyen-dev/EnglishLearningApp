import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildWordBank,
  nextAvailableCode,
  normalizeWordBank,
  parseQuestionInput,
  slugify,
} from '../src/modules/admin/admin.validation';
import { THEME_ACCENTS, STAGE_THEME_KEYS } from '../src/modules/admin/admin.types';

test('slugify folds Vietnamese diacritics and never returns empty', () => {
  assert.equal(slugify('Chặng Giao Tiếp Cơ Bản'), 'chang-giao-tiep-co-ban');
  assert.equal(slugify('Đường phố & Đời sống'), 'duong-pho-doi-song');
  assert.equal(slugify('   '), '');
  assert.equal(slugify('###'), '');
});

test('nextAvailableCode keeps codes unique instead of failing the insert', () => {
  assert.equal(nextAvailableCode('Greetings', new Set()), 'greetings');
  assert.equal(nextAvailableCode('Greetings', new Set(['greetings'])), 'greetings-2');
  assert.equal(
    nextAvailableCode('Greetings', new Set(['greetings', 'greetings-2', 'greetings-3'])),
    'greetings-4',
  );
  assert.equal(nextAvailableCode('###', new Set(), 'chang'), 'chang');
});

test('word banks are derived from the correct answer when the admin leaves them empty', () => {
  assert.deepEqual(buildWordBank('I go to school every day'), ['I', 'go', 'to', 'school', 'every', 'day']);
  assert.deepEqual(normalizeWordBank('', 'Hello there'), ['Hello', 'there']);
  assert.deepEqual(normalizeWordBank(['Hello', ' there ']), ['Hello', 'there']);
  assert.deepEqual(normalizeWordBank('one, two\nthree'), ['one', 'two', 'three']);
});

test('parseQuestionInput fills the word bank and normalises difficulty', () => {
  const parsed = parseQuestionInput({
    question_text: 'Sắp xếp câu',
    question_type: 'word_order',
    answers: [{ answer_text: 'She likes apples', is_correct: true }],
  });
  assert.equal(parsed.questionType, 'word_order');
  assert.equal(parsed.difficulty, 'beginner');
  assert.equal(parsed.audioUrl, null);
  assert.deepEqual(parsed.wordBank, ['She', 'likes', 'apples']);
});

test('parseQuestionInput rejects listening questions without audio', () => {
  assert.throws(
    () => parseQuestionInput({
      question_text: 'Nghe lại',
      question_type: 'listen_choice',
      answers: [
        { answer_text: 'a', is_correct: true },
        { answer_text: 'b', is_correct: false },
      ],
    }),
    (error: unknown) => {
      const httpError = error as { message: string; errors?: string[] };
      assert.equal(httpError.message, 'Validation failed');
      assert.ok(httpError.errors?.some((entry) => entry.includes('audio_url is required')));
      return true;
    },
  );
});

test('every stage theme has an accent colour the roadmap can paint with', () => {
  for (const theme of STAGE_THEME_KEYS) {
    assert.match(THEME_ACCENTS[theme], /^#[0-9A-F]{6}$/i);
  }
  assert.equal(new Set(Object.values(THEME_ACCENTS)).size, STAGE_THEME_KEYS.length);
});
