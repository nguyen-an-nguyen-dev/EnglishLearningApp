// Run from backend with: node --import tsx scripts/benchmark-speech-tts.mjs
import 'dotenv/config';
import { createHash, randomInt } from 'node:crypto';
import { channel } from 'node:diagnostics_channel';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';

process.env.LOG_LEVEL = 'error';
const { app } = await import('../src/app.ts');
const { pool } = await import('../src/db/pool.ts');
const { getVerifiedJwtSecret } = await import('../src/modules/auth/auth.service.ts');
const speech = await import('../src/modules/speech/speech.tts.ts');
const fresh = process.argv.includes('--fresh-connection');
const trace = process.argv.includes('--trace');

const examples = {
  en: [
    'A repeated action in the past can use the past simple.',
    'Try saying the sentence again with a slower pace.',
    'What did you bring with you to the market yesterday?',
    'Open your vocabulary notebook and choose a new word.',
    'We use the present perfect to connect a past event with the present.',
    'Read the two sentences aloud and listen for the difference.',
  ],
  vi: [
    'Bạn vừa hoàn thành một bài luyện nghe.',
    'Hãy nghe câu hỏi trước rồi chọn câu trả lời phù hợp.',
    'Bạn có thể mở sổ từ và ôn lại một từ đã lưu.',
    'Thử đọc chậm hơn và nhấn vào từ quan trọng.',
    'Thì quá khứ đơn diễn tả hành động đã kết thúc.',
    'Bạn muốn luyện nói hay ôn lại bài vừa học?',
  ],
};
const tasks = examples.en.flatMap((text, index) => [[text, 'en'], [examples.vi[index], 'vi']]);
const hashes = [];
const httpRequests = channel('http.client.request.start');
let upgrades = 0;
function countEdgeUpgrade({ request }) {
  if (request.getHeader('host') === 'speech.platform.bing.com' && request.getHeader('upgrade') === 'websocket') upgrades++;
}
httpRequests.subscribe(countEdgeUpgrade);

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? Math.round(sorted[Math.ceil(sorted.length * fraction) - 1] * 10) / 10 : null;
}

const server = app.listen(0, '127.0.0.1');
try {
  await once(server, 'listening');
  const token = jwt.sign({}, getVerifiedJwtSecret(), { subject: String(randomInt(1, 1_000_000_000)), expiresIn: '5m' });
  const url = `http://127.0.0.1:${server.address().port}/api/speech/synthesize`;
  for (const phase of ['distinct', 'replay']) {
    const latencies = [];
    const statuses = [];
    const initialUpgrades = upgrades;
    let matchingReplays = 0;
    for (const [index, [text, lang]] of tasks.entries()) {
      if (fresh) speech.closeIdleSpeechClients?.();
      const started = performance.now();
      const response = await fetch(url, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang }), signal: AbortSignal.timeout(12_000),
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      const mp3 = response.ok && response.headers.get('content-type')?.startsWith('audio/mpeg') && bytes.length > 100
        && (bytes.subarray(0, 3).toString() === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
      const elapsed = performance.now() - started;
      if (trace) console.log(JSON.stringify({ mode: fresh ? 'fresh' : 'reuse', phase, index, lang,
        status: response.status, valid: mp3, elapsed_ms: Math.round(elapsed * 10) / 10 }));
      if (!mp3) { statuses.push(response.status); continue; }
      latencies.push(elapsed);
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (phase === 'distinct') hashes[index] = digest;
      else if (digest === hashes[index]) matchingReplays++;
    }
    console.log(JSON.stringify({
      mode: fresh ? 'fresh' : 'reuse', phase, requests: tasks.length, valid_mp3: latencies.length,
      ...(phase === 'replay' && { matchingReplays }),
      socket_upgrades: upgrades - initialUpgrades, p50_ms: percentile(latencies, 0.5), p95_ms: percentile(latencies, 0.95),
      ...(statuses.length && { failed_statuses: statuses }),
    }));
    if (latencies.length !== tasks.length || (phase === 'replay' && matchingReplays !== tasks.length)) process.exitCode = 1;
  }
} finally {
  httpRequests.unsubscribe(countEdgeUpgrade);
  await new Promise((resolve) => server.close(resolve));
  speech.closeIdleSpeechClients?.();
  await pool.end();
}
