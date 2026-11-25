import { HttpError } from '../../middleware/error-handler';
import { parseBuddyCommand } from './ai.commands';
import { buildBuddySnapshot, resolveBuddyCommand } from './ai.copilot';
import { buddyLanguage } from './ai.language';
import type { BuddyLanguage } from './ai.language';
import { decideBuddyRoute } from './ai.decisions';
import { inferReminderFromMessage } from './ai.parsing';
import { answerTurn, resolveTurnIntent } from './ai.pipeline';
import { createPlanMessages, planData, toCoachMessages, toTutorMessages } from './ai.prompts';
import * as repository from './ai.repository';
import {
  buildOfflineCoachReply,
  buildStudyPlan,
  lessonPrerequisites,
  pickNextLesson,
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
  ProviderMessage,
  ReminderSuggestion,
  StudyPlan,
} from './ai.types';

const MAX_CONTEXT_MESSAGES = 20;

function navigationReply(action: ChatAction, language: BuddyLanguage = 'vi'): AiReply {
  return {
    reply: language === 'en'
      ? 'I found it. Use the button to open it.'
      : `Mình tìm thấy đúng mục rồi. Chọn “${action.label}” để mở, hoặc hủy nếu bạn đổi ý.`,
    feedback: [],
    followups: [],
    action,
    reminder: null,
  };
}

/** Short toast copy for a direct navigation: no chat panel, no long answer. */
function openedReply(action: ChatAction, language: BuddyLanguage): AiReply {
  return {
    reply: language === 'en' ? 'Opened.' : `Đã mở “${action.label}” cho bạn.`,
    feedback: [],
    followups: [],
    action,
    reminder: null,
  };
}

/**
 * When the decision model says "navigate" but the request names no catalog item,
 * send the learner to the next real lesson instead of opening a chat thread.
 * `explain` is deliberately excluded: it needs a written answer.
 */
function navigationForIntent(intent: ChatIntent, stats: StudyStats): ChatAction | null {
  if (intent !== 'plan' && intent !== 'practice' && intent !== 'how') return null;
  const next = pickNextLesson(stats);
  const lesson = next ? stats.lessons.find((item) => item.id === next.id) : null;
  if (lesson) {
    return {
      kind: 'open_lesson',
      tab: 'study',
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      label: `Mở bài: ${lesson.title}`.slice(0, 60),
    };
  }
  return { kind: 'open_tab', tab: 'study', label: 'Mở lộ trình học' };
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
  language: BuddyLanguage = 'vi',
): Promise<CoachTurn> {
  const stats = await repository.getStudyStats(userId);
  const snapshot = toStudySnapshot(learner, stats);
  const steps = buildStudyPlan(snapshot, stats);
  return {
    stats,
    messages: toCoachMessages(history, message, learner, snapshot, steps, intent, context, stats, language),
    offline: buildOfflineCoachReply(snapshot, steps, intent, context, language),
    learnerData: planData(snapshot, steps, stats),
  };
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
  const language = buddyLanguage(message);
  const isCoach = chat.topic === 'STUDY_COACH' || turnIntent !== 'chat';

  let aiReply: AiReply;
  let stats: StudyStats | null = null;
  if (isCoach) {
    const coach = await prepareCoachTurn(userId, message, turnIntent, context, history, learner, language);
    stats = coach.stats;
    const navigation = resolveNavigationRequest(message, coach.stats);
    aiReply = navigation
      ? navigationReply(navigation, language)
      : (await answerTurn({
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

  if (stats) aiReply = withResolvedAction(aiReply, stats, language);

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
    action: stats ? aiReply.action : null,
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
  const command = parseBuddyCommand(message);
  const chatId = await repository.ensureCoachChat(userId);
  if (command) {
    const snapshot = await buildBuddySnapshot(userId);
    const reply = withResolvedAction(
      resolveBuddyCommand(command, snapshot), snapshot.study, command.language, snapshot.shop.items,
    );
    return saveBuddyAnswer(userId, chatId, message, reply, reply.action ? 'navigate' : 'open_prompt');
  }

  const language = buddyLanguage(message);
  const [history, learner] = await Promise.all([
    repository.getConversationHistory(chatId, MAX_CONTEXT_MESSAGES),
    repository.getLearnerContext(userId),
  ]);

  // Both decisions use the Google decision model; run them together so the
  // extra routing question does not add a second network round trip.
  const [turnIntent, routeDecision] = await Promise.all([
    resolveTurnIntent(message, intent, context),
    decideBuddyRoute(message, intent, context),
  ]);
  const decidedNavigate = routeDecision?.confident === true && routeDecision.route === 'navigate';
  const decidedChat = routeDecision?.confident === true && routeDecision.route === 'open_prompt';
  const coach = await prepareCoachTurn(userId, message, turnIntent, context, history, learner, language);

  const navigation = decidedChat ? null : resolveNavigationRequest(message, coach.stats)
    ?? (decidedNavigate ? navigationForIntent(turnIntent, coach.stats) : null);
  const reply = navigation
    ? (decidedNavigate ? openedReply(navigation, language) : navigationReply(navigation, language))
    : (await answerTurn({
        messages: coach.messages,
        message,
        intent: turnIntent,
        context,
        flavor: 'coach',
        offline: coach.offline,
        learnerData: coach.learnerData,
      })).reply;
  const aiReply = withResolvedAction(reply, coach.stats, language);
  const route = !decidedChat && aiReply.action ? 'navigate' : 'open_prompt';
  return saveBuddyAnswer(userId, chatId, message, aiReply, route);
}

async function saveBuddyAnswer(
  userId: number,
  chatId: number,
  message: string,
  aiReply: AiReply,
  route: BuddyAnswer['route'],
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
    language: buddyLanguage(message),
    followups: aiReply.followups,
    action: aiReply.action,
    feedback: toSavedFeedback(aiReply, message, saved.userMessage.id),
    suggestion: aiReply.reminder ?? inferReminderFromMessage(message),
    route,
  };
}
