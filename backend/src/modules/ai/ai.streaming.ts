import { HttpError } from '../../middleware/error-handler';
import { isRecord } from '../../utils/validation';

const MAX_BUFFER_LENGTH = 64_000;

/** Only the top-level reply, when it is the first field of the JSON contract. */
function replyPreview(content: string): string {
  const quoted = /^\s*(?:```(?:json)?\s*)?\{\s*"reply"\s*:\s*"((?:[^"\\\x00-\x1f]|\\(?:["\\/bfnrt]|u[\da-f]{4}))*)/iu.exec(content)?.[1];
  if (!quoted) return '';
  // The match ends before a partial escape. Hide an unmatched UTF-16 half until its pair arrives.
  return (JSON.parse(`"${quoted}"`) as string).trim().replace(/[\uD800-\uDBFF]$/, '');
}

export async function readAssistantStream(
  body: ReadableStream<Uint8Array>,
  onDraft: (text: string) => void,
  onFirstContent?: () => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const started = performance.now();
  let firstContentMs: number | undefined;
  let content = '';
  let buffer = '';
  let finishReason: string | undefined;
  let usage: unknown;
  let completed = false;
  let preview = '';
  let lastPreviewAt = 0;

  function readEvent(event: string) {
    const data = event.split(/\r?\n/).filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart()).join('\n');
    if (!data) return;
    if (data === '[DONE]') {
      completed = true;
      return;
    }
    const packet: unknown = JSON.parse(data);
    if (!isRecord(packet)) return;
    if (packet.error) throw new HttpError(502, 'The AI provider interrupted the response.');
    if (isRecord(packet.usage)) usage = packet.usage;
    const choice = Array.isArray(packet.choices) ? packet.choices[0] : null;
    if (!isRecord(choice)) return;
    if (typeof choice.finish_reason === 'string') finishReason = choice.finish_reason;
    if (!isRecord(choice.delta) || typeof choice.delta.content !== 'string' || !choice.delta.content) return;
    if (firstContentMs === undefined && choice.delta.content.trim()) {
      firstContentMs = Math.round(performance.now() - started);
      onFirstContent?.();
    }
    content += choice.delta.content;
    if (content.length > MAX_BUFFER_LENGTH) throw new HttpError(502, 'The AI response was too large.');
    const now = performance.now();
    if (preview && now - lastPreviewAt < 75) return;
    const next = replyPreview(content);
    if (next.length < 8 || next === preview) return;
    preview = next;
    lastPreviewAt = now;
    onDraft(preview);
  }

  try {
    while (!completed) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';
      if (buffer.length > MAX_BUFFER_LENGTH) throw new HttpError(502, 'The AI response was too large.');
      for (const event of events) readEvent(event);
      if (done) {
        if (buffer.trim()) readEvent(buffer);
        break;
      }
    }
    if (!completed && !finishReason) throw new HttpError(502, 'The AI provider interrupted the response.');
    return {
      payload: { choices: [{ message: { content }, finish_reason: finishReason }], usage },
      firstContentMs,
    };
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
