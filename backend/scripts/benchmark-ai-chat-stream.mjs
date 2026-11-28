// Run against a development database from backend.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import jwt from 'jsonwebtoken';

process.env.LOG_LEVEL = 'error';
const { env } = await import('../src/config/env.ts');
const { app } = await import('../src/app.ts');
const { pool } = await import('../src/db/pool.ts');
const { getVerifiedJwtSecret } = await import('../src/modules/auth/auth.service.ts');

const live = process.argv.includes('--live');
const destinations = process.argv.includes('--destinations');
const plan = process.argv.includes('--plan');
const mode = process.argv.find((argument) => argument.startsWith('--mode='))?.slice(7) ?? 'both';
const repeats = Number(process.env.AI_CHAT_BENCH_SAMPLES ?? '6');
assert.ok(['json', 'stream', 'both'].includes(mode));
assert.ok(!(plan && destinations), 'Choose one benchmark task.');
assert.ok(Number.isInteger(repeats) && repeats > 0);
assert.ok(!live || env.thApiKey || env.aiApiKey, 'Configure a generation provider for --live.');
const streamReaders = mode !== 'json' && await import('../../mobile/services/aiReplyStream.ts');
const mobileDestinations = destinations && await import('../../mobile/services/aiDestinations.ts');
const originalFetch = globalThis.fetch;
const providerUrls = new Set([env.thApiUrl, env.aiApiUrl]);
const execute = pool.execute;
const fixtureReply = plan ? 'Bắt đầu với bài đang mở. Bài này tiếp nối tiến độ hiện tại của bạn.'
  : 'Use the past simple for completed actions, as in “I walked home yesterday.”';
if (!live) {
  env.thApiKey = 'fixture-chat';
  env.thApiUrl = 'https://tokenharbor.ai/v1/chat/completions';
  providerUrls.add(env.thApiUrl);
}
let current;
pool.execute = function (sql, ...args) {
  if (current && typeof sql === 'string' && /^\s*SELECT\b/i.test(sql)) current.reads++;
  return execute.call(this, sql, ...args);
};
globalThis.fetch = async (input, options) => {
  if (!providerUrls.has(String(input))) return originalFetch(input, options);
  current.calls++;
  const { messages, stream } = JSON.parse(options.body);
  current.bytes += messages.reduce((total, { content }) => total + Buffer.byteLength(content), 0);
  if (live) {
    const response = await originalFetch(input, options);
    if (response.ok) {
      const copy = response.clone();
      current.usage.push(copy.headers.get('content-type')?.includes('text/event-stream')
        ? copy.text().then((text) => text.split(/\r?\n/).filter((line) => line.startsWith('data: {'))
          .map((line) => JSON.parse(line.slice(6))).findLast(({ usage }) => usage)?.usage).catch(() => null)
        : copy.json().then(({ usage }) => usage).catch(() => null));
    }
    return response;
  }
  if (!stream) {
    await delay(600, undefined, { signal: options.signal });
    return Response.json({ choices: [{ message: { content: JSON.stringify({ reply: fixtureReply, feedback: [] }) } }] });
  }
  const encoder = new TextEncoder();
  const event = (content) => encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
  return new Response(new ReadableStream({
    async start(controller) {
      await delay(200, undefined, { signal: options.signal });
      controller.enqueue(event(`{"reply":"${fixtureReply.slice(0, 28)}`));
      await delay(400, undefined, { signal: options.signal });
      controller.enqueue(event(`${fixtureReply.slice(28)}","feedback":[]}`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
};

function summarize(mode, samples) {
  const round = (value) => Math.round(value * 10) / 10;
  const percentile = (key, fraction) => round(samples.map((sample) => sample[key]).sort((a, b) => a - b)
    [Math.ceil(samples.length * fraction) - 1]);
  const total = (key) => samples.reduce((sum, sample) => sum + sample[key], 0);
  const usage = samples.flatMap((sample) => sample.usage);
  const spent = (key) => usage.length ? usage.reduce((sum, report) => sum + (report[key] ?? 0), 0) : null;
  const cache = usage.map((entry) => ({
    total: entry.prompt_tokens,
    hit: entry.prompt_cache_hit_tokens ?? entry.prompt_tokens_details?.cached_tokens ?? entry.cache_read_input_tokens,
  })).filter(({ total, hit }) => Number.isInteger(total) && Number.isInteger(hit));
  const cacheInput = cache.reduce((sum, { total }) => sum + total, 0);
  return {
    mode, samples: samples.length, successes: total('passed'), drafts: total('draft'),
    ttft_p50_ms: percentile('ttft', 0.5), ttft_p95_ms: percentile('ttft', 0.95),
    final_p50_ms: percentile('elapsed', 0.5), final_p95_ms: percentile('elapsed', 0.95),
    model_calls: total('calls'), pool_reads_per_request: total('reads') / samples.length,
    prompt_bytes_per_request: Math.round(total('bytes') / samples.length),
    prompt_tokens: spent('prompt_tokens'), completion_tokens: spent('completion_tokens'),
    cache_hit_requests: cache.filter(({ hit }) => hit > 0).length,
    cache_reports: cache.length,
    cache_hit_token_share: cacheInput ? cache.reduce((sum, { hit }) => sum + hit, 0) / cacheInput : null,
  };
}

const modes = mode === 'both' ? ['json', 'stream'] : [mode];
const results = Object.fromEntries(modes.map((name) => [name, []]));
const userIds = [];
let server;
async function createLearnerHeaders() {
  const id = randomUUID();
  const [user] = await pool.execute(
    'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
    [`chat-${id.slice(0, 12)}`, `chat-${id}@example.test`, 'benchmark fixture', 'AI chat benchmark'],
  );
  userIds.push(user.insertId);
  const token = jwt.sign({}, getVerifiedJwtSecret(), { subject: String(user.insertId), expiresIn: '10m' });
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}
try {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const chatHeaders = plan ? null : await createLearnerHeaders();
  for (let index = 0; index <= repeats; index++) {
    const order = index % 2 === 0 ? modes : [...modes].reverse();
    for (const name of order) {
      // Separate learners expose each plan's cold note without altering its prompt.
      const headers = chatHeaders ?? await createLearnerHeaders();
      let chatId;
      if (!plan) {
        const response = await originalFetch(`${origin}/api/ai/chats`, {
          method: 'POST', headers, body: JSON.stringify({ topic: 'STUDY_COACH' }),
        });
        assert.equal(response.status, 201);
        chatId = (await response.json()).data.chat.id;
      }
      current = { calls: 0, reads: 0, bytes: 0, usage: [] };
      const started = performance.now();
      const requestHeaders = name === 'stream' ? { ...headers, Accept: 'application/x-ndjson' } : headers;
      const response = await originalFetch(`${origin}/api/ai${plan ? '/study-plan' : `/chats/${chatId}/messages`}`, plan ? { headers: requestHeaders } : {
        method: 'POST', headers: requestHeaders,
        body: JSON.stringify({
          message: destinations ? 'Open my vocabulary notebook and open translation and open my review queue.'
            : 'How can I use the past simple in a conversation?',
          context: destinations ? { tab: 'study', surface: 'mobile' } : { tab: 'study' },
        }),
      });
      assert.equal(response.status, plan ? 200 : 201);
      let first;
      let preview;
      const reader = plan ? streamReaders?.readStudyPlanStream : streamReaders?.readAiReplyStream;
      const result = name === 'stream' ? await reader(response.body, (value) => {
        if (value) {
          preview = value;
          first ??= performance.now() - started;
        }
      }) : (await response.json()).data;
      const elapsed = performance.now() - started;
      const correct = plan
        ? result.steps.length === 3 && result.steps[0].target.lessonId === result.snapshot.nextLesson?.id
          && (live ? Boolean(result.aiNote?.trim()) : result.aiNote === fixtureReply)
          && (name !== 'stream' || (preview?.aiNote === null && JSON.stringify(preview.steps) === JSON.stringify(result.steps)))
        : destinations
        ? current.calls === 0 && JSON.stringify(mobileDestinations.replyActions(result).map((action) => {
            const href = mobileDestinations.aiDestination(action)?.href;
            return typeof href === 'string' ? href : href?.pathname;
          })) === '["/(tabs)/talk","/(tabs)/translate","/review"]'
        : result.action === null && (live ? /past|yesterday|verb/i.test(result.aiMessage.content) : result.aiMessage.content === fixtureReply);
      const passed = Number(correct && (plan || result.userMessage.chat_id === chatId));
      const usage = (await Promise.all(current.usage)).filter(Boolean);
      if (index > 0) results[name].push({ ...current, usage, elapsed, ttft: first ?? elapsed, draft: Number(first !== undefined), passed });
      current = undefined;
    }
  }
  console.log(JSON.stringify({ provider: live ? 'configured' : 'fixture', task: plan ? 'cold study-plan note' : destinations ? 'ordered mobile destinations' : 'grammar question' }));
  for (const name of modes) {
    const summary = summarize(name, results[name]);
    console.log(JSON.stringify(summary));
    if (summary.successes !== summary.samples) process.exitCode = 1;
  }
} finally {
  globalThis.fetch = originalFetch;
  pool.execute = execute;
  if (server) await new Promise((resolve) => server.close(resolve));
  if (userIds.length) await pool.execute(`DELETE FROM users WHERE id IN (${userIds.map(() => '?').join(', ')})`, userIds);
  await pool.end();
}
