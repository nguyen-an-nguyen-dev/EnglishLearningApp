import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAnswerCorrect, resolveAudioUrl } from '../src/modules/learning/learning.service';

test('listening audio object paths resolve to public Supabase Storage URLs', () => {
  assert.equal(
    resolveAudioUrl('listening/hello world.mp3', 'listening', 'https://project.supabase.co', 'english-media'),
    'https://project.supabase.co/storage/v1/object/public/english-media/listening/hello%20world.mp3',
  );
  assert.equal(
    resolveAudioUrl('/listening/hello-how-are-you.wav', 'listening', 'https://project.supabase.co', 'english-media'),
    'https://project.supabase.co/storage/v1/object/public/english-media/listening/hello-how-are-you.wav',
  );
});

test('existing full audio URLs are preserved', () => {
  assert.equal(
    resolveAudioUrl('https://cdn.example.test/audio.mp3', 'listening', '', ''),
    'https://cdn.example.test/audio.mp3',
  );
});

test('listen_choice audio object paths also resolve to public Supabase Storage URLs', () => {
  assert.equal(
    resolveAudioUrl('listening/the-girl.mp3', 'listen_choice', 'https://project.supabase.co', 'english-media'),
    'https://project.supabase.co/storage/v1/object/public/english-media/listening/the-girl.mp3',
  );
});

test('listen_choice questions are graded by answer id', () => {
  const rows = [
    { id: 21, question_id: 12, answer_text: 'Hello, how are you?', is_correct: 1 },
    { id: 22, question_id: 12, answer_text: 'Good morning, my friend.', is_correct: 0 },
    { id: 23, question_id: 12, answer_text: 'See you tomorrow.', is_correct: 0 },
  ];

  assert.equal(
    isAnswerCorrect({ id: 12, question_type: 'listen_choice' }, { questionId: 12, answer: '21' }, rows),
    true,
  );
  assert.equal(
    isAnswerCorrect({ id: 12, question_type: 'listen_choice' }, { questionId: 12, answer: '23' }, rows),
    false,
  );
});

test('listening answers are checked against the transcript without case or punctuation differences', () => {
  const isCorrect = isAnswerCorrect(
    { id: 7, question_type: 'listening' },
    { questionId: 7, answer: '  Hello,   how are you? ' },
    [{ id: 1, question_id: 7, answer_text: 'Hello, how are you?', is_correct: 1 }],
  );

  assert.equal(isCorrect, true);
});

test('listening answers with different words are incorrect', () => {
  const isCorrect = isAnswerCorrect(
    { id: 7, question_type: 'listening' },
    { questionId: 7, answer: 'Hello, where are you?' },
    [{ id: 1, question_id: 7, answer_text: 'Hello, how are you?', is_correct: 1 }],
  );

  assert.equal(isCorrect, false);
});

test('fill_choice questions are graded by answer id', () => {
  const rows = [
    { id: 11, question_id: 9, answer_text: 'drink', is_correct: 0 },
    { id: 12, question_id: 9, answer_text: 'drinks', is_correct: 1 },
    { id: 13, question_id: 9, answer_text: 'drinking', is_correct: 0 },
  ];

  assert.equal(
    isAnswerCorrect({ id: 9, question_type: 'fill_choice' }, { questionId: 9, answer: '12' }, rows),
    true,
  );
  assert.equal(
    isAnswerCorrect({ id: 9, question_type: 'fill_choice' }, { questionId: 9, answer: '11' }, rows),
    false,
  );
});

test('fill_choice questions fall back to answer text matching', () => {
  const rows = [
    { id: 11, question_id: 9, answer_text: 'drinks', is_correct: 1 },
    { id: 12, question_id: 9, answer_text: 'drinking', is_correct: 0 },
  ];

  assert.equal(
    isAnswerCorrect({ id: 9, question_type: 'fill_choice' }, { questionId: 9, answer: ' Drinks ' }, rows),
    true,
  );
});
