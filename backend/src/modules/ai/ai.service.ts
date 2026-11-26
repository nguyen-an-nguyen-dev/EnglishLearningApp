import { HttpError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';
import { parseBuddyCommand } from './ai.commands';
import { buildBuddySnapshot, matchShopItem, resolveBuddyCommand } from './ai.copilot';
import type { BuddySnapshot } from './ai.copilot';
import { buddyLanguage, normalizeDestination } from './ai.language';
import type { BuddyLanguage } from './ai.language';
import { inferReminderFromMessage } from './ai.parsing';
import { answerTurn, resolveTurnIntent } from './ai.pipeline';
import { createPlanMessages, isShortIntent, toCoachMessages, toTutorMessages } from './ai.prompts';
import * as repository from './ai.repository';
import {
  buildOfflineCoachReply,
  buildStudyPlan,
  lessonPrerequisites,
  resolveNavigationRequest,
  resolveChatAction,
  toStudySnapshot,
} from './ai.study';
import type { StudyStats } from './ai.repository';
import type {
  AiReply,
  AiTopic,
  ChatAction,
  ChatContext,
  ChatIntent,
  LearnerContext,
  MessageRow,
  ReminderSuggestion,
  StudyPlan,
} from './ai.types';

const MAX_CONTEXT_MESSAGES = 10;
/** Cap for chat, plan and study-plan replies; the prompt asks for far less. */
const SHORT_REPLY_TOKENS = 700;

function openedReply(action: ChatAction, language: BuddyLanguage): AiReply {
  return {
    reply: action.highlight === 'control:arena-start'
      ? (language === 'en' ? 'Look for the highlighted Find Opponent button in the Arena.' : 'Mình đã mở Thi Đua. Nút “Tìm đối thủ” sẽ sáng lên.')
      : language === 'en' ? 'Opened.' : `Đã mở “${action.label}” cho bạn.`,
    feedback: [],
    followups: [],
    action,
    reminder: null,
  };
}

export async function listChats(userId: number) {
  return repository.listChats(userId);
}

export async function createChat(userId: number, topic: AiTopic) {
  return repository.createChat(userId, topic);
}

export async function getChat(userId: number, chatId: number) {
  const chat = await repository.getChat(userId, chatId);
  if (!chat) throw new HttpError(404, 'Chat not found.');
  const messages = await repository.getMessages(chatId);
  return { chat, messages };
}

export async function deleteChat(userId: number, chatId: number): Promise<void> {
  const deleted = await repository.deleteChat(userId, chatId);
  if (!deleted) throw new HttpError(404, 'Chat not found.');
}

export async function getFeedback(userId: number, chatId: number) {
  const chat = await repository.getChat(userId, chatId);
  if (!chat) throw new HttpError(404, 'Chat not found.');
  return repository.getFeedback(userId, chatId);
}

/**
 * One model call decides the reply, the action and any reminder from the
 * learner's data. The deterministic guide only answers when no model can, so
 * the buddy still navigates and sets reminders while every provider is down.
 */
async function answerCoachTurn(
  message: string,
  intent: ChatIntent,
  context: ChatContext | null,
  history: MessageRow[],
  learner: LearnerContext,
  snapshot: BuddySnapshot,
  language: BuddyLanguage,
): Promise<AiReply> {
  const stats = snapshot.study;
  const shop = snapshot.shop;
  const studySnapshot = toStudySnapshot(learner, stats);
  const steps = buildStudyPlan(studySnapshot, stats);
  const offline = resolveGuideTurn(message, snapshot, learner, context)
    ?? reminderOnlyReply(message, language)
    ?? buildOfflineCoachReply(studySnapshot, steps, intent, context, language);
  const reply = await answerTurn({
    messages: toCoachMessages(history, message, learner, studySnapshot, steps, intent, context, stats, language, shop),
    flavor: 'coach',
    offline,
    maxTokens: isShortIntent(intent) ? SHORT_REPLY_TOKENS : undefined,
  });
  return withResolvedAction(reply, stats, language, shop.items);
}

function reminderOnlyReply(message: string, language: BuddyLanguage): AiReply | null {
  const reminder = inferReminderFromMessage(message);
  if (!reminder) return null;
  return {
    reply: language === 'en' ? 'Confirm below to save your reminder.' : 'Xác nhận bên dưới để lưu lời nhắc nhé.',
    action: null,
    reminder,
    feedback: [],
    followups: [],
  };
}

function resolveGuideTurn(message: string, snapshot: BuddySnapshot, learner: LearnerContext, context: ChatContext | null): AiReply | null {
  const command = parseBuddyCommand(message);
  const language = command?.language ?? buddyLanguage(message);
  const navigation = resolveNavigationRequest(message, snapshot.study);
  const shopRequest = command?.kind === 'shopItem' && (
    /\b(gara|shop|garage|cua hang|xe|car|khung|frame|nameplate|booster|khien|shield)\b/.test(normalizeDestination(message))
    || command.params.buy
    || Boolean(matchShopItem(command.params.item, snapshot.shop.items))
  );
  const reply = command && command.kind !== 'shopItem'
    ? resolveBuddyCommand(command, snapshot, learner, context)
    : navigation
      ? openedReply(navigation, language)
      : shopRequest
        ? resolveBuddyCommand(command, snapshot, learner)
        : null;
  return reply ? withResolvedAction(reply, snapshot.study, language, snapshot.shop.items) : null;
}

function withResolvedAction(
  reply: AiReply,
  stats: StudyStats,
  language: BuddyLanguage,
  shopItems?: Parameters<typeof resolveChatAction>[2],
): AiReply {
  const action = resolveChatAction(reply.action, stats, shopItems);
  const locked = action?.kind === 'open_lesson' && action.lessonId
    ? lessonPrerequisites(stats, action.lessonId)
    : null;
  if (action?.kind === 'open_lesson') {
    const title = action.lessonTitle ?? '';
    action.label = (action.mode === 'reveal'
      ? (language === 'en' ? `Locate lesson ${title}` : `Chỉ vị trí bài ${title}`)
      : (language === 'en' ? `Open lesson ${title}` : `Mở bài: ${title}`)).slice(0, 80);
  }
  if (!locked) return { ...reply, action };
  return {
    ...reply,
    action,
    reply: language === 'en'
      ? `“${action?.lessonTitle}” is locked. Complete ${locked.remaining} ${locked.remaining === 1 ? 'lesson' : 'lessons'}, starting with “${locked.frontier.title}”.`
      : `Bài “${action?.lessonTitle}” đang khóa. Bạn cần hoàn thành ${locked.remaining} bài, bắt đầu từ “${locked.frontier.title}”.`,
    feedback: [],
    followups: [],
  };
}

function toSavedFeedback(aiReply: AiReply, message: string, messageId: number) {
  return aiReply.feedback.map((item) => ({
    ...item,
    original_text: message,
    message_id: messageId,
  }));
}

export async function getStudyPlan(userId: number): Promise<StudyPlan> {
  const [learner, stats] = await Promise.all([
    repository.getLearnerContext(userId),
    repository.getStudyStats(userId),
  ]);
  const snapshot = toStudySnapshot(learner, stats);
  const steps = buildStudyPlan(snapshot, stats);

  // A deterministic plan is always usable; the model only writes the "why", so
  // a failed call leaves `aiNote: null`.
  let aiNote: string | null = null;
  try {
    const reply = await answerTurn({
      messages: createPlanMessages(snapshot, steps, stats),
      flavor: 'coach',
      offline: null,
      maxTokens: SHORT_REPLY_TOKENS,
    });
    aiNote = reply.reply.slice(0, 600);
  } catch {
    aiNote = null;
  }

  return { snapshot, steps, aiNote, generatedAt: new Date().toISOString() };
}

export async function sendMessage(
  userId: number,
  chatId: number,
  message: string,
  intent: ChatIntent = 'chat',
  context: ChatContext | null = null,
) {
  const chat = await repository.getChat(userId, chatId);
  if (!chat) throw new HttpError(404, 'Chat not found.');

  const [history, learner] = await Promise.all([
    repository.getConversationHistory(chatId, MAX_CONTEXT_MESSAGES),
    repository.getLearnerContext(userId),
  ]);

  const turnIntent = chat.topic === 'STUDY_COACH'
    ? intent
    : await resolveTurnIntent(message, intent, context);
  const language = buddyLanguage(message);
  const isCoach = chat.topic === 'STUDY_COACH' || turnIntent !== 'chat';

  let aiReply: AiReply;
  if (isCoach) {
    const snapshot = await buildBuddySnapshot(userId);
    aiReply = await answerCoachTurn(message, turnIntent, context, history, learner, snapshot, language);
  } else {
    aiReply = await answerTurn({
      messages: toTutorMessages(history, message, chat.topic, learner),
      flavor: 'tutor',
      offline: null,
    });
  }

  const saved = await repository.saveConversation(
    userId,
    chatId,
    message,
    aiReply.reply,
    aiReply.feedback.map((item) => ({ ...item, original_text: message })),
  );
  return {
    ...saved,
    feedback: toSavedFeedback(aiReply, message, saved.userMessage.id),
    followups: aiReply.followups,
    action: isCoach ? aiReply.action : null,
  };
}

export interface BuddyAnswer {
  reply: string;
  language: BuddyLanguage;
  followups: string[];
  action: ChatAction | null;
  feedback: AiReply['feedback'];
  suggestion: ReminderSuggestion | null;
  /** The web uses this to avoid opening the chat panel for pure navigation. */
  route: 'open_prompt' | 'navigate';
}

/**
 * One question, one answer, no visible thread: the companion UI shows the reply
 * inline. The exchange is still stored under the learner's single STUDY_COACH
 * chat so the buddy remembers what was already asked.
 */
export async function askBuddy(
  userId: number,
  message: string,
  intent: ChatIntent,
  context: ChatContext | null,
): Promise<BuddyAnswer> {
  const started = performance.now();
  const greeting = intent === 'chat' ? buddyGreeting(message) : null;
  let contextMs: number | undefined;
  let answerMs: number | undefined;
  let saveMs: number | undefined;
  let succeeded = false;

  try {
    let chatId: number;
    let reply: AiReply;
    let language: BuddyLanguage;
    if (greeting) {
      chatId = await repository.ensureCoachChat(userId);
      contextMs = performance.now() - started;
      ({ reply, language } = greeting);
    } else {
      const [chat, snapshot, learner] = await Promise.all([
        repository.ensureCoachChat(userId).then(async (id) => ({
          id,
          history: await repository.getConversationHistory(id, MAX_CONTEXT_MESSAGES),
        })),
        buildBuddySnapshot(userId),
        repository.getLearnerContext(userId),
      ]);
      chatId = chat.id;
      const ready = performance.now();
      contextMs = ready - started;
      language = buddyLanguage(message);
      reply = await answerCoachTurn(message, intent, context, chat.history, learner, snapshot, language);
      answerMs = performance.now() - ready;
    }
    const saving = performance.now();
    const result = await saveBuddyAnswer(userId, chatId, message, reply, language);
    saveMs = performance.now() - saving;
    succeeded = true;
    return result;
  } finally {
    logger.info('buddy_ask_timing', {
      path: greeting ? 'greeting' : 'coach',
      succeeded,
      context_ms: contextMs === undefined ? undefined : Math.round(contextMs),
      answer_ms: answerMs === undefined ? undefined : Math.round(answerMs),
      save_ms: saveMs === undefined ? undefined : Math.round(saveMs),
      total_ms: Math.round(performance.now() - started),
    });
  }
}

function buddyGreeting(message: string): { reply: AiReply; language: BuddyLanguage } | null {
  // Strip only trailing sentence punctuation so questions or appended requests
  // cannot be mistaken for a greeting.
  const text = message.normalize('NFC').toLowerCase().trim().replace(/[!.…]+$/, '').trim();
  const language = /^(xin chào|xin chao|chào bạn|chao ban|chào)$/.test(text) ? 'vi'
    : /^(hello|hi|hey|hello there)$/.test(text) ? 'en'
    : null;
  if (!language) return null;
  return {
    language,
    reply: {
      reply: language === 'en' ? 'Hi! How can I help you today?' : 'Chào bạn! Hôm nay mình có thể giúp gì cho bạn?',
      feedback: [],
      followups: [],
      action: null,
      reminder: null,
    },
  };
}

async function saveBuddyAnswer(
  userId: number,
  chatId: number,
  message: string,
  aiReply: AiReply,
  language: BuddyLanguage,
): Promise<BuddyAnswer> {
  const saved = await repository.saveConversation(
    userId,
    chatId,
    message,
    aiReply.reply,
    aiReply.feedback.map((item) => ({ ...item, original_text: message })),
  );

  return {
    reply: aiReply.reply,
    language,
    followups: aiReply.followups,
    action: aiReply.action,
    feedback: toSavedFeedback(aiReply, message, saved.userMessage.id),
    suggestion: aiReply.reminder,
    route: aiReply.action ? 'navigate' : 'open_prompt',
  };
}
