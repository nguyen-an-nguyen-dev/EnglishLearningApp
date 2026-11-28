import { REVIEW_SESSION_LIMIT } from '../analytics/review.scheduler';
import type { ShopItem } from '../gamification/gamification.types';
import { buildLessonStates } from '../learning/learning.service';
import { normalizeDestination, normalizeOperationRequest } from './ai.language';
import type { BuddyLanguage } from './ai.language';
import type { StudyStats } from './ai.repository';
import { rankCatalog } from './ai.search';
import type {
  AiReply,
  ChatAction,
  ChatContext,
  ChatIntent,
  ChatTab,
  StudyLearnerContext,
  StudySnapshot,
  StudyStep,
} from './ai.types';

type LessonProgress = Pick<StudyStats, 'lessons' | 'completedLessonIds'>;

function lessonStates(stats: LessonProgress) {
  return buildLessonStates(stats.lessons.map(({ id }) => id), new Set(stats.completedLessonIds));
}

export function pickNextLesson(stats: StudyStats): StudySnapshot['nextLesson'] {
  const states = lessonStates(stats);
  const next = stats.lessons.find(({ id }) => states.get(id)?.status === 'unlocked');
  return next ? { id: next.id, title: next.title, topic: next.topic } : null;
}

export function lessonPrerequisites(stats: LessonProgress, lessonId: number) {
  const states = lessonStates(stats);
  if (states.get(lessonId)?.status !== 'locked') return null;
  const frontier = stats.lessons.findIndex(({ id }) => states.get(id)?.status === 'unlocked');
  const destination = stats.lessons.findIndex(({ id }) => id === lessonId);
  return { frontier: stats.lessons[frontier], remaining: destination - frontier };
}

export function toStudySnapshot(learner: StudyLearnerContext, stats: StudyStats): StudySnapshot {
  return {
    level: learner.level,
    xp: stats.xp,
    streak: stats.streak,
    completedLessons: stats.completedLessons,
    totalLessons: stats.totalLessons,
    weakTopics: learner.weakTopics,
    recentMistakes: learner.recentMistakes,
    nextLesson: pickNextLesson(stats),
    videosCompleted: stats.videosCompleted,
    videosTotal: stats.videosTotal,
    nextVideo: stats.nextVideo,
    ownedVideos: stats.ownedVideos,
    ownedVideoTitles: stats.ownedVideoTitles,
    savedWords: stats.savedWords,
    translations: stats.translations,
    battlesPlayed: stats.battlesPlayed,
    battleWins: stats.battleWins,
    badges: stats.badges,
    reviewDue: stats.reviewDue,
    reviewTotal: stats.reviewTotal,
    reviewWords: stats.reviewWords,
  };
}

/** Steps are computed from database rows, never invented by the model. */
export function buildStudyPlan(snapshot: StudySnapshot, stats: StudyStats): StudyStep[] {
  const steps: StudyStep[] = [];
  const next = snapshot.nextLesson;

  if (next) {
    steps.push({
      id: 'next-lesson',
      kind: 'lesson',
      title: `Học bài ${next.title}`,
      reason: `Bài tiếp theo đang mở trong lộ trình (${snapshot.completedLessons}/${snapshot.totalLessons} bài đã xong).`,
      minutes: 12,
      target: { tab: 'study', lessonId: next.id, lessonTitle: next.title },
    });
  } else {
    const last = stats.lessons.at(-1);
    steps.push({
      id: 'review-roadmap',
      kind: 'review',
      title: 'Ôn lại một bài đã hoàn thành',
      reason: 'Bạn đã đi hết lộ trình bài học; ôn lại để giữ nhịp trước khi mở nội dung mới.',
      minutes: 10,
      target: { tab: 'study', lessonId: last?.id, lessonTitle: last?.title },
    });
  }

  const weak = snapshot.weakTopics[0];
  if (weak) {
    steps.push({
      id: 'weak-topic',
      kind: 'review',
      title: `Gỡ lại chủ đề ${weak.topic}`,
      reason: `Bạn trả lời sai ${weak.mistakes} câu ở chủ đề này, đây là điểm yếu rõ nhất trong dữ liệu.`,
      minutes: 8,
      target: { tab: 'study' },
    });
  } else if (snapshot.savedWords > 0) {
    steps.push({
      id: 'saved-words',
      kind: 'vocab',
      title: 'Ôn 5 từ đã lưu trong sổ từ',
      reason: `Bạn đang có ${snapshot.savedWords} từ đã lưu; lặp lại ngắn hôm nay giúp nhớ lâu hơn.`,
      minutes: 5,
      target: { tab: 'videos' },
    });
  }

  // Items the schedule already says are due outrank anything speculative: they
  // are the exact words and questions this learner is about to forget.
  if (snapshot.reviewDue > 0) {
    const batch = Math.min(snapshot.reviewDue, REVIEW_SESSION_LIMIT);
    steps.splice(Math.min(1, steps.length), 0, {
      id: 'review-due',
      kind: 'review',
      title: `Ôn ${batch} mục đến hạn`,
      reason: snapshot.reviewWords > 0
        ? `${batch} mục đã tới lịch ôn, trong đó ${snapshot.reviewWords} từ vựng bạn từng làm sai.`
        : `${batch} câu bạn từng làm sai đã tới lịch ôn lại.`,
      minutes: Math.min(15, Math.max(5, batch * 1)),
      target: { tab: 'profile' },
    });
  }

  if (steps.length < 3 && snapshot.nextVideo && !steps.some((step) => step.kind === 'video')) {
    steps.push({
      id: 'next-video',
      kind: 'video',
      title: `Luyện nghe: ${snapshot.nextVideo.title}`,
      reason: 'Một video chưa hoàn thành. Luyện nghe 1 đoạn sau khi học bài mới.',
      minutes: 10,
      target: { tab: 'videos', videoId: snapshot.nextVideo.id },
    });
  }
  if (steps.length < 3) {
    steps.push({
      id: 'arena',
      kind: 'arena',
      title: 'Thử một trận đấu từ vựng',
      reason: snapshot.battlesPlayed > 0
        ? `Bạn đã đấu ${snapshot.battlesPlayed} trận, thắng ${snapshot.battleWins}. Vào đấu trường để áp dụng từ vừa học.`
        : 'Chưa có trận nào: một vòng đấu ngắn là cách nhanh để kiểm tra phản xạ từ.',
      minutes: 5,
      target: { tab: 'compete' },
    });
  }
  if (steps.length < 3) {
    steps.push({
      id: 'translate',
      kind: 'translate',
      title: 'Dịch một đoạn ngắn bạn quan tâm',
      reason: 'Đem từ mới vào ngữ cảnh thật bằng cách dịch một đoạn văn bản ngắn.',
      minutes: 7,
      target: { tab: 'translate' },
    });
  }

  return steps.slice(0, 3);
}

const SPOTLIGHT_TARGETS: Partial<Record<ChatTab, readonly string[]>> = {
  profile: ['profile:stats', 'profile:path', 'profile:badges', 'wallet:summary'],
  shop: ['wallet:summary', 'control:shop-catalog'],
  rankings: ['rank:me'],
  compete: ['control:arena-start'],
  videos: ['control:owned-videos'],
};

/** Only ids that exist in the real catalogue survive, so a hallucinated id
 * cannot send the learner to a dead screen. */
export function resolveChatAction(
  action: ChatAction | null,
  stats: Partial<LessonProgress> & {
    videoCatalog?: ReadonlyArray<Pick<StudyStats['videoCatalog'][number], 'id' | 'title'>>;
    ownedVideoCatalog?: ReadonlyArray<Pick<StudyStats['videoCatalog'][number], 'id' | 'title'>>;
  } = {},
  shopItems: readonly Pick<ShopItem, 'code' | 'name'>[] = [],
): ChatAction | null {
  if (!action || action.tab === 'admin') return null;
  if (action.kind === 'buy_shop_item') {
    // The buddy never spends the learner's coins. Turn a buy request into a
    // direct navigation to the real item card; the learner confirms the purchase.
    const item = shopItems.find(({ code }) => code === action.itemCode);
    if (!item) return null;
    return {
      kind: 'show_shop_item',
      tab: 'shop',
      itemCode: item.code,
      itemName: item.name,
      highlight: `shop:${item.code}`,
      label: `Mở ${item.name}`.slice(0, 60),
    };
  }
  if (action.kind === 'show_shop_item') {
    const item = shopItems.find(({ code }) => code === action.itemCode);
    if (!item) return null;
    return {
      kind: 'show_shop_item',
      tab: 'shop',
      itemCode: item.code,
      itemName: item.name,
      highlight: `shop:${item.code}`,
      label: action.label || item.name,
    };
  }
  if (action.kind === 'spotlight') {
    const { tab, highlight } = action;
    if (!tab || !highlight || !SPOTLIGHT_TARGETS[tab]?.includes(highlight)) return null;
    return { kind: 'spotlight', tab, highlight, label: action.label };
  }
  if (action.kind === 'open_video') {
    const video = stats.videoCatalog?.find((item) => item.id === action.videoId)
      ?? stats.ownedVideoCatalog?.find((item) => item.id === action.videoId);
    if (!video) return null;
    return {
      kind: 'open_video',
      tab: 'videos',
      videoId: video.id,
      videoTitle: video.title,
      label: `Mở video: ${video.title}`.slice(0, 60),
      ...(action.highlight === `video:${video.id}` ? { highlight: action.highlight } : {}),
    };
  }
  if (action.kind === 'open_lesson') {
    const { lessons, completedLessonIds } = stats;
    const lesson = lessons?.find((item) => item.id === action.lessonId);
    if (!lesson || !lessons || !completedLessonIds) return null;
    return {
      kind: 'open_lesson',
      tab: 'study',
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      mode: action.mode === 'reveal' || lessonPrerequisites({ lessons, completedLessonIds }, lesson.id) ? 'reveal' : 'open',
      label: `Mở bài: ${lesson.title}`.slice(0, 60),
      highlight: `lesson:${lesson.id}`,
    };
  }
  if (action.kind === 'open_notebook') {
    // The notebook is a view inside the video tab; without the control token
    // the web would land on the library instead of the saved words.
    return {
      kind: 'open_notebook',
      tab: 'videos',
      label: action.label || 'Mở Sổ từ vựng',
      highlight: action.highlight?.startsWith('word:') ? action.highlight : 'control:notebook',
    };
  }
  if (action.kind === 'open_review') {
    // Review is not a screen of its own; the profile button owns it. The action
    // still says "open_review" so the web can start the session in one tap.
    return { kind: 'open_review', tab: 'profile', label: action.label || 'Mở phiên ôn tập' };
  }
  const tab = action.tab;
  if (!tab) return null;
  const tabLabels: Record<ChatTab, string> = {
    study: 'Vào Lộ trình học',
    videos: 'Vào Học qua Video',
    translate: 'Vào Dịch tài liệu',
    compete: 'Vào Thi Đua',
    rankings: 'Vào Bảng xếp hạng',
    shop: 'Vào Gara',
    profile: 'Vào Hồ sơ',
    admin: 'Vào Quản trị nội dung',
  };
  return {
    kind: 'open_tab',
    tab,
    label: action.label || tabLabels[tab],
    ...(action.highlight && SPOTLIGHT_TARGETS[tab]?.includes(action.highlight) ? { highlight: action.highlight } : {}),
  };
}

function isQuestionAboutDestination(text: string): boolean {
  return /\b(la gi|the nao|tai sao|giai thich|what is|why|how does)\b/.test(text);
}

const DESTINATION_STOP_WORDS = new Set([
  'video','clip','bai','hoc','ve','cho','minh','toi','muon','mo','tim','xem','giup','vui','long','hay','the','mot','nao',
  'trang','thu','vien','noi','dung','chu','de','library','watch','listening','listen','play','lesson','study','learn','take','me','go','to','next','open','about','please','a','the',
]);

export function hasSpecificTopic(text: string): boolean {
  return text.split(' ').some((word) => word.length > 2 && !DESTINATION_STOP_WORDS.has(word));
}

/**
 * Deterministic navigation takes precedence over generative copy. Every video
 * and lesson target comes from the current database-backed study snapshot.
 */
export function resolveNavigationRequest(message: string, stats?: StudyStats): ChatAction | null {
  const text = normalizeOperationRequest(message);
  if (!text || isQuestionAboutDestination(text)
    || /\b(nhac (?:minh|toi|em|nho)|remind|dung (?:mo|chuyen|tim)|do not|don t)\b/.test(text)) return null;
  const destination = text
    .replace(/^(?:en buddy |buddy |please |lam on )/, '')
    .replace(/^(?:(?:toi|minh|em) muon |ban |i (?:want|would like) to )/, '')
    .replace(/^(?:(?:cho|dua) (?:minh|toi|em) (?:xem|den|toi|vao)|mo(?: trang| tab)?|vao(?: tab)?|chuyen(?: tab)?(?: sang| qua)?(?: tab)?|di (?:den|toi)|xem|open(?: the)?|switch to(?: the)?|take me to(?: the)?|go to(?: the)?|show me(?: the)?) /, '')
    .replace(/ (?:giup (?:minh|toi|em)|cho (?:minh|toi|em)|voi|nhe|nha|di|please)$/, '')
    .replace(/ (?:tab|screen)$/, '');

  if (/^(?:tim tran(?: dau)?|tim doi thu|ghep tran|vao tran|find (?:a match|an opponent)|matchmaking|start matchmaking)(?: (?:thi dua|thi dau|1v1))?$/.test(destination)) {
    return { kind: 'spotlight', tab: 'compete', highlight: 'control:arena-start', label: 'Tìm trận' };
  }
  if (/^(?:on tap|on lai|bai can on|phien on tap|review|(?:my )?review queue)$/.test(destination)) {
    return { kind: 'open_review', tab: 'profile', label: 'Bắt đầu ôn tập' };
  }
  if (/^(?:so tu(?: vung)?|tu da luu|on tu|(?:my )?(?:notebook|vocabulary notebook|saved words))$/.test(destination)) {
    return { kind: 'open_notebook', tab: 'videos', label: 'Mở Sổ từ vựng', highlight: 'control:notebook' };
  }
  if (/^(?:bang xep hang(?: tuan)?|xep hang|leaderboard|weekly rankings?)(?: (?:cua|cho|va|and) .+)?$/.test(destination)
    && (/\b(?:vi tri|hang cua (?:minh|toi)|my rank|my position|cua (?:minh|toi))\b/.test(destination) || text !== normalizeDestination(message))) {
    return { kind: 'spotlight', tab: 'rankings', highlight: 'rank:me', label: 'Xem hạng tuần' };
  }

  const command = /^(?:(?:minh|toi) muon )?(?:mo|tim|xem|vao|chuyen|hoc|open|find|watch|study|take me|go to)\b/.test(text);
  const videoMentioned = command && /\b(video|clip|watch|listening)\b/.test(text);
  if (videoMentioned) {
    if (/^(?:thu vien video|video library|hoc qua video|videos|tab video|video)$/.test(destination)
      && !/^(?:mo|xem|watch|play|open) video$/.test(text)) {
      return { kind: 'open_tab', tab: 'videos', label: 'Mở thư viện video' };
    }
    if (!stats) return null;
    const ranked = rankCatalog(text, stats.videoCatalog);
    const match = ranked[0];
    if (match && match.score > (ranked[1]?.score ?? 0)) {
      return { kind: 'open_video', tab: 'videos', videoId: match.item.id, videoTitle: match.item.title, label: `Mở video: ${match.item.title}`.slice(0, 80) };
    }
    // "Một video nào đó/bất kì" is a request for one concrete video, not for
    // the library. Prefer the next unwatched video, then any catalog entry when
    // everything is already finished.
    const anyVideo = /\b(bat ki|bat ky|nao do|nao cung duoc|gi cung duoc|dai loai|random|any|whatever|something)\b/.test(text);
    const fallback = anyVideo
      ? stats.nextVideo ?? (stats.videoCatalog[0]
        ? { id: stats.videoCatalog[0].id, title: stats.videoCatalog[0].title }
        : null)
      : stats.nextVideo;
    const wantsLibrary = /(thu vien|library)/.test(text) && !anyVideo;
    if (fallback && (command || anyVideo) && !wantsLibrary && (anyVideo || !hasSpecificTopic(text))) {
      return { kind: 'open_video', tab: 'videos', videoId: fallback.id, videoTitle: fallback.title, label: `Mở video: ${fallback.title}`.slice(0, 80) };
    }
    return { kind: 'open_tab', tab: 'videos', label: 'Mở thư viện video' };
  }

  const routes: Array<{ tab: ChatTab; match: RegExp }> = [
    { tab: 'study', match: /^(?:lo trinh(?: hoc)?|hoc tap|bai hoc|roadmap|study|learning)$/ },
    { tab: 'videos', match: /^(?:video|videos|thu vien video|video library|hoc qua video)$/ },
    { tab: 'rankings', match: /^(?:bang xep hang|xep hang|leaderboard|rankings?|league|bxh)$/ },
    { tab: 'translate', match: /^(?:dich|dich tai lieu|dich van ban|translate|translation)$/ },
    { tab: 'compete', match: /^(?:thi dau|thi dua|dau truong|dau tu vung|arena|compete|1v1)$/ },
    { tab: 'shop', match: /^(?:gara(?: shop| engorace)?|cua hang(?: gara)?|shop|garage|danh muc (?:gara|cua hang)|shop catalog|mua phu tung)$/ },
    { tab: 'profile', match: /^(?:ho so|trang ca nhan|tai khoan|thong tin ca nhan|profile)$/ },
  ];
  const route = routes.find((item) => item.match.test(destination));
  if (route) {
    const labels: Record<ChatTab, string> = {
      study: 'Mở lộ trình học', videos: 'Mở thư viện video', translate: 'Mở bàn dịch',
      compete: 'Mở đấu trường', rankings: 'Mở bảng xếp hạng', shop: 'Mở Gara',
      profile: 'Mở hồ sơ', admin: 'Quản trị',
    };
    return {
      kind: 'open_tab', tab: route.tab, label: labels[route.tab],
      ...(route.tab === 'shop' ? { highlight: 'control:shop-catalog' } : {}),
    };
  }

  const lessonMentioned = command && /\b(bai hoc|bai ve|hoc bai|hoc ve|lesson)\b/.test(text);
  if (lessonMentioned && stats) {
    const ranked = rankCatalog(text, stats.lessons);
    const match = ranked[0];
    const next = pickNextLesson(stats);
    const lesson = match && match.score > (ranked[1]?.score ?? 0)
      ? match.item
      : !hasSpecificTopic(text) && next && stats.lessons.find((item) => item.id === next.id);
    if (lesson) {
      return { kind: 'open_lesson', tab: 'study', lessonId: lesson.id, lessonTitle: lesson.title, label: `Mở bài: ${lesson.title}`.slice(0, 80) };
    }
    return { kind: 'open_tab', tab: 'study', label: 'Mở lộ trình học' };
  }
  return null;
}

/**
 * The rows-based fallback when the gate rejects and no provider is usable.
 * Study-plan questions still get a real plan; conversational turns get one
 * short, in-character notice instead of a page summary or an "AI needed"
 * disclaimer that reads like a system error.
 */
export function buildOfflineCoachReply(
  snapshot: StudySnapshot,
  steps: StudyStep[],
  intent: ChatIntent,
  context: ChatContext | null,
  language: BuddyLanguage = 'vi',
): AiReply {
  if (intent !== 'plan' && intent !== 'practice') {
    return {
      reply: language === 'en'
        ? 'I couldn’t answer this question right now. Please try again.'
        : 'Mình chưa trả lời được câu này. Bạn thử lại nhé.',
      feedback: [],
      followups: [],
      action: null,
      reminder: null,
    };
  }

  const first = steps[0];
  if (language === 'en') {
    const next = snapshot.nextLesson;
    const lines = [];
    if (next) {
      lines.push(`Your next lesson is “${next.title}”. You’ve completed ${snapshot.completedLessons} of ${snapshot.totalLessons} lessons.`);
    } else {
      lines.push('You can review a lesson you’ve already completed.');
    }
    if (snapshot.reviewDue) lines.push(`You also have ${snapshot.reviewDue} items due for review.`);
    const action = next
      ? { kind: 'open_lesson', tab: 'study', lessonId: next.id, label: 'Open the next lesson' } as const
      : null;
    return { reply: lines.join(' '), feedback: [], followups: [], action, reminder: null };
  }

  const weak = snapshot.weakTopics[0];
  const lines = [
    `Việc tiếp theo: ${first.title} (${first.minutes} phút). ${first.reason}`,
  ];
  // Due recall is time-sensitive: naming it only in the plan hides it from a
  // learner who reads the answer and stops there.
  const due = steps.find((step) => step.id === 'review-due');
  if (due && due !== first) {
    const batch = Math.min(snapshot.reviewDue, REVIEW_SESSION_LIMIT);
    lines.push(`Đừng bỏ lịch ôn: ${due.reason} Mở Ôn Tập để trả lời ${batch} mục này.`);
  }
  if (weak) {
    lines.push(`Chủ đề yếu nhất: ${weak.topic}: ${weak.mistakes} câu sai gần đây.`);
  }
  if (context?.focus) {
    lines.push(`Bạn đang ở: ${context.focus}.`);
  }
  const followups = intent === 'plan'
    ? ['Bài tiếp theo học trong bao lâu?', 'Chủ đề yếu nhất của mình là gì?']
    : ['Hôm nay mình nên học gì trước?', 'Giải thích chủ đề mình đang xem'];
  // The offline answer stays actionable too: point at the real first step, so
  // the button matches the sentence the learner just read.
  const target = first.target;
  const action: ChatAction = first.id === 'review-due'
    ? { kind: 'open_review', tab: 'profile', label: 'Bắt đầu ôn tập' }
    : target.videoId
    ? { kind: 'open_video', tab: 'videos', videoId: target.videoId, label: 'Mở video' }
    : target.lessonId
      ? { kind: 'open_lesson', tab: 'study', lessonId: target.lessonId, lessonTitle: target.lessonTitle, label: 'Mở bài học' }
      : { kind: 'open_tab', tab: target.tab, label: 'Đi tới màn hình' };
  return { reply: lines.join('\n'), feedback: [], followups, action, reminder: null };
}
