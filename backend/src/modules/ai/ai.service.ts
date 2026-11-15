import { HttpError } from '../../middleware/error-handler';
import { inferReminderFromMessage } from './ai.parsing';
import { answerTurn, resolveTurnIntent } from './ai.pipeline';
import { createPlanMessages, planData, toCoachMessages, toTutorMessages } from './ai.prompts';
import * as repository from './ai.repository';
import {
  buildOfflineCoachReply,
  buildStudyPlan,
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
  ProviderMessage,
  ReminderSuggestion,
  StudyPlan,
} from './ai.types';

const MAX_CONTEXT_MESSAGES = 20;

/* ─── Chat threads ────────────────────────────────────────────────────────── */

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

/* ─── Coach turn ──────────────────────────────────────────────────────────── */

interface CoachTurn {
  stats: StudyStats;
  messages: ProviderMessage[];
  /** Rows-based answer used when the provider or the decision gate says no. */
  offline: AiReply;
  /** The exact data the model saw, so the review gate can check grounding. */
  learnerData: string;
}

/**
 * The coach turn is derived from database rows before the model is called:
 * plan steps, snapshot and offline answer are all deterministic.
 */
async function prepareCoachTurn(
  userId: number,
  message: string,
  intent: ChatIntent,
  context: ChatContext | null,
  history: MessageRow[],
  learner: LearnerContext,
): Promise<CoachTurn> {
  const stats = await repository.getStudyStats(userId);
  const snapshot = toStudySnapshot(learner, stats);
  const steps = buildStudyPlan(snapshot, stats);
  return {
    stats,
    messages: toCoachMessages(history, message, learner, snapshot, steps, intent, context, stats),
    offline: buildOfflineCoachReply(snapshot, steps, intent, context),
    learnerData: planData(snapshot, steps, stats),
  };
}

function toSavedFeedback(aiReply: AiReply, message: string, messageId: number) {
  return aiReply.feedback.map((item) => ({
    ...item,
    original_text: message,
    message_id: messageId,
  }));
}

/* ─── Study plan ──────────────────────────────────────────────────────────── */

export async function getStudyPlan(userId: number): Promise<StudyPlan> {
  const [learner, stats] = await Promise.all([
    repository.getLearnerContext(userId),
    repository.getStudyStats(userId),
  ]);
  const snapshot = toStudySnapshot(learner, stats);
  const steps = buildStudyPlan(snapshot, stats);

  // A deterministic plan is always usable; the model only writes the "why" and
  // the gate can drop it, leaving `aiNote: null`.
  let aiNote: string | null = null;
  try {
    const { reply, review } = await answerTurn({
      messages: createPlanMessages(snapshot, steps, stats),
      message: 'Hôm nay mình nên học gì trước, và học như thế nào?',
      intent: 'plan',
      context: null,
      flavor: 'coach',
      offline: null,
      learnerData: planData(snapshot, steps, stats),
      maxTokens: 700,
    });
    if (review?.verdict !== 'reject') aiNote = reply.reply.slice(0, 600);
  } catch {
    aiNote = null;
  }

  return { snapshot, steps, aiNote, generatedAt: new Date().toISOString() };
}

/* ─── Chat message ────────────────────────────────────────────────────────── */

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

  const turnIntent = await resolveTurnIntent(message, intent, context);
  const isCoach = chat.topic === 'STUDY_COACH' || turnIntent !== 'chat';

  let aiReply: AiReply;
  let stats: StudyStats | null = null;
  if (isCoach) {
    const coach = await prepareCoachTurn(userId, message, turnIntent, context, history, learner);
    stats = coach.stats;
    aiReply = (await answerTurn({
      messages: coach.messages,
      message,
      intent: turnIntent,
      context,
      flavor: 'coach',
      offline: coach.offline,
      learnerData: coach.learnerData,
    })).reply;
  } else {
    aiReply = (await answerTurn({
      messages: toTutorMessages(history, message, chat.topic, learner),
      message,
      intent: turnIntent,
      context,
      flavor: 'tutor',
      offline: null,
    })).reply;
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
    action: stats ? resolveChatAction(aiReply.action, stats) : null,
  };
}

/* ─── Companion (one question, one answer) ────────────────────────────────── */

export interface BuddyAnswer {
  reply: string;
  followups: string[];
  action: ChatAction | null;
  feedback: AiReply['feedback'];
  suggestion: ReminderSuggestion | null;
}

/**
 * One question, one answer, no visible thread: the companion UI asks the coach
 * and shows the reply inline. The conversation is still stored under the
 * learner's single STUDY_COACH chat, so `GET /api/ai/chats` keeps working and
 * the buddy can look back at what was already asked.
 */
export async function askBuddy(
  userId: number,
  message: string,
  intent: ChatIntent,
  context: ChatContext | null,
): Promise<BuddyAnswer> {
  const chatId = await repository.ensureCoachChat(userId);
  const [history, learner] = await Promise.all([
    repository.getConversationHistory(chatId, MAX_CONTEXT_MESSAGES),
    repository.getLearnerContext(userId),
  ]);

  const turnIntent = await resolveTurnIntent(message, intent, context);
  const coach = await prepareCoachTurn(userId, message, turnIntent, context, history, learner);

  const aiReply = (await answerTurn({
    messages: coach.messages,
    message,
    intent: turnIntent,
    context,
    flavor: 'coach',
    offline: coach.offline,
    learnerData: coach.learnerData,
  })).reply;

  const saved = await repository.saveConversation(
    userId,
    chatId,
    message,
    aiReply.reply,
    aiReply.feedback.map((item) => ({ ...item, original_text: message })),
  );

  return {
    reply: aiReply.reply,
    followups: aiReply.followups,
    action: resolveChatAction(aiReply.action, coach.stats),
    feedback: toSavedFeedback(aiReply, message, saved.userMessage.id),
    suggestion: aiReply.reminder ?? inferReminderFromMessage(message),
  };
}
