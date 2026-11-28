// Run from backend with: node --import tsx scripts/benchmark-buddy.mjs
import 'dotenv/config';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

process.env.LOG_LEVEL = 'error';
const { env } = await import('../src/config/env.ts');
const { pool } = await import('../src/db/pool.ts');
const { askBuddy, getStudyPlan, sendMessage } = await import('../src/modules/ai/ai.service.ts');
const { createChat, ensureCoachChat, saveConversation } = await import('../src/modules/ai/ai.repository.ts');
const originalFetch = globalThis.fetch;
const execute = pool.execute.bind(pool);
const observation = new AsyncLocalStorage();
const live = process.argv.includes('--live');
const stream = process.argv.includes('--stream');
const evaluate = process.argv.includes('--evaluate');
const silentPrimary = process.argv.includes('--silent-primary');
const selectedCase = process.argv.find((arg) => arg.startsWith('--case='))?.slice('--case='.length);
const mixed = selectedCase === 'mixed learner requests';
const tutorContext = selectedCase === 'tutor context';
const tutorReasoning = selectedCase === 'tutor reasoning';
const tutorBackup = selectedCase === 'tutor backup';
const tutorOpening = selectedCase === 'tutor opening';
const shippedReasoning = process.argv.includes('--shipped-reasoning');
const geminiReasoning = process.argv.includes('--gemini-reasoning');
const geminiIntervalMs = Number(process.env.GEMINI_TUTOR_BENCH_INTERVAL_MS ?? '8000');
const providerDelayMs = 125;
const samplesPerCase = Number(process.env.BUDDY_BENCH_SAMPLES ?? (evaluate ? '1' : live ? '6' : '24'));
const concurrency = Number(process.env.BUDDY_BENCH_CONCURRENCY ?? '1');
assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 12);
assert.ok(Number.isInteger(samplesPerCase) && samplesPerCase >= 1);
assert.ok(!geminiReasoning || (Number.isInteger(geminiIntervalMs) && geminiIntervalMs >= 0));
assert.ok(!evaluate || (live && !selectedCase), 'Use --evaluate with --live and without --case.');
assert.ok(!silentPrimary || (live && stream && (selectedCase === 'coach question' || tutorBackup) && env.thApiKey && env.aiApiKey
  && env.thApiUrl !== env.aiApiUrl), 'Use --silent-primary with --live --stream, a coach question or tutor backup, and two distinct configured providers.');
assert.ok(!tutorBackup || silentPrimary, 'Use --case="tutor backup" with --silent-primary.');
assert.ok(!shippedReasoning || tutorReasoning, 'Use --shipped-reasoning with --case="tutor reasoning".');
assert.ok(!(shippedReasoning && geminiReasoning), 'Gemini reasoning is an A/B experiment only.');
assert.ok(!geminiReasoning || (tutorReasoning && env.aiApiKey && env.aiFallbackModel === 'gemini-3.5-flash'
  && env.aiApiUrl === 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'),
  'Use --gemini-reasoning with the tutor reasoning case and the official Gemini 3.5 Flash fallback.');
assert.ok(!tutorReasoning || (live && stream && (geminiReasoning || (env.thApiKey && /^deepseek-v4\.1-flash-1017\b/.test(env.thModel)))),
  'The tutor reasoning comparison requires --live --stream and a supported configured provider.');
let totalSamples = 0;
let totalPasses = 0;
let reasoningTrial;

if (live) {
  assert.ok(env.thApiKey || env.aiApiKey, 'Configure a Buddy text provider to run the live benchmark.');
  if (geminiReasoning) env.thApiKey = '';
} else {
  env.thApiKey = '';
  env.aiApiKey = 'benchmark-only';
  env.aiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  env.aiDecisionEnabled = true;
}
const providerUrls = new Set([env.aiApiUrl, env.thApiUrl]);
pool.execute = (sql, ...args) => {
  const sample = observation.getStore();
  if (sample && typeof sql === 'string' && /^\s*SELECT\b/i.test(sql)) sample.poolReads++;
  return execute(sql, ...args);
};
globalThis.fetch = async (target, options) => {
  const sample = observation.getStore();
  if (String(target) === env.aiDecisionUrl) {
    sample.classifierCalls++;
    const started = performance.now();
    try {
      if (live) return await originalFetch(target, options);
      await delay(90, undefined, { signal: options.signal });
      return Response.json({ answers: { intent: { choice: 'chat', confidence: 0.98 } } });
    } finally {
      sample.classifierMs += performance.now() - started;
    }
  }
  assert.ok(providerUrls.has(String(target)), 'Expected a text completion request.');
  const request = JSON.parse(options.body);
  const { messages, stream: requestedStream } = request;
  if (tutorReasoning && String(target) === (geminiReasoning ? env.aiApiUrl : env.thApiUrl)) {
    if (!shippedReasoning) {
      if (reasoningTrial === 'default') delete request.reasoning_effort;
      else request.reasoning_effort = reasoningTrial;
      options = { ...options, body: JSON.stringify(request) };
    }
    sample.reasoningEffort = request.reasoning_effort ?? (geminiReasoning ? 'default' : undefined);
  }
  sample.providerStarted ??= performance.now();
  sample.modelCalls++;
  sample.promptBytes += messages.reduce((sum, message) => sum + Buffer.byteLength(message.content), 0);
  if (silentPrimary && String(target) === env.thApiUrl) {
    await delay(20_000, undefined, { signal: options.signal });
    throw new Error('The silent fixture outlasted the provider deadline.');
  }
  if (live) {
    const response = await originalFetch(target, options);
    if (response.ok) {
      const copy = response.clone();
      sample.usage.push(copy.headers.get('content-type')?.includes('text/event-stream')
        ? copy.text().then((body) => body.split(/\r?\n/).filter((line) => line.startsWith('data: {'))
          .map((line) => JSON.parse(line.slice(6))).findLast(({ usage }) => usage)?.usage).catch(() => null)
        : copy.json().then(({ usage }) => usage).catch(() => null));
    }
    return response;
  }
  let reply = 'Start with the first item in your study plan.';
  let feedback = [];
  if (messages.at(-1)?.content === 'How many items are due for review?') {
    const learnerData = /^LEARNER_DATA_JSON: (.+)$/m.exec(messages[0].content)?.[1];
    reply = `You have ${JSON.parse(learnerData ?? '{}').review_due ?? 0} item to review.`;
  }
  if (messages.at(-1)?.content === 'What example did we use about Kyoto sightseeing earlier?') {
    const evidence = /^RELEVANT_PAST_TURNS_JSON: (.+)$/m.exec(messages[0].content)?.[1] ?? '';
    reply = evidence.includes('We toured Kyoto before sunrise.')
      ? 'We toured Kyoto before sunrise.' : 'I do not have the earlier example.';
  }
  if (tutorContext && messages.at(-1)?.content === 'What did we do after class?') {
    reply = messages.slice(1, -1).some(({ content }) => content.includes('rehearsed for the school play'))
      ? 'We rehearsed for the school play.' : 'I do not have that detail.';
  }
  if (tutorContext && messages.at(-1)?.content === 'Yesterday I goed to school.') {
    reply = 'What did you do at school?';
    feedback = [{ type: 'TENSE', original_text: 'goed', corrected_text: 'went', explanation: '“Went” là dạng quá khứ của “go”.' }];
  }
  const content = JSON.stringify({ reply, feedback });
  if (requestedStream) {
    const encoder = new TextEncoder();
    const event = (entry) => encoder.encode(`data: ${JSON.stringify(entry)}\n\n`);
    return new Response(new ReadableStream({
      async start(controller) {
        await delay(50);
        controller.enqueue(event({ choices: [{ delta: { content: content.slice(0, 30) } }] }));
        await delay(providerDelayMs - 50);
        controller.enqueue(event({ choices: [{ delta: { content: content.slice(30) }, finish_reason: 'stop' }] }));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    }), { headers: { 'Content-Type': 'text/event-stream' } });
  }
  await delay(providerDelayMs, undefined, { signal: options.signal });
  return Response.json({
    choices: [{ message: { content } }],
  });
};

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] * 10) / 10;
}

async function measure(name, run, passes, prepare) {
  if (selectedCase && selectedCase !== name) return;
  const newSample = () => ({ modelCalls: 0, classifierCalls: 0, classifierMs: 0, promptBytes: 0, poolReads: 0, usage: [] });
  if (!evaluate) {
    await prepare?.(-1);
    const warmup = await observation.run(newSample(), () => run(stream ? () => {} : undefined));
    if (warmup?.failureStatus) console.log(JSON.stringify({ name, warmup_failure_status: warmup.failureStatus }));
  }
  const samples = [];
  const parallel = prepare ? 1 : concurrency;
  for (let offset = 0; offset < samplesPerCase; offset += parallel) {
    const batchSize = Math.min(samplesPerCase - offset, parallel);
    await prepare?.(offset);
    samples.push(...await Promise.all(Array.from({ length: batchSize }, (_, index) => {
      const sample = newSample();
      return observation.run(sample, async () => {
        const started = performance.now();
        let firstDraft;
        const result = await run(stream ? (text) => {
          if (text) firstDraft ??= performance.now() - started;
        } : undefined, offset + index);
        const elapsed = performance.now() - started;
        const passed = passes(result);
        if (!passed && process.argv.includes('--inspect-failures') && result.reply) {
          console.log(JSON.stringify({ name, scenario: result.scenario, ...(result.arm && { arm: result.arm }),
            fixture_reply: result.reply, action_kind: result.action?.kind,
            ...(result.failureStatus && { failure_status: result.failureStatus, elapsed_ms: Math.round(elapsed) }),
            action_choices: result.actions?.map(({ kind }) => kind) }));
        }
        if (tutorReasoning && elapsed >= 4_000) {
          console.log(JSON.stringify({ scenario: result.scenario, arm: result.arm,
            slow_final_ms: Math.round(elapsed), slow_first_text_ms: firstDraft === undefined ? null : Math.round(firstDraft) }));
        }
        return { ...sample, scenario: result.scenario, arm: result.arm, failureStatus: result.failureStatus, firstDraft, elapsed, passed,
          preProvider: sample.providerStarted === undefined ? undefined : sample.providerStarted - started,
          usage: (await Promise.all(sample.usage)).filter(Boolean) };
      });
    })));
  }
  const successes = samples.filter(({ passed }) => passed).length;
  totalSamples += samples.length;
  totalPasses += successes;
  report(name, samples);
  if (tutorReasoning) {
    for (const arm of new Set(samples.map((sample) => sample.arm))) {
      report(name, samples.filter((sample) => sample.arm === arm), { arm });
    }
  }
  if (mixed || tutorContext || tutorReasoning || tutorOpening) {
    for (const scenario of new Set(samples.map((sample) => sample.scenario))) {
      const group = samples.filter((sample) => sample.scenario === scenario);
      const elapsed = group.filter(({ failureStatus }) => !failureStatus).map((sample) => sample.elapsed);
      console.log(JSON.stringify({ scenario, samples: group.length, successes: group.filter(({ passed }) => passed).length,
        p50_ms: elapsed.length ? percentile(elapsed, 0.5) : null,
        model_calls: group.reduce((total, { modelCalls }) => total + modelCalls, 0) }));
    }
  }
}

function report(name, samples, extra = {}) {
  const sum = (key) => samples.reduce((total, sample) => total + sample[key], 0);
  const generation = samples.filter(({ preProvider }) => preProvider !== undefined);
  const classified = samples.filter(({ classifierCalls }) => classifierCalls > 0);
  const completed = samples.filter(({ failureStatus }) => !failureStatus);
  const failures = samples.filter(({ failureStatus }) => failureStatus);
  const usage = samples.flatMap((sample) => sample.usage);
  const cacheReports = usage.flatMap((entry) => {
    const cached = entry.prompt_cache_hit_tokens ?? entry.prompt_tokens_details?.cached_tokens ?? entry.cache_read_input_tokens;
    return Number.isInteger(cached) && Number.isInteger(entry.prompt_tokens)
      ? [{ cached, total: entry.prompt_tokens }] : [];
  });
  const cacheInput = cacheReports.reduce((total, entry) => total + entry.total, 0);
  const cacheReads = cacheReports.reduce((total, entry) => total + entry.cached, 0);
  console.log(JSON.stringify({
    name, ...extra,
    samples: samples.length,
    p50_ms: completed.length ? percentile(completed.map(({ elapsed }) => elapsed), 0.5) : null,
    p95_ms: completed.length ? percentile(completed.map(({ elapsed }) => elapsed), 0.95) : null,
    first_text_p50_ms: completed.length ? percentile(completed.map(({ firstDraft, elapsed }) => firstDraft ?? elapsed), 0.5) : null,
    ...(tutorReasoning && { first_text_p95_ms: completed.length ? percentile(completed.map(({ firstDraft, elapsed }) => firstDraft ?? elapsed), 0.95) : null }),
    preview_responses: samples.filter(({ firstDraft }) => firstDraft !== undefined).length,
    ...(failures.length && { failed_requests: failures.length, failure_statuses: [...new Set(failures.map(({ failureStatus }) => failureStatus))] }),
    model_calls: sum('modelCalls'),
    model_free_responses: samples.filter(({ modelCalls }) => modelCalls === 0).length,
    classifier_calls: sum('classifierCalls'),
    prompt_bytes_per_request: Math.round(sum('promptBytes') / samples.length),
    pool_reads_per_request: sum('poolReads') / samples.length,
    successes: samples.filter(({ passed }) => passed).length,
    ...(generation.length && { pre_provider_p50_ms: percentile(generation.map(({ preProvider }) => preProvider), 0.5) }),
    ...(classified.length && { classifier_p50_ms: percentile(classified.map(({ classifierMs }) => classifierMs), 0.5) }),
    ...(tutorReasoning && { reasoning_efforts: [...new Set(samples.map(({ reasoningEffort }) => reasoningEffort))] }),
    ...(live ? {
      usage_reports: usage.length,
      prompt_tokens: usage.length ? usage.reduce((sum, entry) => sum + (entry.prompt_tokens ?? 0), 0) : null,
      completion_tokens: usage.length ? usage.reduce((sum, entry) => sum + (entry.completion_tokens ?? 0), 0) : null,
      ...(geminiReasoning && { total_tokens: usage.length ? usage.reduce((sum, entry) => sum + (entry.total_tokens ?? 0), 0) : null }),
      cache_reports: cacheReports.length,
      cache_token_share: cacheInput ? Number((cacheReads / cacheInput).toFixed(3)) : null,
      cache_hit_requests: cacheReports.filter((entry) => entry.cached > 0).length,
    } : {}),
  }));
}

const id = randomUUID();
let userId;
let videoId;
let publicVideoId;
const distractorCodes = [];
const mixedVideoIds = [];
const reasoningUserIds = [];
try {
  console.log(JSON.stringify({ provider: live ? 'configured' : 'fixture', ...(!live && { providerDelayMs }), stream, concurrency,
    ...(silentPrimary && { silentPrimary: true }), ...(geminiReasoning && { geminiIntervalMs }) }));
  const [user] = await execute(
    'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
    [`bench-${id.slice(0, 12)}`, `bench-${id}@example.test`, 'benchmark fixture', 'Buddy benchmark'],
  );
  userId = user.insertId;
  const [video] = await execute(
    `INSERT INTO video_lessons
      (code, title, topic, cefr_level, provider, video_url, duration_seconds, xp_reward, sort_order, owner_user_id)
      VALUES (?, 'Benchmark listening practice', 'Daily conversation', 'A1', 'youtube',
              'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 60, 10, 0, ?)`,
    [id, userId],
  );
  videoId = video.insertId;
  const [publicVideo] = await execute(
    `INSERT INTO video_lessons
      (code, title, topic, cefr_level, provider, video_url, duration_seconds, xp_reward, sort_order, published_at)
      VALUES (?, 'Benchmark grocery shopping dialogue', 'Grocery shopping', 'A2', 'youtube',
              'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ?, 10, 65535, NOW())`,
    [randomUUID(), mixed ? 75 : 3600],
  );
  publicVideoId = publicVideo.insertId;
  if (mixed) {
    for (const [title, level, duration] of [['Long supermarket dialogue', 'A2', 480], ['Starter grocery dialogue', 'A1', 60]]) {
      const [item] = await execute(
        `INSERT INTO video_lessons
          (code, title, topic, cefr_level, provider, video_url, duration_seconds, xp_reward, sort_order, published_at)
          VALUES (?, ?, 'Grocery shopping', ?, 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ?, 10, 65535, NOW())`,
        [randomUUID(), title, level, duration],
      );
      mixedVideoIds.push(item.insertId);
    }
  }
  if (selectedCase === 'catalogue retrieval prompt') {
    distractorCodes.push(...Array.from({ length: 40 }, () => randomUUID()));
    await execute(
      `INSERT INTO video_lessons
        (code, title, topic, cefr_level, provider, video_url, duration_seconds, xp_reward, sort_order, published_at)
        VALUES ${distractorCodes.map(() => "(?, 'Benchmark workplace dialogue', 'Meetings', 'A2', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 3600, 10, 65535, NOW())").join(', ')}`,
      distractorCodes,
    );
  }
  const [[question]] = await execute('SELECT id FROM questions ORDER BY id LIMIT 1');
  assert.ok(question, 'Load the Engorace curriculum before benchmarking.');
  await execute(
    "INSERT INTO review_items (user_id, kind, ref_id, source, due_at) VALUES (?, 'question', ?, 'manual', NOW())",
    [userId, question.id],
  );
  await execute(
    "INSERT INTO saved_words (user_id, video_id, word, meaning_vi) VALUES (?, ?, 'resilient', 'Ghi chú ôn tập của Minh')",
    [userId, videoId],
  );
  if (mixed) {
    assert.ok(samplesPerCase >= 12, 'The mixed workload needs at least 12 measured turns.');
    const includesPublic = ({ action, actions }) => action === null && actions?.some(({ videoId }) => videoId === publicVideoId)
      && !actions.some(({ videoId }) => videoId === mixedVideoIds[1]);
    const shortOnly = ({ action, actions }) => action === null && actions?.length === 1 && actions[0].videoId === publicVideoId;
    const tasks = [
      ['English availability', 'Any A2 videos about grocery shopping?', includesPublic],
      ['Vietnamese availability', 'Có video A2 nào về đi siêu thị không?', includesPublic],
      ['English duration recommendation', 'Could you recommend a short video about grocery shopping A2 under 5 minutes?', shortOnly],
      ['Vietnamese duration recommendation', 'Gợi ý video A2 về đi siêu thị không quá 2 phút.', shortOnly],
      ['Open with time limit', 'Find a video about grocery shopping A2 under 2 minutes.', ({ action }) => action?.videoId === publicVideoId],
      ['Unavailable level', 'Any B2 videos about grocery shopping?', ({ action, actions, reply }) =>
        action === null && !actions?.length && /\b(?:couldn.t find|no|none)\b/i.test(reply)],
      ['Private recommendation', 'Any of my private A1 videos about daily conversation?', ({ action, actions }) =>
        action === null && actions?.length === 1 && actions[0].videoId === videoId],
      ['English study budget', 'What can I study in ten minutes?', ({ actions, reply }) =>
        actions?.[0]?.kind === 'open_review' && /of 10 minutes/i.test(reply)],
      ['Vietnamese study budget', 'Trong 10 phút, mình nên học gì?', ({ actions, reply }) =>
        actions?.[0]?.kind === 'open_review' && /\/10 phút/u.test(reply)],
      ['Coach conversation', 'How can I use the past simple in a conversation?', ({ reply, action }) =>
        action === null && /past simple|yesterday/i.test(reply)],
      ['Tense comparison', 'Compare past simple and present perfect, and give contrasting examples about travel.', ({ reply }) =>
        /past simple/i.test(reply) && /present perfect/i.test(reply)],
      ['Compound turn', 'Open my vocabulary notebook, then open my review queue, and remind me in 20 minutes to review vocabulary.', ({ actions, suggestion }) =>
        actions?.[0]?.kind === 'open_notebook' && actions?.[1]?.kind === 'open_review' && suggestion?.in_minutes === 20],
    ];
    await measure('mixed learner requests', async (onDraft, index = 0) => {
      const [scenario, message, check] = tasks[index % tasks.length];
      const answer = await askBuddy(userId, message, 'chat', { tab: 'study' }, undefined, onDraft);
      return { ...answer, scenario, correct: Boolean(check(answer)) };
    }, ({ correct }) => correct);
  }
  await measure('standalone greeting',
    () => askBuddy(userId, 'Hello', 'chat', null),
    (answer) => answer.language === 'en' && answer.action === null && answer.reply.startsWith('Hi'));
  if (selectedCase === 'spoken greeting and check-in') {
    await measure('spoken greeting and check-in',
      (onDraft) => askBuddy(userId, 'Good morning. How are you today?', 'chat', { tab: 'study' }, undefined, onDraft),
      ({ language, action, reply }) => language === 'en' && action === null
        && /\bgood morning\b/iu.test(reply) && /\b(?:thanks|thank you|doing well|doing great)\b/iu.test(reply));
  }
  await measure('random private video',
    () => askBuddy(userId, 'Open a random private video', 'chat', { tab: 'videos' }),
    (answer) => answer.action?.kind === 'open_video' && answer.action.videoId === videoId);
  await measure('due review count',
    () => askBuddy(userId, 'How many items are due for review?', 'chat', { tab: 'profile' }),
    (answer) => /\b1\b.*\b(?:item|review)\b/i.test(answer.reply) && answer.action === null);
  if (evaluate || selectedCase === 'timed study plan') {
    await measure('timed study plan',
      () => askBuddy(userId, 'I only have ten minutes. What should I study first?', 'chat', { tab: 'study' }),
      ({ action, actions, reply }) => action === null && actions?.[0]?.kind === 'open_review'
        && /of 10 minutes/u.test(reply));
  }
  await measure('saved vocabulary lookup',
    () => askBuddy(userId, 'What does resilient mean in my notebook?', 'chat', { tab: 'videos' }),
    (answer) => answer.reply.includes('Ghi chú ôn tập của Minh') && answer.action === null);
  await measure('bilingual video recommendation',
    () => askBuddy(userId, 'Gợi ý video về đi siêu thị A2.', 'chat', { tab: 'study' }),
    (answer) => answer.action === null && answer.actions?.some(({ kind, videoId }) =>
      kind === 'open_video' && videoId === publicVideoId));
  await measure('catalogue retrieval prompt',
    () => askBuddy(userId, 'Find a video about grocery shopping A2.', 'chat', { tab: 'study' }),
    (answer) => answer.action?.videoId === publicVideoId);
  await measure('ordinal follow-up',
    () => askBuddy(userId, 'Open the second one.', 'chat', { tab: 'study' }),
    (answer) => answer.action?.kind === 'open_video' && answer.action.videoId === videoId,
    async () => saveConversation(userId, await ensureCoachChat(userId), 'Show both my notebook and the listening video.',
      'I found your notebook and the listening exercise.', [], [
        { kind: 'open_notebook', tab: 'videos', label: 'Notebook', highlight: 'control:notebook' },
        { kind: 'open_video', tab: 'videos', label: 'Listening exercise', videoId },
      ]));
  if (selectedCase === 'earlier learning example') {
    await measure('earlier learning example',
      (onDraft) => askBuddy(userId, 'What example did we use about Kyoto sightseeing earlier?', 'chat', { tab: 'study' }, undefined, onDraft),
      ({ reply }) => reply.includes('We toured Kyoto before sunrise.'),
      async () => {
        const coachId = await ensureCoachChat(userId);
        await saveConversation(userId, coachId, 'For Kyoto sightseeing I wrote: “We toured Kyoto before sunrise.”',
          'That is a good simple past example.', []);
        for (let index = 0; index < 6; index++) {
          await saveConversation(userId, coachId, 'Let’s talk about food.', 'What do you like to eat?', []);
        }
      });
  }
  await measure('coach question',
    (onDraft) => askBuddy(userId, 'How can I use the past simple in a conversation?', 'chat', { tab: 'study' }, undefined, onDraft),
    (answer) => answer.action === null && (live
      ? /past|quá khứ|yesterday|verb/i.test(answer.reply)
      : answer.reply === 'Start with the first item in your study plan.'));
  if (tutorContext) {
    const kyotoExample = 'We toured Kyoto before sunrise.';
    const recallQuestion = 'What example did we use about Kyoto sightseeing earlier?';
    const tasks = [
      ['Older example', recallQuestion, ({ aiMessage }) => aiMessage.content.includes(kyotoExample.slice(0, -1))],
      ['Recent follow-up', 'What did we do after class?', ({ aiMessage }) => /rehears|school play/i.test(aiMessage.content)],
      ['Missing example', recallQuestion, ({ aiMessage }) => !aiMessage.content.includes(kyotoExample.slice(0, -1))
        && /(?:don.t|do not) (?:have|see|remember)|can.t (?:find|see|remember)|haven.t|no (?:earlier|previous|example)|not (?:available|in this|remember)|không (?:thấy|có|nhớ)/iu.test(aiMessage.content)],
      ['Grammar correction', 'Yesterday I goed to school.', ({ feedback }) => feedback.some(({ corrected_text }) => /\bwent\b/i.test(corrected_text))],
    ];
    assert.ok(samplesPerCase >= tasks.length, 'The tutor workload needs at least four measured turns.');
    let chat;
    let task;
    await measure('tutor context', async (onDraft) => {
      const [scenario, message, check] = task;
      const result = await sendMessage(userId, chat.id, message, 'chat', null, undefined, onDraft);
      return { ...result, scenario, reply: result.aiMessage.content, correct: result.action === null && check(result) };
    }, ({ correct }) => correct, async (index) => {
      task = tasks[Math.max(0, index) % tasks.length];
      chat = await createChat(userId, 'DAILY_CONVERSATION');
      if (task[0] === 'Older example') {
        await saveConversation(userId, chat.id, `For Kyoto sightseeing I wrote: “${kyotoExample}”`, 'That is a good use of the simple past.', []);
      }
      if (task[1] === recallQuestion) {
        for (let index = 0; index < 6; index++) {
          await saveConversation(userId, chat.id, 'I like orange juice.', 'Do you usually drink juice with breakfast?', []);
        }
      }
      if (task[0] === 'Recent follow-up') {
        await saveConversation(userId, chat.id, 'After math class, we rehearsed for the school play.', 'Which part did you play?', []);
      }
    });
  }
  if (selectedCase === 'complex grammar') {
    await measure('complex grammar',
      (onDraft) => askBuddy(userId,
        'Compare past simple and present perfect, explain when each applies, and give two contrasting examples about travel.',
        'chat', { tab: 'study' }, undefined, onDraft),
      ({ reply }) => /\bpast simple\b/i.test(reply) && /\bpresent perfect\b/i.test(reply)
        && /\b(?:yesterday|last|finished|specific time|in \d{4})\b/i.test(reply)
        && /\b(?:have|has)\s+\w+/i.test(reply)
        && /\b(?:now|unfinished|present|already|ever|yet|so far|experience|result)\b/i.test(reply));
  }
  if (tutorReasoning) {
    const noCorrection = (pattern) => ({ aiMessage, feedback }) => feedback.length === 0 && pattern.test(aiMessage.content);
    const corrected = (pattern) => ({ feedback }) => feedback.some(({ corrected_text, explanation }) =>
      pattern.test(corrected_text) && Boolean(explanation.trim()));
    const tasks = [
      ['Greeting', 'Hello!', noCorrection(/\b(?:hi|hello|hey|nice to|how are|welcome)\b/i)],
      ['Ordinary conversation', 'I went to school yesterday.', noCorrection(/school|yesterday|class|learn|stud(?:y|ied)|there|go/i)],
      ['Recent reference', 'I enjoyed it.', noCorrection(/pho|phở|soup|food|lunch|recipe|dish|taste|flavou?r|broth|noodles|cuisine/iu)],
      ['Irregular past', 'Yesterday I goed to school.', corrected(/\bwent\b/i)],
      ['Subject agreement', 'My brother go to school every day.', corrected(/\bgoes\b/i)],
      ['Word order', 'I very like this song.', corrected(/really like|like .+ (?:very much|a lot)|love/i)],
      ['Correct present perfect', 'I have lived here for three years.', noCorrection(/here|three years|live|living|move|place|city|like|stay/i)],
      ['Plural agreement', 'We bought two apple yesterday.', corrected(/\bapples\b/i)],
    ];
    assert.ok(samplesPerCase % (tasks.length * (shippedReasoning ? 1 : 2)) === 0,
      'Use whole rounds of the eight tutor cases in each arm.');
    let chat;
    let task;
    let lastStart = -Infinity;
    const standardEffort = geminiReasoning ? 'default' : 'low';
    const briefEffort = geminiReasoning ? 'minimal' : 'none';
    await measure('tutor reasoning', async (onDraft) => {
      const [scenario, message, check] = task;
      const metrics = observation.getStore();
      const expected = !shippedReasoning ? reasoningTrial : scenario === 'Recent reference' ? standardEffort : briefEffort;
      try {
        const result = await sendMessage(chat.userId, chat.id, message, 'chat', null, undefined, onDraft);
        return { ...result, scenario, arm: expected, reply: result.aiMessage.content,
          correct: result.action === null && metrics.modelCalls === 1 && metrics.classifierCalls === 0
            && metrics.reasoningEffort === expected && check(result) };
      } catch (error) {
        if (!Number.isInteger(error?.statusCode)) throw error;
        return { scenario, arm: expected, reply: error.message, failureStatus: error.statusCode, correct: false };
      }
    }, ({ correct }) => correct, async (index) => {
      const offset = Math.max(0, index);
      const pair = shippedReasoning ? offset : Math.floor(offset / 2);
      reasoningTrial = (offset + pair) % 2 === 0 ? standardEffort : briefEffort;
      task = tasks[pair % tasks.length];
      const key = randomUUID();
      const [learner] = await execute(
        'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
        [`tutor-${key.slice(0, 12)}`, `tutor-${key}@example.test`, 'benchmark fixture', 'Tutor benchmark'],
      );
      reasoningUserIds.push(learner.insertId);
      const thread = await createChat(learner.insertId, 'DAILY_CONVERSATION');
      chat = { id: thread.id, userId: learner.insertId };
      if (task[0] === 'Recent reference') {
        await saveConversation(chat.userId, chat.id, 'We ordered pho for lunch.', 'How was the pho?', []);
      }
      if (task[0] === 'Greeting') {
        await saveConversation(chat.userId, chat.id, 'I like talking about my day.', 'What do you usually do in the morning?', []);
      }
      if (geminiReasoning) {
        await delay(Math.max(0, geminiIntervalMs - (performance.now() - lastStart)));
        lastStart = performance.now();
      }
    });
  }
  if (tutorBackup) {
    const tutorChats = await Promise.all(Array.from({ length: samplesPerCase + 1 }, () => createChat(userId, 'DAILY_CONVERSATION')));
    await measure('tutor backup', async (onDraft, index = -1) => {
      try {
        const result = await sendMessage(userId, tutorChats[index + 1].id, 'Yesterday I goed to school.', 'chat', null, undefined, onDraft);
        return { ...result, reply: result.aiMessage.content };
      } catch (error) {
        if (!Number.isInteger(error?.statusCode)) throw error;
        return { failureStatus: error.statusCode, reply: error.message, action: null, feedback: [] };
      }
    }, ({ action, feedback }) => action === null && feedback.some(({ corrected_text }) => /\bwent\b/i.test(corrected_text)));
  }
  if (tutorOpening) {
    const topics = [
      ['DAILY_CONVERSATION', /day|today|doing|recently|happening|everyday/i],
      ['TRAVEL', /travel|visit|trip|country|place|holiday|vacation|destination/i],
      ['FOOD', /food|eat|cook|dish|meal|lunch|dinner/i],
      ['SHOPPING', /shop|buy|store|purchase|looking for/i],
      ['SCHOOL', /school|subject|class|study|learn/i],
      ['FAMILY', /family|brother|sister|parent|sibling/i],
      ['HOBBIES', /hobb|free time|fun|enjoy|weekend|activity/i],
      ['JOB_INTERVIEW', /interview|job|work|position|role|about yourself/i],
    ];
    let topic;
    let chat;
    await measure('tutor opening', async (onDraft) => {
      const [scenario, check] = topic;
      try {
        const result = await sendMessage(userId, chat.id, 'Hello!', 'chat', null, undefined, onDraft);
        const reply = result.aiMessage.content;
        return { ...result, scenario, reply, correct: result.action === null && result.feedback.length === 0
          && check.test(reply) && (reply.match(/\?/g) ?? []).length === 1 };
      } catch (error) {
        if (!Number.isInteger(error?.statusCode)) throw error;
        return { scenario, failureStatus: error.statusCode, reply: error.message, correct: false };
      }
    }, ({ correct }) => correct, async (index) => {
      topic = topics[Math.max(0, index) % topics.length];
      chat = await createChat(userId, topic[0]);
    });
  }
  if (!selectedCase || selectedCase === 'ordinary tutor conversation') {
    const tutor = await createChat(userId, 'DAILY_CONVERSATION');
    await measure('ordinary tutor conversation',
      (onDraft) => sendMessage(userId, tutor.id, 'I went to school yesterday.', 'chat', null, undefined, onDraft),
      (answer) => answer.action === null && (live ? Boolean(answer.aiMessage.content.trim())
        : answer.aiMessage.content === 'Start with the first item in your study plan.'));
  }
  if (selectedCase === 'coach chat recommendation') {
    const coach = await createChat(userId, 'STUDY_COACH');
    await measure('coach chat recommendation',
      () => sendMessage(userId, coach.id, 'Gợi ý video về đi siêu thị A2.', 'chat', { tab: 'study' }),
      ({ action, actions }) => action === null && actions?.some(({ videoId }) => videoId === publicVideoId));
  }
  await measure('study plan note', () => getStudyPlan(userId),
    (plan) => plan.steps.length > 0 && (live
      ? Boolean(plan.aiNote?.trim())
      : plan.aiNote === 'Start with the first item in your study plan.'));
  if (evaluate || selectedCase) {
    const ask = (message, tab = 'study') =>
      (onDraft) => askBuddy(userId, message, 'chat', { tab }, undefined, onDraft);
    await measure('Vietnamese navigation', ask('Mở Dịch tài liệu.'),
      ({ action }) => action?.kind === 'open_tab' && action.tab === 'translate');
    await measure('lesson discovery', ask('Gợi ý một bài học về phỏng vấn xin việc.'),
      ({ action, actions }) => action === null && actions?.some(({ lessonTitle }) => lessonTitle === 'Phỏng vấn xin việc'));
    await measure('shop item discovery', ask('Find a streak shield in the shop.', 'shop'),
      ({ action }) => action?.kind === 'show_shop_item' && action.itemCode === 'booster_streak_shield');
    await measure('structured practice',
      ask('Give me one fill-in-the-blank exercise about the past simple. Put the answer at the end.'),
      ({ action, reply }) => action === null && /(?:_{2,}|\(blank\)|\[blank\])/i.test(reply) && /\banswer\b/i.test(reply));
    await measure('grammar correction', ask('Yesterday I goed to school. Is that sentence correct?'),
      ({ action, feedback }) => action === null && feedback.some(({ corrected_text }) => /\bwent\b/i.test(corrected_text)));
    await measure('review and notebook with reminder',
      ask('Open my vocabulary notebook, then open my review queue, and remind me in 20 minutes to review vocabulary.'),
      ({ actions, suggestion }) => actions?.some(({ kind }) => kind === 'open_review')
        && actions.some(({ kind }) => kind === 'open_notebook') && suggestion?.in_minutes === 20);
    if (evaluate) {
      console.log(JSON.stringify({ evaluation: 'named task checks', successes: totalPasses, samples: totalSamples }));
      if (totalPasses < totalSamples) process.exitCode = 1;
    }
  }
  if (!totalSamples) throw new Error(`Unknown benchmark case ${selectedCase}.`);
  if ((silentPrimary || process.argv.includes('--require-pass')) && totalPasses < totalSamples) process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  try {
    if (distractorCodes.length) {
      await execute(`DELETE FROM video_lessons WHERE code IN (${distractorCodes.map(() => '?').join(', ')})`, distractorCodes);
    }
    if (mixedVideoIds.length) {
      await execute(`DELETE FROM video_lessons WHERE id IN (${mixedVideoIds.map(() => '?').join(', ')})`, mixedVideoIds);
    }
    if (publicVideoId) await execute('DELETE FROM video_lessons WHERE id = ?', [publicVideoId]);
    if (videoId) await execute('DELETE FROM video_lessons WHERE id = ?', [videoId]);
    if (reasoningUserIds.length) {
      await execute(`DELETE FROM users WHERE id IN (${reasoningUserIds.map(() => '?').join(', ')})`, reasoningUserIds);
    }
    if (userId) await execute('DELETE FROM users WHERE id = ?', [userId]);
  } finally {
    await pool.end();
  }
}
