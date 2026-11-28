import type { AiMessageTurn, StudyPlan } from './ai';

export const AI_REPLY_STREAM_TYPE = 'application/x-ndjson';

type AiStreamEvent = { type?: string; text?: unknown; data?: unknown } | null;

async function readAiStream<T>(
  body: ReadableStream<Uint8Array> | null,
  failureMessage: string,
  onEvent: (event: AiStreamEvent) => T | undefined,
): Promise<T> {
  const failed = () => new Error(failureMessage);
  if (!body) throw failed();
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = done ? '' : (lines.pop() ?? '');
      if (buffer.length > 64_000) throw failed();
      for (const line of lines) {
        if (!line.trim()) continue;
        if (line.length > 64_000) throw failed();
        const event = JSON.parse(line) as AiStreamEvent;
        if (event?.type === 'error') throw failed();
        const result = onEvent(event);
        if (result !== undefined) return result;
      }
      if (done) throw failed();
    }
  } catch {
    throw failed();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function readAiReplyStream(
  body: ReadableStream<Uint8Array> | null,
  onDraft: (text: string) => void,
): Promise<AiMessageTurn> {
  return readAiStream(body, 'Không tải được câu trả lời của En Buddy.', (event) => {
    if (event?.type === 'draft' && typeof event.text === 'string') onDraft(event.text);
    if (event?.type !== 'answer') return;
    const data = event.data as AiMessageTurn | null;
    if (typeof data?.aiMessage?.content === 'string' && typeof data.userMessage?.content === 'string' && Array.isArray(data.feedback)) return data;
  });
}

export function readStudyPlanStream(
  body: ReadableStream<Uint8Array> | null,
  onPlan: (plan: StudyPlan) => void,
): Promise<StudyPlan> {
  return readAiStream(body, 'Không tải được kế hoạch học.', (event) => {
    if (event?.type !== 'plan' && event?.type !== 'answer') return;
    const plan = event.data as StudyPlan | null;
    if (typeof plan?.snapshot?.completedLessons !== 'number' || typeof plan.snapshot.totalLessons !== 'number'
      || !Array.isArray(plan.steps) || typeof plan.generatedAt !== 'string'
      || (plan.aiNote !== null && typeof plan.aiNote !== 'string')) return;
    if (event.type === 'answer') return plan;
    onPlan(plan);
  });
}
