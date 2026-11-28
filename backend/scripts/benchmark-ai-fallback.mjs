// Run from backend with: node --import tsx scripts/benchmark-ai-fallback.mjs
import { AsyncLocalStorage } from 'node:async_hooks';
import { setTimeout as delay } from 'node:timers/promises';

process.env.LOG_LEVEL = 'error';
const { env } = await import('../src/config/env.ts');
const { generateReply } = await import('../src/modules/ai/ai.provider.ts');
const tutor = process.argv.includes('--tutor');
env.thApiUrl = 'https://tokenharbor.ai/v1/chat/completions';
env.aiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
env.thApiKey = 'fixture-primary';
env.aiApiKey = 'fixture-backup';
env.thModel = 'deepseek-v4.1-flash-1017';

const attempts = new AsyncLocalStorage();
const originalFetch = globalThis.fetch;
const encoder = new TextEncoder();
const packet = (value) => encoder.encode(`data: ${JSON.stringify(value)}\n\n`);
const samplesPerCase = 6;
const scenarios = [
  { name: 'healthy primary', startupMs: 0, finishMs: 100, allowBackup: false },
  ...(tutor ? [
    { name: 'primary already writing', startupMs: 0, finishMs: 3_300, allowBackup: false },
    { name: 'slow primary', startupMs: 5_200, finishMs: 100, allowBackup: true },
  ] : []),
  { name: 'silent primary', startupMs: tutor ? 35_000 : 20_000, finishMs: 100, allowBackup: true },
];
const correction = { type: 'TENSE', original_text: 'goed', corrected_text: 'went', explanation: 'Dùng went cho quá khứ.' };

globalThis.fetch = async (url, options) => {
  const state = attempts.getStore();
  const primary = String(url) === env.thApiUrl;
  state.calls++;
  if (primary && state.startupMs) {
    try {
      await delay(state.startupMs, undefined, { signal: options.signal });
    } catch (error) {
      state.aborted++;
      throw error;
    }
  }
  const reply = primary ? 'The primary provider answered.' : 'The backup provider answered.';
  const body = new ReadableStream({
    async start(controller) {
      await delay(300);
      controller.enqueue(packet({ choices: [{ delta: { content: `{"reply":"${reply}` } }] }));
      await delay(primary ? state.finishMs : 100);
      controller.enqueue(packet({ choices: [{ delta: { content: `","feedback":${JSON.stringify(tutor ? [correction] : [])}}` }, finish_reason: 'stop' }] }));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
};

function percentile(samples, key, quantile) {
  const sorted = samples.map((sample) => sample[key]).sort((a, b) => a - b);
  return Math.round(sorted[Math.ceil(sorted.length * quantile) - 1]);
}

try {
  for (const scenario of scenarios) {
    const samples = await Promise.all(Array.from({ length: samplesPerCase }, () => {
      const state = { ...scenario, calls: 0, aborted: 0 };
      return attempts.run(state, async () => {
        const started = performance.now();
        let firstText;
        const result = await generateReply([{ role: 'user', content: tutor ? 'Yesterday I goed to school.' : 'Explain the simple past.' }], {
          ...(tutor ? { brief: true, timeoutMs: 30_000 } : { buddy: true, maxTokens: 480, timeoutMs: 12_000 }),
          onDraft: (text) => { if (text) firstText ??= performance.now() - started; },
        });
        const elapsed = performance.now() - started;
        await delay(0);
        const backupWon = result.reply === 'The backup provider answered.';
        const expected = state.name === 'silent primary' ? backupWon
          : result.reply === 'The primary provider answered.' || (tutor && state.allowBackup && backupWon);
        return {
          ...state, elapsed, firstText: firstText ?? elapsed,
          backupWon, passed: expected && (state.allowBackup || state.calls === 1)
            && (!tutor || result.feedback[0]?.corrected_text === correction.corrected_text),
        };
      });
    }));
    console.log(JSON.stringify({
      name: scenario.name,
      samples: samples.length,
      first_text_p50_ms: percentile(samples, 'firstText', 0.5),
      first_text_p95_ms: percentile(samples, 'firstText', 0.95),
      completion_p50_ms: percentile(samples, 'elapsed', 0.5),
      completion_p95_ms: percentile(samples, 'elapsed', 0.95),
      model_calls: samples.reduce((total, { calls }) => total + calls, 0),
      aborted_attempts: samples.reduce((total, { aborted }) => total + aborted, 0),
      ...(tutor && { backup_wins: samples.filter(({ backupWon }) => backupWon).length }),
      successes: samples.filter(({ passed }) => passed).length,
    }));
    if (samples.some(({ passed }) => !passed)) process.exitCode = 1;
  }
} finally {
  globalThis.fetch = originalFetch;
}
