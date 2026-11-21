import assert from 'node:assert/strict';
import test from 'node:test';
import { isReviewAnswerCorrect } from '../src/modules/analytics/review.service';

test('an exact answer is correct regardless of case and spacing', () => {
  assert.equal(isReviewAnswerCorrect('environment', 'environment'), true);
  assert.equal(isReviewAnswerCorrect('environment', '  Environment  '), true);
  assert.equal(isReviewAnswerCorrect('take off', 'Take   Off'), true);
});

test('accents and punctuation never fail a recall', () => {
  assert.equal(isReviewAnswerCorrect('café', 'cafe'), true);
  assert.equal(isReviewAnswerCorrect("don't", 'dont'), true);
  assert.equal(isReviewAnswerCorrect('well-known', 'well known'), true);
});

test('one typo is tolerated on longer words only', () => {
  assert.equal(isReviewAnswerCorrect('environment', 'enviroment'), true);
  assert.equal(isReviewAnswerCorrect('beautiful', 'beatiful'), true);
  // Four letters or fewer must be exact: "cat" vs "cut" is a different word.
  assert.equal(isReviewAnswerCorrect('cat', 'cut'), false);
  assert.equal(isReviewAnswerCorrect('ship', 'shop'), false);
});

test('two edits are tolerated only on long words', () => {
  assert.equal(isReviewAnswerCorrect('communication', 'comunication'), true);
  assert.equal(isReviewAnswerCorrect('communication', 'comunicaton'), true);
  assert.equal(isReviewAnswerCorrect('language', 'langauge'), true);
  assert.equal(isReviewAnswerCorrect('language', 'languge'), true);
});

test('a different word is never accepted', () => {
  assert.equal(isReviewAnswerCorrect('environment', 'government'), false);
  assert.equal(isReviewAnswerCorrect('take off', 'take out'), false);
  assert.equal(isReviewAnswerCorrect('environment', ''), false);
});

test('an empty answer key cannot be matched', () => {
  assert.equal(isReviewAnswerCorrect('', ''), false);
  assert.equal(isReviewAnswerCorrect('', 'anything'), false);
});
