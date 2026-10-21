import { once } from 'node:events';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { app } from './src/app';

async function main() {
  const server = createServer(app);
  server.listen(0);
  await once(server, 'listening');
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no addr');
  const base = `http://127.0.0.1:${addr.port}`;

  const email = `repro-${randomUUID()}@example.test`;
  await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Repro', email, password: 'correct-horse-7' }) });
  const login = await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'correct-horse-7' }) })).json() as any;
  const token = login.data.token;

  const stages = await (await fetch(`${base}/api/stages`)).json() as any;
  let lessonId = 0;
  outer: for (const s of stages.data.stages ?? stages.data) {
    const lessons = await (await fetch(`${base}/api/stages/${s.id}/lessons`, { headers: { Authorization: `Bearer ${token}` } })).json() as any;
    for (const l of lessons.data.lessons ?? []) {
      if (l.code === 's1-greetings') { lessonId = l.id; break outer; }
    }
  }
  console.log('lessonId', lessonId);
  const qs = await (await fetch(`${base}/api/lessons/${lessonId}/questions`, { headers: { Authorization: `Bearer ${token}` } })).json() as any;
  for (const q of qs.data.questions) {
    if (q.question_type === 'fill_choice' || q.question_type === 'listen_choice') {
      console.log('---', q.question_type, 'qid', q.id, JSON.stringify(q.question_text));
      for (const a of q.answers) {
        const r = await (await fetch(`${base}/api/lessons/${lessonId}/questions/${q.id}/check`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ answer: String(a.id) }) })).json() as any;
        console.log('  option', a.id, JSON.stringify(a.answer_text), '-> is_correct:', r.data?.is_correct, '| correct_answer:', JSON.stringify(r.data?.correct_answer));
      }
    }
  }
  server.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
