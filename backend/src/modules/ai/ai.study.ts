import { REVIEW_SESSION_LIMIT } from '../analytics/review.scheduler';
import type { StudyStats } from './ai.repository';
import type {
  AiReply,
  ChatAction,
  ChatContext,
  ChatIntent,
  ChatTab,
  LearnerContext,
  StudySnapshot,
  StudyStep,
} from './ai.types';

/** Mirror the web roadmap unlock rule: first lesson, or the one after a perfect score. */
export function pickNextLesson(stats: StudyStats): StudySnapshot['nextLesson'] {
  const completed = new Set(stats.completedLessonIds);
  let previousCompleted = true;
  for (const lesson of stats.lessons) {
    if (completed.has(lesson.id)) {
      previousCompleted = true;
      continue;
    }
    if (previousCompleted) {
      return { id: lesson.id, title: lesson.title, topic: lesson.topic };
    }
    previousCompleted = false;
  }
  return null;
}

export function toStudySnapshot(learner: LearnerContext, stats: StudyStats): StudySnapshot {
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

/** Only ids that exist in the real catalogue survive, so a hallucinated id
 * cannot send the learner to a dead screen. */
export function resolveChatAction(action: ChatAction | null, stats: StudyStats): ChatAction | null {
  if (!action) return null;
  if (action.kind === 'open_video') {
    const video = stats.videoCatalog.find((item) => item.id === action.videoId);
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
    const lesson = stats.lessons.find((item) => item.id === action.lessonId);
    if (!lesson) return null;
    return {
      kind: 'open_lesson',
      tab: 'study',
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      label: `Mở bài: ${lesson.title}`.slice(0, 60),
      ...(action.highlight === `lesson:${lesson.id}` ? { highlight: action.highlight } : {}),
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
  // The admin console is not a learner destination, even if the model asks.
  if (action.tab === 'admin') return null;
  const tab = action.tab ?? 'study';
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
    ...(action.highlight ? { highlight: action.highlight } : {}),
  };
}

function normalizeDestination(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isQuestionAboutDestination(text: string): boolean {
  return /\b(la gi|the nao|tai sao|giai thich|what is|why|how does)\b/.test(text);
}

const DESTINATION_STOP_WORDS = new Set([
  'video','clip','bai','hoc','ve','cho','minh','toi','muon','mo','tim','xem','giup','vui','long','hay','the','mot','nao',
  'trang','thu','vien','noi','dung','chu','de','library','watch','listening','listen','play','lesson','study','learn','take','me','go','to','next','open','about','please','a','the',
]);

function hasSpecificTopic(text: string): boolean {
  return text.split(' ').some((word) => word.length > 2 && !DESTINATION_STOP_WORDS.has(word));
}

function scoreCatalogMatch(query: string, candidate: string): number {
  const words = query.split(' ').filter((word) => word.length > 2 && !DESTINATION_STOP_WORDS.has(word));
  if (words.length === 0) return 0;
  const haystack = ` ${candidate} `;
  return words.reduce((score, word) => score + (haystack.includes(` ${word} `) ? 2 : haystack.includes(word) ? 1 : 0), 0);
}

/**
 * Deterministic navigation takes precedence over generative copy. Every video
 * and lesson target comes from the current database-backed study snapshot.
 */
export function resolveNavigationRequest(message: string, stats: StudyStats): ChatAction | null {
  const text = normalizeDestination(message);
  if (!text || isQuestionAboutDestination(text)) return null;
  const command = /\b(mo|tim|xem|vao|chuyen|hoc|on|open|find|watch|study|review|take me|go to)\b/.test(text);

  if (/(on tap|on lai|bai can on|phien on tap|review)/.test(text)) {
    return { kind: 'open_review', tab: 'profile', label: 'Bắt đầu ôn tập' };
  }

  const videoMentioned = /\b(video|clip|watch|listening)\b/.test(text);
  if (videoMentioned) {
    const ranked = stats.videoCatalog
      .map((video) => ({ video, score: scoreCatalogMatch(text, normalizeDestination(`${video.title} ${video.topic}`)) }))
      .sort((a, b) => b.score - a.score || a.video.id - b.video.id);
    const match = ranked[0];
    if (match && match.score > 0) {
      return { kind: 'open_video', tab: 'videos', videoId: match.video.id, videoTitle: match.video.title, label: `Mở video: ${match.video.title}`.slice(0, 80) };
    }
    const next = stats.nextVideo;
    if (next && command && !hasSpecificTopic(text) && !/(thu vien|library)/.test(text)) {
      return { kind: 'open_video', tab: 'videos', videoId: next.id, videoTitle: next.title, label: `Mở video: ${next.title}`.slice(0, 80) };
    }
    return { kind: 'open_tab', tab: 'videos', label: 'Mở thư viện video' };
  }

  const routes: Array<{ tab: ChatTab; match: RegExp }> = [
    { tab: 'rankings', match: /(bang xep hang|xep hang|leaderboard|ranking|league)/ },
    { tab: 'translate', match: /(dich tai lieu|dich van ban|translate|translation)/ },
    { tab: 'compete', match: /(thi dua|dau truong|dau tu vung|arena|1v1)/ },
    { tab: 'shop', match: /(gara|cua hang|shop|garage|mua xe)/ },
    { tab: 'profile', match: /(ho so|trang ca nhan|tai khoan|profile)/ },
  ];
  const route = routes.find((item) => item.match.test(text));
  if (route) {
    const labels: Record<ChatTab, string> = {
      study: 'Mở lộ trình học', videos: 'Mở thư viện video', translate: 'Mở bàn dịch',
      compete: 'Mở đấu trường', rankings: 'Mở bảng xếp hạng', shop: 'Mở Gara',
      profile: 'Mở hồ sơ', admin: 'Quản trị',
    };
    return { kind: 'open_tab', tab: route.tab, label: labels[route.tab] };
  }

  const lessonMentioned = /(lo trinh|roadmap|hoc tap|bai hoc|bai ve|hoc bai|hoc ve|lesson)/.test(text);
  if (lessonMentioned) {
    const ranked = stats.lessons
      .map((lesson) => ({ lesson, score: scoreCatalogMatch(text, normalizeDestination(`${lesson.title} ${lesson.topic} ${lesson.stageTitle}`)) }))
      .sort((a, b) => b.score - a.score || a.lesson.id - b.lesson.id);
    const match = ranked[0];
    const next = pickNextLesson(stats);
    const lesson = match && match.score > 0
      ? match.lesson
      : !hasSpecificTopic(text) && next && stats.lessons.find((item) => item.id === next.id);
    if (lesson) {
      return { kind: 'open_lesson', tab: 'study', lessonId: lesson.id, lessonTitle: lesson.title, label: `Mở bài: ${lesson.title}`.slice(0, 80) };
    }
    return { kind: 'open_tab', tab: 'study', label: 'Mở lộ trình học' };
  }
  return null;
}

/**
 * The rows-based fallback when the gate rejects and no provider is usable: it
 * names the real next lesson, weak topic and current screen, not a canned apology.
 */
export function buildOfflineCoachReply(
  snapshot: StudySnapshot,
  steps: StudyStep[],
  intent: ChatIntent,
  context: ChatContext | null,
): AiReply {
  const first = steps[0];
  // A question about the current screen is not a request for a study plan.
  // When the model is unavailable, answer from the page context we do have and
  // say plainly that the detailed answer needs the model, instead of pretending
  // the learner asked what to study next.
  if (intent !== 'plan' && intent !== 'practice') {
    const lines: string[] = [];
    if (context?.focus) lines.push(`Bạn đang ở: ${context.focus}.`);
    if (intent === 'explain') {
      lines.push('Phần giải thích chi tiết cần AI; thử lại sau một lượt.');
    } else if (intent === 'how') {
      lines.push('Chỉ dẫn thao tác chi tiết cần AI; thử lại sau một lượt.');
    } else {
      lines.push('Câu trả lời chi tiết cần AI; thử lại sau một lượt.');
    }
    if (!context?.focus) {
      lines.push(`Việc tiếp theo: ${first.title} (${first.minutes} phút). ${first.reason}`);
    }
    const followups = intent === 'explain'
      ? ['Giải thích từ này kỹ hơn', 'Cho mình một ví dụ']
      : intent === 'how'
        ? ['Chỉ mình từng bước', 'Mở đúng màn hình đó']
        : ['Hôm nay mình nên học gì trước?', 'Giải thích chủ đề mình đang xem'];
    return { reply: lines.join('\n'), feedback: [], followups, action: null, reminder: null };
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
  if (intent === 'practice') {
    lines.push('Làm bài tiếp theo trước đã, bài tập riêng cần AI.');
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
