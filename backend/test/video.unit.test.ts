import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  completionThreshold,
  hasWatchedEnough,
} from '../src/modules/video/video.service';
import {
  parseImportUrl,
  parseSaveWordInput,
  parseSavedWord,
  parseVideoId,
  parseWatchedSeconds,
} from '../src/modules/video/video.validation';
import {
  extractYouTubeId,
  parseJson3Cues,
  segmentCaptionCues,
  videoCodeForUser,
} from '../src/modules/video/video.youtube';
import { HttpError } from '../src/middleware/error-handler';

test('video completion needs at least 90% of the duration', () => {
  assert.equal(completionThreshold(300), 270);
  assert.equal(completionThreshold(8), 8);
  assert.equal(completionThreshold(0), 0);
  assert.equal(hasWatchedEnough(300, 269), false);
  assert.equal(hasWatchedEnough(300, 270), true);
  assert.equal(hasWatchedEnough(0, 0), true);
});

test('video IDs and watch progress are validated', () => {
  assert.equal(parseVideoId('12'), 12);
  assert.throws(() => parseVideoId('0'), (error) => error instanceof HttpError && error.statusCode === 400);
  assert.throws(() => parseVideoId('abc'), (error) => error instanceof HttpError && error.statusCode === 400);

  assert.equal(parseWatchedSeconds({ watchedSeconds: 30 }), 30);
  assert.equal(parseWatchedSeconds({ watched_seconds: 45 }), 45);
  assert.throws(() => parseWatchedSeconds({ watchedSeconds: -1 }), (error) => error instanceof HttpError && error.statusCode === 422);
  assert.throws(() => parseWatchedSeconds({ watchedSeconds: 1.5 }), (error) => error instanceof HttpError && error.statusCode === 422);
  assert.throws(() => parseWatchedSeconds({}), (error) => error instanceof HttpError && error.statusCode === 422);
});

test('saved word input is trimmed and bounded', () => {
  assert.deepEqual(parseSaveWordInput({
    word: '  natural  ',
    ipa: ' /ˈnætʃ.ər.əl/ ',
    meaningVi: ' tự nhiên ',
    detailVi: 'Tính từ: trôi chảy.',
    videoId: 1,
  }), {
    word: 'natural',
    ipa: '/ˈnætʃ.ər.əl/',
    meaningVi: 'tự nhiên',
    detailVi: 'Tính từ: trôi chảy.',
    videoId: 1,
  });

  assert.throws(
    () => parseSaveWordInput({ word: '' }),
    (error) => error instanceof HttpError && error.statusCode === 422,
  );
  assert.throws(
    () => parseSaveWordInput({ word: 'ok', videoId: 0 }),
    (error) => error instanceof HttpError && error.statusCode === 422,
  );
  assert.throws(
    () => parseSaveWordInput({ word: 'x'.repeat(81) }),
    (error) => error instanceof HttpError && error.statusCode === 422,
  );
});

test('saved word route parameters are decoded', () => {
  assert.equal(parseSavedWord('iced%20coffee'), 'iced coffee');
  assert.throws(() => parseSavedWord(''), (error) => error instanceof HttpError && error.statusCode === 400);
});

test('YouTube links are reduced to a safe video id', () => {
  assert.equal(extractYouTubeId('https://www.youtube.com/watch?v=N9B59PHIFbA'), 'N9B59PHIFbA');
  assert.equal(extractYouTubeId('https://youtu.be/N9B59PHIFbA?t=12'), 'N9B59PHIFbA');
  assert.equal(extractYouTubeId('https://m.youtube.com/shorts/N9B59PHIFbA'), 'N9B59PHIFbA');
  assert.equal(extractYouTubeId('https://www.youtube.com/embed/N9B59PHIFbA'), 'N9B59PHIFbA');
  assert.equal(extractYouTubeId('N9B59PHIFbA'), 'N9B59PHIFbA');
  assert.equal(extractYouTubeId('https://example.com/watch?v=N9B59PHIFbA'), null);
  assert.equal(extractYouTubeId('javascript:alert(1)'), null);
  assert.equal(extractYouTubeId('https://www.youtube.com/'), null);
  assert.equal(extractYouTubeId(''), null);
  assert.equal(videoCodeForUser('N9B59PHIFbA', 7), 'yt_N9B59PHIFbA_u7');
  assert.equal(parseImportUrl({ url: ' https://youtu.be/N9B59PHIFbA ' }), 'https://youtu.be/N9B59PHIFbA');
  assert.throws(() => parseImportUrl({}), (error) => error instanceof HttpError && error.statusCode === 422);
});

test('json3 captions become sentence segments', () => {
  const cues = parseJson3Cues({
    events: [
      { tStartMs: 0, dDurationMs: 1200, segs: [{ utf8: 'Hello' }, { utf8: ' there.' }] },
      { tStartMs: 1200, dDurationMs: 800, segs: [{ utf8: '\n' }] },
      { tStartMs: 1300, dDurationMs: 2000, segs: [{ utf8: 'How are' }, { utf8: ' you?' }] },
      { tStartMs: 3400, dDurationMs: 1800, segs: [{ utf8: '[Music]' }] },
      { tStartMs: 5400, dDurationMs: 1500, segs: [{ utf8: 'I am fine.' }] },
    ],
  });
  assert.deepEqual(cues.map((cue) => cue.text), ['Hello there.', 'How are you?', 'I am fine.']);

  const segments = segmentCaptionCues(cues);
  assert.deepEqual(segments.map((segment) => segment.text), [
    'Hello there. How are you? I am fine.',
  ]);
  assert.deepEqual(segments.map((segment) => [segment.startMs, segment.endMs]), [
    [0, 6900],
  ]);
});

test('a reaction leads into the sentence that follows it', () => {
  const segments = segmentCaptionCues([
    { startMs: 0, endMs: 1200, text: 'Oh yes!' },
    { startMs: 1200, endMs: 4200, text: 'We will graduate next month.' },
    { startMs: 4200, endMs: 7000, text: 'I know.' },
    { startMs: 7000, endMs: 9800, text: 'Time goes by so fast.' },
  ]);

  assert.deepEqual(segments.map((segment) => segment.text), [
    'Oh yes! We will graduate next month.',
    'I know. Time goes by so fast.',
  ]);
});

test('every sentence becomes its own line, however short', () => {
  const segments = segmentCaptionCues([
    { startMs: 0, endMs: 2400, text: 'Hi there.' },
    { startMs: 2400, endMs: 6500, text: 'Today I am going to tell you how to use make and do.' },
    { startMs: 6500, endMs: 9000, text: 'Now they can be tricky.' },
    { startMs: 9000, endMs: 11600, text: 'But here are four things to remember.' },
    { startMs: 11600, endMs: 13000, text: 'We use make when we create something...' },
    { startMs: 14100, endMs: 15000, text: 'like this cake!' },
    { startMs: 15600, endMs: 18500, text: 'We use do to talk about an activity.' },
    { startMs: 18500, endMs: 19400, text: 'What are you doing?' },
    { startMs: 19400, endMs: 20700, text: 'I\'m doing some work.' },
  ]);

  assert.deepEqual(segments.map((segment) => segment.text), [
    'Hi there. Today I am going to tell you how to use make and do.',
    'Now they can be tricky.',
    'But here are four things to remember.',
    'We use make when we create something... like this cake!',
    'We use do to talk about an activity.',
    'What are you doing?',
    'I\'m doing some work.',
  ]);
  assert.equal(segments.at(-1)?.endMs, 20_700);
});

test('short conversational turns split one sentence per line', () => {
  const segments = segmentCaptionCues([
    { startMs: 0, endMs: 1800, text: 'You look happy today.' },
    { startMs: 1800, endMs: 3600, text: 'Yes I am very happy.' },
    { startMs: 3600, endMs: 5400, text: 'Why are you so happy?' },
  ]);

  assert.deepEqual(segments.map((segment) => segment.text), [
    'You look happy today.',
    'Yes I am very happy.',
    'Why are you so happy?',
  ]);
});

test('long unpunctuated monologues split into bounded segments without gaps', () => {
  const cues = Array.from({ length: 15 }, (_, index) => ({
    startMs: index * 2000,
    endMs: (index + 1) * 2000,
    text: `chunk number ${index + 1} keeps rolling`,
  }));
  const segments = segmentCaptionCues(cues);

  assert.ok(segments.length >= 2);
  for (const segment of segments) {
    assert.ok(segment.endMs - segment.startMs <= 12_000);
  }
  for (let index = 1; index < segments.length; index += 1) {
    assert.equal(segments[index].startMs, segments[index - 1].endMs);
  }
  assert.match(segments[0].text, /^Chunk number 1/);
});

test('overlapping rolling captions never produce overlapping segments', () => {
  const segments = segmentCaptionCues([
    { startMs: 0, endMs: 5000, text: 'so what is new' },
    { startMs: 2000, endMs: 7000, text: 'how is your new job going' },
    { startMs: 4000, endMs: 9000, text: 'to be honest i cannot complain' },
    { startMs: 6000, endMs: 11000, text: 'i really love the company' },
    { startMs: 8000, endMs: 14000, text: 'working for my co-workers are friendly' },
    { startMs: 10000, endMs: 17000, text: 'they really help me feel welcome' },
  ]);

  for (let index = 1; index < segments.length; index += 1) {
    assert.ok(
      segments[index].startMs >= segments[index - 1].endMs,
      'segments must not overlap',
    );
  }
  assert.match(segments.map((segment) => segment.text).join(' '), /so what is new/i);
});
