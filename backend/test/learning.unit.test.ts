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
