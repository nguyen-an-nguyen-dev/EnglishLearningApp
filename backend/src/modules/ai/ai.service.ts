import { HttpError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';
import { getCounts as getReviewCounts } from '../analytics/review.repository';
import { getLeague, getShop, getWallet } from '../gamification/gamification.service';
import { parseBuddyCommand } from './ai.commands';
import {
  buildBuddyTurnContext, createBuddyCatalogueReads, matchShopItem, resolveBuddyRank,
  resolveBuddyStudyCommand, resolveExactShopItem, resolveExactVideo,
} from './ai.copilot';
import type { BuddyCatalogueReads, BuddyGuideContext, BuddyTurnContext } from './ai.copilot';
import { buddyLanguage, buddyReplyLanguage, isOperationRequest, normalizeDestination, normalizeOperationRequest } from './ai.language';
import type { BuddyLanguage } from './ai.language';
import { explicitLearningIntent, isBriefTutorTurn, isGrammarExplanation } from './ai.intent';
import { learningHistoryLimit, destinationSelection, lastDestinations, referencedDestinations, type DestinationSelection } from './ai.memory';
import { answerNotebookQuestion } from './ai.vocabulary';
import { inferReminderFromMessage } from './ai.parsing';
import { answerRecommendation } from './ai.recommendations';
import { answerTimedStudyPlan } from './ai.schedule';
import { videoCatalogueQuery, withinVideoDuration } from './ai.search';
import { answerTurn, resolveTurnIntent } from './ai.pipeline';
import { answerGrammarExercise } from './ai.practice';
import { catalogueScope, createPlanMessages, isShortIntent, toCoachMessages, toTutorMessages } from './ai.prompts';
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
  CoachLearnerContext,
  CoachMessageRow,
  LearnerContext,
  MessageRow,
  ReminderSuggestion,
  StudyPlan,
} from './ai.types';

/** Cap for chat, plan and study-plan replies; the prompt asks for far less. */
const SHORT_REPLY_TOKENS = 700;
const PLAN_NOTE_TTL_MS = 5 * 60_000;
const MAX_PLAN_NOTES = 256;
const TUTOR_OPENERS: Record<Exclude<AiTopic, 'STUDY_COACH'>, string> = {
  DAILY_CONVERSATION: 'How was your day?',
  TRAVEL: 'Where would you like to travel?',
  FOOD: 'What is your favorite food?',
  SHOPPING: 'What would you like to buy today?',
  SCHOOL: 'What subject do you enjoy most at school?',
  FAMILY: 'Who do you live with in your family?',
  HOBBIES: 'What do you like to do in your free time?',
  JOB_INTERVIEW: 'Could you tell me a little about yourself?',
};
const studyDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short' });
type PlanNote = { input: string; expiresAt: number | null; result: Promise<string | null> };
const planNotes = new Map<number, PlanNote>();

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

export async function getChat(userId: number, chatId: number, includeDestinations = false) {
  const chat = await repository.getChat(userId, chatId);
  if (!chat) throw new HttpError(404, 'Chat not found.');
  const messages = includeDestinations
    ? (await repository.getCoachConversationHistory(chatId)).map(({ destinations, presentedDestinations, ...message }) => {
        const actions = presentedDestinations ?? destinations;
        return actions?.length ? { ...message, actions } : message;
      })
    : await repository.getMessages(chatId);
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
  userId: number,
  message: string,
  intent: ChatIntent,
  context: ChatContext | null,
  history: CoachMessageRow[],
  learner: CoachLearnerContext,
  snapshot: BuddyTurnContext,
  language: BuddyLanguage,
  signal?: AbortSignal,
  onDraft?: (text: string) => void,
): Promise<AiReply> {
  const stats = snapshot.study;
  const effectiveIntent = intent === 'chat' ? explicitLearningIntent(message) ?? intent : intent;
  const studySnapshot = toStudySnapshot(learner, stats);
  const steps = buildStudyPlan(studySnapshot, stats);
  const confirmed = confirmedOperation(message, history);
  const guideMessage = confirmed ?? message;
  const command = guideCommand(guideMessage);
  const needsShop = catalogueScope(message, context, history).shop || command?.kind === 'shopItem' || command?.kind === 'shopCatalog'
    || referencedDestinations(message, history)?.some(isShopDestination);
  const shop = needsShop ? await snapshot.readShop() : null;
  const knownShop = shop ?? { coins: snapshot.wallet.coins, items: [] };
  const guide = await resolveGuideTurn(userId, guideMessage, command, {
    study: stats, wallet: snapshot.wallet, shop: knownShop,
  }, learner, context);
  if (confirmed && guide?.action) return guide;

  const offline = guide
    ?? reminderOnlyReply(message, language)
    ?? buildOfflineCoachReply(studySnapshot, steps, effectiveIntent, context, language);
  const reply = await answerTurn({
    messages: toCoachMessages(history, message, learner, studySnapshot, steps, effectiveIntent, context, stats, language, knownShop),
    flavor: 'coach',
    offline,
    maxTokens: isShortIntent(effectiveIntent) ? 480 : 850,
    buddy: true,
    signal,
    onDraft: isOperationRequest(message) || /\b(?:nhac|remind)\b/.test(normalizeDestination(message))
      ? undefined : onDraft,
  });
  const hasShopAction = (reply.action && isShopDestination(reply.action)) || reply.actions?.some(isShopDestination);
  const actionShop = shop ?? (hasShopAction ? await snapshot.readShop() : null);
  const durationLimit = command?.kind === 'video' && command.params.choice === 'topic' && !command.params.code
    ? videoCatalogueQuery(command.params.topic)?.maxSeconds : undefined;
  const actionStats = durationLimit === undefined ? stats : {
    ...stats,
    videoCatalog: stats.videoCatalog.filter((item) => withinVideoDuration(item, durationLimit)),
    ownedVideoCatalog: stats.ownedVideoCatalog?.filter((item) => withinVideoDuration(item, durationLimit)),
  };
  const resolved = withResolvedAction(reply, actionStats, language, actionShop?.items, isGrammarExplanation(message));
  if (durationLimit !== undefined && guide && !resolved.action && !resolved.actions?.length
    && (reply.action?.kind === 'open_video' || reply.actions?.some(({ kind }) => kind === 'open_video'))) return guide;
  if (resolved.action || !isOperationRequest(confirmed ?? message)) return resolved;
  if (guide?.action) {
    const item = wantsOperationDetails(message) ? shop?.items.find(({ code }) => code === guide.action?.itemCode) : undefined;
    return item?.description ? { ...guide, reply: `“${item.name}” — ${item.description} ${guide.reply}` } : guide;
  }
  if (guide?.followups.length) {
    return operationOffer(resolved.reply) ? { ...resolved, followups: guide.followups } : guide;
  }
  const spoken = normalizeDestination(resolved.reply);
  const claimed = /\b(?:(?:da|dang|se) (?:mo|chuyen|hien|lam noi bat)|mo .{1,100} roi|(?:opened|opening|switched|highlighted))\b/.test(spoken)
    || (/^(?:minh|toi) (?:mo|chuyen|hien)\b/.test(spoken) && !operationOffer(resolved.reply));
  return claimed ? guide ?? {
    ...resolved,
    reply: language === 'en' ? 'I couldn’t find that destination. Which screen or item should I open?'
      : 'Mình chưa xác định được chỗ cần mở. Bạn muốn tới màn hình hoặc xem món nào?',
  } : resolved;
}

function wantsOperationDetails(message: string): boolean {
  return isOperationRequest(message)
    && /\b(?:gioi thieu|giai thich|introduce|explain|describe|tell me about)\b/.test(normalizeDestination(message));
}

function operationOffer(reply: string): string | null {
  const offer = /(?:^|[.!?…]\s+)([^.!?…]+)\?\s*$/u.exec(reply)?.[1];
  if (!offer) return null;
  const target = normalizeDestination(offer)
    .replace(/^ban (?:co )?muon (?:minh|toi) /, '')
    .replace(/^(?:minh|toi) (?:co the )?mo (?:the )?/, 'mo ')
    .replace(/^mo the /, 'mo ')
    .replace(/^(?:shall i|should i|would you like me to) (?:open|show)(?: you)? /, 'open ')
    .replace(/ (?:nhe|nha|duoc khong|khong|cho ban|for you)$/, '');
  return isOperationRequest(target) ? target : null;
}

function confirmedOperation(message: string, history: MessageRow[]): string | null {
  if (!/^(?:ok|oke|okay|yes|sure|duoc|dong y|vang|mo di|mo luon|yes please|go ahead)$/.test(normalizeDestination(message))) {
    return null;
  }
  const [question, response] = history.slice(-2);
  if (question?.role !== 'USER' || response?.role !== 'AI'
    || !isOperationRequest(question.content) || Date.now() - new Date(response.created_at).getTime() > 5 * 60_000) return null;

  return operationOffer(response.content);
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

function directCompoundReply(message: string, language: BuddyLanguage): AiReply | null {
  const clauses = message.trim().split(/,?\s+(?:and then|and|then|và sau đó|sau đó|rồi|và|đồng thời)\s+/iu);
  if (clauses.length < 2 || clauses.length > 4) return null;
  const actions: ChatAction[] = [];
  let reminder: ReminderSuggestion | null = null;
  for (const clause of clauses) {
    const text = normalizeDestination(clause);
    if (/^(?:please )?remind me\b|^nhac (?:minh|toi|em|to)\b/u.test(text)) {
      if (reminder || /\b(?:or|hoac)\b/u.test(text)) return null;
      reminder = inferReminderFromMessage(clause);
      if (!reminder || (!reminder.at_time && !(Number(reminder.in_minutes) > 0))) return null;
      continue;
    }
    const action = isOperationRequest(clause) ? resolveNavigationRequest(clause) : null;
    if (!action || actions.length === 3) return null;
    actions.push(action);
  }
  const distinct = [...new Map(actions.map((action) =>
    [JSON.stringify([action.kind, action.tab, action.highlight]), action])).values()];
  if (distinct.length < (reminder ? 1 : 2)) return null;
  const en = language === 'en';
  return {
    reply: reminder
      ? (en ? 'Choose a destination below and confirm your reminder.' : 'Chọn mục cần mở và xác nhận lời nhắc bên dưới.')
      : (en ? 'Choose a destination below.' : 'Chọn mục bạn muốn mở bên dưới.'),
    action: distinct[0],
    ...(distinct.length > 1 ? { actions: distinct } : {}),
    reminder, feedback: [], followups: [],
  };
}

function guideCommand(message: string) {
  const original = parseBuddyCommand(message);
  const normalized = normalizeOperationRequest(message);
  const parsed = original?.kind === 'shopItem' && !original.params.item
    ? original
    : normalized === normalizeDestination(message) ? original : parseBuddyCommand(normalized) ?? original;
  return parsed && { ...parsed, language: buddyLanguage(message) };
}

function isShopDestination(action: ChatAction): boolean {
  return action.kind === 'show_shop_item' || action.kind === 'buy_shop_item';
}

async function resolveGuideTurn(
  userId: number,
  message: string,
  command: ReturnType<typeof guideCommand>,
  snapshot: BuddyGuideContext,
  learner: Pick<LearnerContext, 'weakTopics'>,
  context: ChatContext | null,
): Promise<AiReply | null> {
  const language = command?.language ?? buddyLanguage(message);
  const navigation = resolveNavigationRequest(message, snapshot.study);
  const shopRequest = command?.kind === 'shopItem' && (
    /\b(gara|shop|garage|cua hang|xe|car|khung|frame|nameplate|booster|khien|shield)\b/.test(normalizeDestination(message))
    || command.params.buy
    || Boolean(matchShopItem(command.params.item, snapshot.shop.items))
  );
  const reply = command?.kind === 'rank'
    ? resolveBuddyRank(language, await getLeague(userId))
    : command && command.kind !== 'shopItem'
    ? resolveBuddyStudyCommand(command, snapshot, learner, context)
    : navigation
      ? openedReply(navigation, language)
      : shopRequest
        ? resolveBuddyStudyCommand({
          ...command,
          params: { ...command.params, preferEquipped: !command.params.buy && wantsOperationDetails(message) },
        }, snapshot, learner)
        : null;
  return reply ? withResolvedAction(reply, snapshot.study, language, snapshot.shop.items) : null;
}

function withResolvedAction(
  reply: AiReply,
  stats: StudyStats,
  language: BuddyLanguage,
  shopItems?: Parameters<typeof resolveChatAction>[2],
  suggestOnly = false,
): AiReply {
  const actions = new Map<string, ChatAction>();
  for (const candidate of [reply.action, ...(reply.actions ?? [])]) {
    const action = resolveChatAction(candidate, stats, shopItems);
    if (!action) continue;
    if (action.kind === 'open_lesson') {
      const title = action.lessonTitle ?? '';
      action.label = (action.mode === 'reveal'
        ? (language === 'en' ? `Locate lesson ${title}` : `Chỉ vị trí bài ${title}`)
        : (language === 'en' ? `Open lesson ${title}` : `Mở bài: ${title}`)).slice(0, 80);
    }
    const key = JSON.stringify([action.kind, action.tab, action.lessonId, action.videoId, action.mode, action.itemCode, action.highlight]);
    if (!actions.has(key)) actions.set(key, action);
    if (actions.size === 3) break;
  }

  const destinations = [...actions.values()];
  if (suggestOnly) {
    return { ...reply, action: null, actions: destinations.length ? destinations : undefined };
  }
  const action = destinations[0] ?? null;
  const resolved = { ...reply, action, actions: destinations.length > 1 ? destinations : undefined };
  const locked = destinations.length === 1 && action?.kind === 'open_lesson' && action.lessonId
    ? lessonPrerequisites(stats, action.lessonId) : null;
  if (!locked) return resolved;
  return {
    ...resolved,
    reply: language === 'en'
      ? `“${action?.lessonTitle}” is locked. Complete ${locked.remaining} ${locked.remaining === 1 ? 'lesson' : 'lessons'}, starting with “${locked.frontier.title}”.`
      : `Bài “${action?.lessonTitle}” đang khóa. Bạn cần hoàn thành ${locked.remaining} bài, bắt đầu từ “${locked.frontier.title}”.`,
    feedback: [],
    followups: [],
  };
}

function destinationsOf(reply: AiReply): ChatAction[] {
  return reply.actions ?? (reply.action ? [reply.action] : []);
}

async function answerRememberedDestination(
  userId: number,
  selection: DestinationSelection,
  history: CoachMessageRow[],
  language: BuddyLanguage,
): Promise<AiReply | null> {
  const destinations = lastDestinations(history);
  if (!destinations?.length || (selection === 'only' && destinations.length !== 1)) return null;
  const candidate = selection === 'last' ? destinations.at(-1)
    : destinations[selection === 'only' ? 0 : selection - 1];
  const unavailable = (reply: string): AiReply => ({ reply, action: null, followups: [], feedback: [], reminder: null });
  if (!candidate) {
    return unavailable(language === 'en' ? 'That option was not in the previous list.' : 'Lựa chọn đó không có trong danh sách vừa rồi.');
  }

  let action: ChatAction | null;
  if (candidate.kind === 'open_lesson') {
    const reply = withResolvedAction(openedReply(candidate, language), await repository.getStudyStats(userId), language);
    if (reply.action) return reply;
    action = null;
  } else if (candidate.kind === 'open_video' && candidate.videoId !== undefined) {
    const video = await repository.getVisibleVideoReference(userId, candidate.videoId);
    action = video ? resolveChatAction(candidate, { videoCatalog: [video] }) : null;
  } else if (candidate.kind === 'show_shop_item') {
    action = resolveChatAction(candidate, {}, (await getShop(userId)).items);
  } else {
    action = resolveChatAction(candidate);
  }
  if (!action) {
    return unavailable(language === 'en' ? 'That destination is no longer available.' : 'Mục đó hiện không còn khả dụng.');
  }
  const result = openedReply(action, language);
  const title = action.videoTitle ?? action.itemName;
  return title
    ? { ...result, reply: language === 'en' ? `Opening “${title}”.` : `Mình mở “${title}”.` }
    : result;
}

function toSavedFeedback(aiReply: AiReply, message: string, messageId: number) {
  return aiReply.feedback.map((item) => ({
    ...item,
    original_text: message,
    message_id: messageId,
  }));
}

function getPlanNote(userId: number, snapshot: StudyPlan['snapshot'], steps: StudyPlan['steps']): PlanNote {
  const messages = createPlanMessages(snapshot, steps);
  const input = `${studyDay.format(new Date())}\n${JSON.stringify(messages)}`;
  const cached = planNotes.get(userId);
  if (cached?.input === input && (cached.expiresAt === null || Date.now() < cached.expiresAt)) {
    planNotes.delete(userId);
    planNotes.set(userId, cached);
    return cached;
  }

  // A note can be shared by multiple requests, so it has its own provider deadline.
  const entry: PlanNote = {
    input,
    expiresAt: null,
    result: answerTurn({
      messages, flavor: 'coach', offline: null, maxTokens: SHORT_REPLY_TOKENS, brief: true,
    }).then(({ reply }) => reply.slice(0, 600)).catch(() => null),
  };
  planNotes.delete(userId);
  planNotes.set(userId, entry);
  if (planNotes.size > MAX_PLAN_NOTES) {
    for (const oldest of planNotes.keys()) {
      planNotes.delete(oldest);
      break;
    }
  }
  void entry.result.then((note) => {
    if (note === null) {
      if (planNotes.get(userId) === entry) planNotes.delete(userId);
    } else {
      entry.expiresAt = Date.now() + PLAN_NOTE_TTL_MS;
    }
  });
  return entry;
}

export async function getStudyPlan(
  userId: number,
  signal?: AbortSignal,
  onPlan?: (plan: StudyPlan) => void,
): Promise<StudyPlan> {
  const [learner, stats] = await Promise.all([
    repository.getStudyLearnerContext(userId),
    repository.getStudyStats(userId),
  ]);
  signal?.throwIfAborted();
  const snapshot = toStudySnapshot(learner, stats);
  const steps = buildStudyPlan(snapshot, stats);
  const note = getPlanNote(userId, snapshot, steps);
  if (note.expiresAt === null) onPlan?.({ snapshot, steps, aiNote: null, generatedAt: new Date().toISOString() });
  const aiNote = await note.result;
  return { snapshot, steps, aiNote, generatedAt: new Date().toISOString() };
}

export async function sendMessage(
  userId: number,
  chatId: number,
  message: string,
  intent: ChatIntent = 'chat',
  context: ChatContext | null = null,
  signal?: AbortSignal,
  onDraft?: (text: string) => void,
) {
  signal?.throwIfAborted();
  const chat = await repository.getChat(userId, chatId);
  if (!chat) throw new HttpError(404, 'Chat not found.');
  signal?.throwIfAborted();
  const language = buddyLanguage(message);
  const catalogue = createBuddyCatalogueReads(userId);
  let isCoach = chat.topic === 'STUDY_COACH';
  let aiReply: AiReply | undefined;
  let rememberedDestinations: ChatAction[] | undefined;
  if (chat.topic !== 'STUDY_COACH' && intent === 'chat' && chat.last_message === null && greetingLanguage(message)) {
    aiReply = { reply: `Hi! ${TUTOR_OPENERS[chat.topic]}`, feedback: [], followups: [], action: null, reminder: null };
  }
  if (isCoach && (intent === 'chat' || intent === 'practice')) {
    aiReply = answerGrammarExercise(message, language) ?? undefined;
  }
  if (isCoach && !aiReply && (intent === 'chat' || intent === 'plan')) {
    aiReply = await answerTimedStudyPlan(userId, message, language) ?? undefined;
  }
  if (isCoach && intent === 'chat') {
    aiReply ??= buddyGreeting(message)?.reply;
    if (!aiReply) {
      const direct = await directBuddyReply(userId, message, language, context, catalogue);
      // The chat API's existing clients do not display reminder confirmation.
      if (direct && !direct.reply.reminder) aiReply = direct.reply;
    }
  }
  if (!aiReply) {
    const historyRequest = repository.getCoachConversationHistory(chatId, learningHistoryLimit(message));
    const selection = isCoach && intent === 'chat' ? destinationSelection(message) : null;
    if (selection !== null) {
      const history = await historyRequest;
      const remembered = await answerRememberedDestination(userId, selection, history, language);
      if (remembered) {
        aiReply = remembered;
        rememberedDestinations = lastDestinations(history);
      }
    }
    if (!aiReply && (isCoach || intent !== 'chat')) {
      isCoach = true;
      const [history, learner, snapshot] = await Promise.all([
        historyRequest,
        repository.getCoachLearnerContext(userId),
        buildBuddyTurnContext(userId, catalogueScope(message, context, []).shop, catalogue),
      ]);
      aiReply = await answerCoachTurn(userId, message, intent, context, history, learner, snapshot, language, signal, onDraft);
    } else if (!aiReply) {
      const [history, learner, turnIntent] = await Promise.all([
        historyRequest,
        repository.getLearnerContext(userId),
        resolveTurnIntent(message, intent, context, signal),
      ]);
      isCoach = turnIntent !== 'chat';
      if (isCoach) {
        aiReply = await answerCoachTurn(userId, message, turnIntent, context, history, learner,
          await buildBuddyTurnContext(userId, catalogueScope(message, context, []).shop, catalogue), language, signal, onDraft);
      } else {
        aiReply = await answerTurn({
          messages: toTutorMessages(history, message, chat.topic, learner),
          flavor: 'tutor',
          offline: null,
          brief: isBriefTutorTurn(message),
          signal,
          onDraft,
        });
      }
    }
  }

  signal?.throwIfAborted();
  const saved = await repository.saveConversation(
    userId,
    chatId,
    message,
    aiReply.reply,
    aiReply.feedback.map((item) => ({ ...item, original_text: message })),
    isCoach ? rememberedDestinations ?? destinationsOf(aiReply) : [],
    isCoach && rememberedDestinations ? destinationsOf(aiReply) : undefined,
  );
  return {
    ...saved,
    feedback: toSavedFeedback(aiReply, message, saved.userMessage.id),
    followups: aiReply.followups,
    action: isCoach ? aiReply.action : null,
    ...(isCoach && aiReply.actions ? { actions: aiReply.actions } : {}),
  };
}

export interface BuddyAnswer {
  reply: string;
  language: BuddyLanguage;
  followups: string[];
  action: ChatAction | null;
  actions?: ChatAction[];
  keepChatOpen?: boolean;
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
  signal?: AbortSignal,
  onDraft?: (text: string) => void,
): Promise<BuddyAnswer> {
  signal?.throwIfAborted();
  const started = performance.now();
  const greeting = intent === 'chat' ? buddyGreeting(message) : null;
  const requestedLanguage = buddyLanguage(message);
  const catalogue = createBuddyCatalogueReads(userId);
  const practice = intent === 'chat' || intent === 'practice' ? answerGrammarExercise(message, requestedLanguage) : null;
  const timedPlan = !greeting && !practice && (intent === 'chat' || intent === 'plan')
    ? answerTimedStudyPlan(userId, message, requestedLanguage) : null;
  const local = greeting ? Promise.resolve({ reply: greeting.reply, path: 'greeting' })
    : practice ? Promise.resolve({ reply: practice, path: 'practice' })
      : timedPlan ? timedPlan.then((reply) => ({ reply, path: 'timed-plan' }))
        : intent === 'chat' ? directBuddyReply(userId, message, requestedLanguage, context, catalogue) : null;
  let path = 'coach';
  let contextMs: number | undefined;
  let answerMs: number | undefined;
  let saveMs: number | undefined;
  let succeeded = false;

  try {
    let chatId: number;
    let reply: AiReply;
    let rememberedDestinations: ChatAction[] | undefined;
    let language: BuddyLanguage;
    const chatIdRequest = repository.ensureCoachChat(userId);
    const direct = local ? (await Promise.all([chatIdRequest, local]))[1] : null;
    if (direct) {
      chatId = await chatIdRequest;
      contextMs = performance.now() - started;
      reply = direct.reply;
      language = greeting?.language ?? requestedLanguage;
      path = direct.path;
    } else {
      const coachChat = chatIdRequest.then(async (id) => ({
        id,
        history: await repository.getCoachConversationHistory(id, learningHistoryLimit(message)),
      }));
      const selection = intent === 'chat' ? destinationSelection(message) : null;
      const remembered = selection === null
        ? null : await answerRememberedDestination(userId, selection, (await coachChat).history, requestedLanguage);
      language = requestedLanguage;
      if (remembered) {
        const chat = await coachChat;
        chatId = chat.id;
        rememberedDestinations = lastDestinations(chat.history);
        contextMs = performance.now() - started;
        path = 'remembered-destination';
        reply = remembered;
      } else {
        const [chat, snapshot, learner] = await Promise.all([
          coachChat,
          buildBuddyTurnContext(userId, catalogueScope(message, context, []).shop, catalogue),
          repository.getCoachLearnerContext(userId),
        ]);
        chatId = chat.id;
        const ready = performance.now();
        contextMs = ready - started;
        reply = await answerCoachTurn(
          userId, message, intent, context, chat.history, learner, snapshot, language, signal, onDraft,
        );
        answerMs = performance.now() - ready;
      }
    }
    signal?.throwIfAborted();
    const saving = performance.now();
    const result = await saveBuddyAnswer(userId, chatId, message, reply, language, rememberedDestinations);
    saveMs = performance.now() - saving;
    succeeded = true;
    return result;
  } finally {
    logger.info('buddy_ask_timing', {
      path,
      succeeded,
      context_ms: contextMs === undefined ? undefined : Math.round(contextMs),
      answer_ms: answerMs === undefined ? undefined : Math.round(answerMs),
      save_ms: saveMs === undefined ? undefined : Math.round(saveMs),
      total_ms: Math.round(performance.now() - started),
    });
  }
}

type DirectBuddyReply = {
  reply: AiReply;
  path: 'compound' | 'reminder' | 'navigation' | 'wallet' | 'video' | 'shop' | 'review' | 'notebook' | 'recommendation';
};

function directBuddyReply(
  userId: number,
  message: string,
  language: BuddyLanguage,
  context: ChatContext | null,
  catalogue: BuddyCatalogueReads,
): Promise<DirectBuddyReply | null> | null {
  const compound = directCompoundReply(message, language);
  if (compound) return Promise.resolve({ reply: compound, path: 'compound' });
  const normalized = normalizeDestination(message);
  if (/\b(?:va|roi|sau do|dong thoi|and|then|also) (?:hay |please )?(?:mo|chuyen|vao|tim|nhac|open|switch|find|show|remind|start)\b/.test(normalized)) return null;
  if (/^(?:(?:buddy|ban) )?(?:nhac (?:minh|toi|to|em)\b|(?:please )?remind me\b)/.test(normalized)) {
    const reply = reminderOnlyReply(message, language);
    if (reply?.reminder && (reply.reminder.at_time || (reply.reminder.in_minutes ?? 0) > 0)) {
      return Promise.resolve({ reply, path: 'reminder' });
    }
  }

  const action = resolveNavigationRequest(message);
  if (action) return Promise.resolve({ reply: openedReply(action, language), path: 'navigation' });

  if (/^how many (?:items (?:are )?due for review|reviews (?:are )?due(?: today)?|items do i have to review(?: today)?)$/.test(normalized)
    || /^(?:hom nay )?(?:(?:minh|toi|em) (?:co|con) )?bao nhieu muc (?:can|den han) on(?: tap)?(?: hom nay)?$/.test(normalized)) {
    return getReviewCounts(userId).then(({ due }) => ({
      path: 'review',
      reply: {
        reply: language === 'en'
          ? (due ? `You have ${due} ${due === 1 ? 'item' : 'items'} due for review.` : 'Nothing is due for review right now.')
          : (due ? `Bạn có ${due} mục đến hạn ôn tập.` : 'Hiện chưa có mục nào đến hạn ôn tập.'),
        followups: due ? [language === 'en' ? 'Open review' : 'Mở ôn tập'] : [],
        action: null,
        feedback: [],
        reminder: null,
      },
    }));
  }

  if (/^(?:(?:minh|toi|em) (?:co|con) )?bao nhieu (?:rc|race coins?)(?: (?:roi|vay))?$|^how (?:much|many) (?:rc|race coins?) do i have$/.test(normalized)) {
    return getWallet(userId).then(({ coins }) => ({
      path: 'wallet',
      reply: {
        reply: language === 'en' ? `You have ${coins} RC.` : `Bạn có ${coins} RC.`,
        action: { kind: 'spotlight', tab: 'profile', highlight: 'wallet:summary', label: language === 'en' ? 'View balance' : 'Xem số dư' },
        feedback: [], followups: [], reminder: null,
      },
    }));
  }

  const notebook = answerNotebookQuestion(userId, message, language);
  if (notebook) return notebook.then((reply) => ({ path: 'notebook', reply }));
  const recommendation = answerRecommendation(userId, message, language);
  if (recommendation) return recommendation.then((reply) => ({ path: 'recommendation', reply }));

  const command = guideCommand(message);
  if (command?.kind === 'shopItem' && command.params.item && !command.params.buy
    && (context?.tab === 'shop' || /\b(?:shop|garage|gara|cua hang)\b/u.test(normalized))
    && /^(?:find|show|open|look for|see|tim|xem|mo)\b/u.test(normalizeOperationRequest(message))
    && !wantsOperationDetails(message)) {
    return catalogue.readShop().then((shop) => {
      const reply = resolveExactShopItem(command, shop);
      return reply && { path: 'shop', reply };
    });
  }
  if (command?.kind === 'video' && command.params.choice === 'topic'
    && (command.params.lookupOnly || isOperationRequest(message) || /^(?:watch|play)\b/u.test(normalized))
    && !wantsOperationDetails(message)) {
    return catalogue.readVideos().then((libraries) => {
      const reply = resolveExactVideo(command, libraries, context);
      return reply && { path: 'video', reply };
    });
  }
  if (command?.kind !== 'video' || command.params.choice !== 'random') return null;
  if (!/\b(?:ngau nhien|bat ky|bat ki|nao do|nao cung duoc|gi cung duoc)(?: (?:nhe|voi|giup minh))?$|\b(?:random|any) (?:my |private )?(?:video|clip)(?: please)?$/.test(normalized)) {
    return null;
  }
  return repository.getBuddyVideoCatalog(userId, command.params.owned === true).then((catalog) => {
    const available = catalog.filter((video) => !video.completed);
    const choices = available.length ? available : catalog;
    const video = choices[Math.floor(Math.random() * choices.length)];
    const action: ChatAction | null = video ? {
      kind: 'open_video', tab: 'videos', videoId: video.id, videoTitle: video.title, label: video.title.slice(0, 80),
    } : null;
    return {
      path: 'video',
      reply: action ? openedReply(action, language) : {
        reply: language === 'en' ? 'There are no videos available in that library.' : 'Thư viện này chưa có video để mở.',
        action: null, feedback: [], followups: [], reminder: null,
      },
    };
  });
}

function greetingLanguage(message: string): BuddyLanguage | null {
  // Strip only trailing sentence punctuation so questions or appended requests
  // cannot be mistaken for a greeting.
  const text = message.normalize('NFC').toLowerCase().trim().replace(/[!.…]+$/, '').trim();
  return /^(xin chào|xin chao|chào bạn|chao ban|chào)$/.test(text) ? 'vi'
    : /^(hello|hi|hey|hello there)$/.test(text) ? 'en'
    : null;
}

function buddyGreeting(message: string): { reply: AiReply; language: BuddyLanguage } | null {
  let language = greetingLanguage(message);
  let reply = language === 'en' ? 'Hi! How can I help you today?' : 'Chào bạn! Hôm nay mình có thể giúp gì cho bạn?';
  let followups: string[] = [];

  if (!language) {
    // A voice transcript can punctuate a salutation as its own sentence.
    // Match the entire turn so learning questions still use the normal routing.
    const text = message.normalize('NFC').toLowerCase().trim().replace(/[!?.…]+$/u, '').trim();
    const checkIn = /^(?:(hi|hey|hello(?: there)?|good (?:morning|afternoon|evening))[\s,.!?…]+)?how are you(?: today)?$/u.exec(text);
    const timedGreeting = /^good (?:morning|afternoon|evening)$/u.test(text);
    const vietnamese = text.normalize('NFD').replace(/\p{M}/gu, '');
    const vietnameseCheckIn = /^(?:(?:xin chao|chao ban|chao(?: buoi (?:sang|chieu|toi))?)[\s,.!?…]+)?ban khoe khong$/u.test(vietnamese);
    if (checkIn || timedGreeting) {
      language = 'en';
      const salutation = checkIn?.[1] ?? (timedGreeting ? text : '');
      const greeting = salutation ? `${salutation[0].toUpperCase()}${salutation.slice(1)}! ` : '';
      reply = `${greeting}${checkIn ? "I'm doing well, thanks. " : ''}How can I help with your English today?`;
      followups = ['How many items are due for review?', 'What can I study in ten minutes?'];
    } else if (vietnameseCheckIn || /^chao buoi (?:sang|chieu|toi)$/u.test(vietnamese)) {
      language = 'vi';
      reply = `${vietnameseCheckIn ? 'Mình khỏe, cảm ơn bạn! ' : 'Chào bạn! '}Hôm nay mình có thể giúp gì cho bạn?`;
      followups = ['Hôm nay mình còn bao nhiêu mục cần ôn tập?', 'Trong 10 phút, mình nên học gì?'];
    }
  }

  if (!language) return null;
  return {
    language,
    reply: {
      reply,
      feedback: [],
      followups,
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
  rememberedDestinations?: ChatAction[],
): Promise<BuddyAnswer> {
  const saved = await repository.saveConversation(
    userId,
    chatId,
    message,
    aiReply.reply,
    aiReply.feedback.map((item) => ({ ...item, original_text: message })),
    rememberedDestinations ?? destinationsOf(aiReply),
    rememberedDestinations ? destinationsOf(aiReply) : undefined,
  );

  return {
    reply: aiReply.reply,
    language: buddyReplyLanguage(aiReply.reply, language),
    followups: aiReply.followups,
    action: aiReply.action,
    ...(aiReply.actions ? { actions: aiReply.actions } : {}),
    ...(aiReply.action && (aiReply.actions || aiReply.reminder || wantsOperationDetails(message)) ? { keepChatOpen: true } : {}),
    feedback: toSavedFeedback(aiReply, message, saved.userMessage.id),
    suggestion: aiReply.reminder,
    route: aiReply.action ? 'navigate' : 'open_prompt',
  };
}
