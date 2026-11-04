import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  completionThreshold,
  hasWatchedEnough,
} from '../src/modules/video/video.service';
import {
  parseImportModel,
  parseImportUrl,
  parseSaveWordInput,
  parseSavedWord,
  parseVideoId,
  parseWatchedSeconds,
} from '../src/modules/video/video.validation';
import {
  extractYouTubeId,
  MAX_IMPORT_DURATION_SECONDS,
  parseJson3Cues,
  parseVttCues,
  segmentCaptionCues,
  stripPunctuation,
  videoCodeForUser,
} from '../src/modules/video/video.youtube';
import {
  buildSegmentsFromEnds,
  parseAiSentenceEnds,
  refineSegmentsWithAi,
} from '../src/modules/video/video.segmentation';
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

test('video analysis model defaults to Bolt and only accepts known choices', () => {
  assert.equal(parseImportModel({}), 'bolt');
  assert.equal(parseImportModel({ model: 'bolt' }), 'bolt');
  assert.equal(parseImportModel({ model: 'gemini' }), 'gemini');
  assert.throws(
    () => parseImportModel({ model: 'nvidia' }),
    (error) => error instanceof HttpError
      && error.statusCode === 422
      && error.errors.includes('INVALID_ANALYSIS_MODEL'),
  );
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
    'Hello there How are you I am fine',
  ]);
  assert.deepEqual(segments.map((segment) => [segment.startMs, segment.endMs]), [
    [0, 6900],
  ]);
});

test('lesson text keeps words, digits and single spaces only', () => {
  assert.equal(stripPunctuation(`Don't say "I'm ~ fine!"`), 'Dont say Im fine');
  assert.equal(stripPunctuation('Rock \'n\' roll — 24/7'), 'Rock n roll 24 7');
});

test('a reaction leads into the sentence that follows it', () => {
  const segments = segmentCaptionCues([
    { startMs: 0, endMs: 1200, text: 'Oh yes!' },
    { startMs: 1200, endMs: 4200, text: 'We will graduate next month.' },
    { startMs: 4200, endMs: 7000, text: 'I know.' },
    { startMs: 7000, endMs: 9800, text: 'Time goes by so fast.' },
  ]);

  assert.deepEqual(segments.map((segment) => segment.text), [
    'Oh yes We will graduate next month',
    'I know Time goes by so fast',
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
    'Hi there Today I am going to tell you how to use make and do',
    'Now they can be tricky',
    'But here are four things to remember',
    'We use make when we create something like this cake',
    'We use do to talk about an activity',
    'What are you doing',
    'Im doing some work',
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
    'You look happy today',
    'Yes I am very happy',
    'Why are you so happy',
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

test('AI sentence ends must ascend and reach the last fragment', () => {
  assert.deepEqual(parseAiSentenceEnds({ sentence_ends: [3, 7, 11] }, 11), [3, 7, 11]);
  assert.deepEqual(parseAiSentenceEnds([[2], [3]], 0), null);
  assert.deepEqual(parseAiSentenceEnds(['2', '3'], 4), [2, 3, 4]);
  assert.deepEqual(parseAiSentenceEnds({ sentence_ends: [4] }, 4), [4]);
  assert.equal(parseAiSentenceEnds({ sentence_ends: [3, 3] }, 5), null);
  assert.equal(parseAiSentenceEnds({ sentence_ends: [0, 1] }, 5), null);
  assert.equal(parseAiSentenceEnds({ sentence_ends: [6] }, 5), null);
  assert.equal(parseAiSentenceEnds({ sentence_ends: [] }, 5), null);
  assert.equal(parseAiSentenceEnds({ sentence_ends: 'nope' }, 5), null);
});

test('segments stop at sentence ends and pack whole sentences only', () => {
  const sentences = [
    { startMs: 0, endMs: 3000, text: 'Hello there.' },
    { startMs: 3000, endMs: 7000, text: 'How are you?' },
    { startMs: 7000, endMs: 20000, text: 'I was waiting for the bus.' },
    { startMs: 20000, endMs: 23000, text: 'Then it arrived.' },
  ];

  assert.deepEqual(
    buildSegmentsFromEnds(sentences, [2, 3, 4]).map((segment) => [
      segment.startMs,
      segment.endMs,
      segment.text,
    ]),
    [
      [0, 7000, 'Hello there How are you'],
      [7000, 20000, 'I was waiting for the bus'],
      [20000, 23000, 'Then it arrived'],
    ],
  );

  assert.deepEqual(
    buildSegmentsFromEnds(sentences, [4]).map((segment) => segment.text),
    ['Hello there How are you I was waiting for the bus Then it arrived'],
  );
});

test('AI sentence ends cut caption fragments at spoken sentence boundaries', async () => {
  const { env } = await import('../src/config/env');
  const originalNvidiaKey = env.nvidiaApiKey;
  const originalFetch = globalThis.fetch;
  const fallback = [
    { startMs: 0, endMs: 22000, text: 'The weather was beautiful how was the food the food was amazing' },
  ];
  const cues = [
    { startMs: 0, endMs: 6000, text: 'the weather' },
    { startMs: 6000, endMs: 14000, text: 'was beautiful.' },
    { startMs: 14000, endMs: 18000, text: 'how was the food' },
    { startMs: 18000, endMs: 22000, text: 'the food was amazing.' },
  ];

  try {
    env.nvidiaApiKey = 'test-only-nvidia-key';
    globalThis.fetch = (async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"sentence_ends":[2,4]}' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    const segments = await refineSegmentsWithAi(fallback, 'bolt', cues);
    assert.deepEqual(
      segments.map((segment) => [segment.startMs, segment.endMs, segment.text]),
      [
        [0, 14000, 'The weather was beautiful'],
        [14000, 22000, 'How was the food the food was amazing'],
      ],
    );
  } finally {
    env.nvidiaApiKey = originalNvidiaKey;
    globalThis.fetch = originalFetch;
  }
});

test('AI grouping is used when the provider answers, and rule-based segments win on failure', async () => {
  const { env } = await import('../src/config/env');
  const originalAiKey = env.aiApiKey;
  const originalNvidiaKey = env.nvidiaApiKey;
  const originalFetch = globalThis.fetch;
  const sentences = [
    { startMs: 0, endMs: 2000, text: 'Hello there.' },
    { startMs: 2000, endMs: 4000, text: 'How are you?' },
  ];
  let requestedUrl = '';

  const successResponse = () => new Response(JSON.stringify({
    choices: [{ message: { content: '{"sentence_ends":[2]}' } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  try {
    env.aiApiKey = 'test-only-gemini-key';
    env.nvidiaApiKey = 'test-only-nvidia-key';
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      requestedUrl = String(input);
      return successResponse();
    }) as typeof fetch;

    assert.deepEqual(
      (await refineSegmentsWithAi(sentences)).map((segment) => [segment.startMs, segment.endMs, segment.text]),
      [[0, 4000, 'Hello there How are you']],
    );
    assert.equal(requestedUrl, env.nvidiaApiUrl, 'Bolt is the default analysis model');

    assert.deepEqual(
      (await refineSegmentsWithAi(sentences, 'gemini')).map((segment) => [segment.startMs, segment.endMs, segment.text]),
      [[0, 4000, 'Hello there How are you']],
    );
    assert.equal(requestedUrl, env.aiApiUrl, 'Gemini uses the Gemini endpoint');

    globalThis.fetch = (async () => new Response('unavailable', { status: 503 })) as typeof fetch;
    assert.deepEqual(await refineSegmentsWithAi(sentences), sentences);
    assert.deepEqual(await refineSegmentsWithAi(sentences, 'gemini'), sentences);

    globalThis.fetch = (async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"sentence_ends":[1,1]}' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    assert.deepEqual(await refineSegmentsWithAi(sentences), sentences);
  } finally {
    env.aiApiKey = originalAiKey;
    env.nvidiaApiKey = originalNvidiaKey;
    globalThis.fetch = originalFetch;
  }
});

test('WebVTT captions are parsed when the track has no json3 variant', () => {
  const vtt = [
    'WEBVTT',
    'Kind: captions',
    'Language: en',
    '',
    '00:00:13.225 --> 00:00:15.353 align:start position:0%',
    'Hey, once upon a younger year',
    '',
    '00:00:15.394 --> 00:00:17.188',
    'When all our shadows disappeared &lt;br&gt;',
    '',
    '00:00:17.230 --> 00:00:20.192',
    '[Music]',
    '',
  ].join('\n');
  const cues = parseVttCues(vtt);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].startMs, 13225);
  assert.equal(cues[0].endMs, 15353);
  assert.equal(cues[0].text, 'Hey, once upon a younger year');
  assert.equal(cues[1].text, 'When all our shadows disappeared');
  assert.equal(MAX_IMPORT_DURATION_SECONDS, 300);
});
