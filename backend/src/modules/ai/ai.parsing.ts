import { HttpError } from '../../middleware/error-handler';
import { CHAT_ACTION_KINDS, CHAT_TABS } from './ai.types';
import type {
  AiFeedbackInput,
  AiReply,
  ChatAction,
  ChatActionKind,
  ChatTab,
  FeedbackType,
  ReminderSuggestion,
} from './ai.types';

const FEEDBACK_TYPES = new Set<FeedbackType>(['GRAMMAR', 'VOCABULARY', 'TENSE', 'WORD_ORDER', 'OTHER']);
const MAX_FOLLOWUPS = 3;
const MAX_FEEDBACK_ITEMS = 6;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRawAction(value: unknown): ChatAction | null {
  if (!isRecord(value) || typeof value.kind !== 'string'
    || !CHAT_ACTION_KINDS.includes(value.kind as ChatActionKind)) {
    return null;
  }
  const positiveInt = (input: unknown): number | undefined =>
    Number.isSafeInteger(input) && Number(input) > 0 ? Number(input) : undefined;
  const tab = typeof value.tab === 'string' && CHAT_TABS.includes(value.tab as ChatTab)
    ? value.tab as ChatTab
    // Review lives inside the profile, so the action still needs a real tab.
    : value.kind === 'open_review' ? 'profile' : undefined;
  return {
    kind: value.kind as ChatActionKind,
    label: typeof value.label === 'string' ? value.label.trim().slice(0, 60) : '',
    tab,
    videoId: positiveInt(value.videoId),
    lessonId: positiveInt(value.lessonId),
  };
}

export function parseReminderSuggestion(value: unknown): ReminderSuggestion | null {
  if (!isRecord(value)) return null;

  const rawTitle = typeof value.title === 'string' ? value.title.trim() : '';
  if (!rawTitle) return null;

  const minutes = Number(value.in_minutes);
  const inMinutes = Number.isFinite(minutes) && minutes > 0
    ? Math.min(Math.max(Math.round(minutes), 1), 60 * 24 * 30)
    : null;

  const rawClock = typeof value.at_time === 'string' ? value.at_time.trim() : '';
  const atTime = /^\d{1,2}:\d{2}$/.test(rawClock) ? rawClock : null;

  if (inMinutes === null && atTime === null) return null;

  const body = typeof value.body === 'string' ? value.body.trim().slice(0, 500) : '';

  return {
    title: rawTitle.slice(0, 160),
    in_minutes: inMinutes,
    at_time: atTime,
    body: body || null,
  };
}

/**
 * The model does not always emit `reminder`, even when the learner clearly asked
 * for one ("20 phút nữa nhắc mình ôn sổ từ"). Losing a reminder they asked for is
 * worse than a small guess, so the intent is read from the message itself and the
 * time is parsed with the same rules the reminders module enforces.
 */
export function inferReminderFromMessage(message: string): ReminderSuggestion | null {
  const text = message.toLowerCase();
  if (!/nhắc|remind/.test(text)) return null;

  let inMinutes: number | null = null;
  let atTime: string | null = null;

  const minutesMatch = text.match(/(\d{1,4})\s*(phút|min|minutes?)/);
  if (minutesMatch) inMinutes = Number(minutesMatch[1]);

  if (inMinutes === null) {
    const clockMatch = text.match(/(\d{1,2})\s*(?::|h|giờ)\s*(\d{2})?/);
    if (clockMatch) {
      const hours = Number(clockMatch[1]);
      const mins = clockMatch[2] ? Number(clockMatch[2]) : 0;
      if (hours <= 23 && mins <= 59) {
        atTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      }
    }
  }

  if (inMinutes === null && atTime === null) return null;

  // "nhắc mình ôn sổ từ" -> "Ôn sổ từ"
  const about = text.match(/nhắc[^,.]*?(?:mình|tôi|tớ)?\s*(?:là\s*)?(?:phải\s*)?(.*)$/);
  const rawTitle = (about?.[1] ?? '')
    .replace(/^(học|ôn|mở|làm)\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const title = rawTitle.length >= 3 && rawTitle.length <= 80
    ? rawTitle.charAt(0).toLocaleUpperCase('vi') + rawTitle.slice(1)
    : 'Quay lại học';

  return {
    title,
    in_minutes: inMinutes,
    at_time: atTime,
    body: null,
  };
}

/**
 * The model must return the agreed JSON object. Anything else is a provider
 * failure, not something the UI should try to render.
 */
export function parseAiReply(value: unknown): AiReply {
  if (!isRecord(value) || typeof value.reply !== 'string' || !value.reply.trim()
    || !Array.isArray(value.feedback) || value.feedback.length > MAX_FEEDBACK_ITEMS) {
    throw new HttpError(502, 'The AI returned an invalid response. Please try again.');
  }
  const feedback: AiFeedbackInput[] = value.feedback.map((item) => {
    if (!isRecord(item)
      || typeof item.type !== 'string'
      || !FEEDBACK_TYPES.has(item.type as FeedbackType)
      || typeof item.original_text !== 'string'
      || typeof item.corrected_text !== 'string'
      || typeof item.explanation !== 'string'
      || !item.original_text.trim()
      || !item.corrected_text.trim()
      || !item.explanation.trim()) {
      throw new HttpError(502, 'The AI returned invalid learning feedback. Please try again.');
    }
    return {
      type: item.type as FeedbackType,
      original_text: item.original_text.trim().slice(0, 2000),
      corrected_text: item.corrected_text.trim().slice(0, 2000),
      explanation: item.explanation.trim().slice(0, 2000),
    };
  });
  const followups = Array.isArray(value.followups)
    ? value.followups
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim().slice(0, 120))
      .slice(0, MAX_FOLLOWUPS)
    : [];
  return {
    reply: value.reply.trim().slice(0, 8000),
    feedback,
    followups,
    action: parseRawAction(value.action),
    reminder: parseReminderSuggestion(value.reminder),
  };
}

/** Reads the assistant text out of an OpenAI-compatible chat completion. */
export function providerMessageContent(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    throw new HttpError(502, 'The AI provider returned an invalid response. Please try again.');
  }
  const first = payload.choices[0];
  if (!isRecord(first) || !isRecord(first.message) || typeof first.message.content !== 'string') {
    throw new HttpError(502, 'The AI provider returned an invalid response. Please try again.');
  }
  const content = first.message.content.trim();
  if (!content) throw new HttpError(502, 'The AI returned an empty response. Please try again.');
  return content;
}
