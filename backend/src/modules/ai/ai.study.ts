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
  };
}

/**
 * Steps are computed from database rows, never invented by the model.
 * Each step carries the tab (and lesson id) the web can jump straight into.
 */
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

/**
 * The model may only name ids that exist in the real catalogue. Anything else
 * is dropped, so a hallucinated id can never send the learner to a dead screen.
 */
export function resolveChatAction(action: ChatAction | null, stats: StudyStats): ChatAction | null {
  if (!action) return null;
  if (action.kind === 'open_video') {
    const video = stats.videoCatalog.find((item) => item.id === action.videoId);
    if (!video) return null;
    return {
      kind: 'open_video',
      tab: 'videos',
      videoId: video.id,
      label: action.label || `Mở video: ${video.title}`.slice(0, 60),
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
      label: action.label || `Mở bài: ${lesson.title}`.slice(0, 60),
    };
  }
  if (action.kind === 'open_notebook') {
    return { kind: 'open_notebook', tab: 'videos', label: action.label || 'Mở Sổ từ vựng' };
  }
  const tab = action.tab ?? 'study';
  const tabLabels: Record<ChatTab, string> = {
    study: 'Vào Lộ trình học',
    videos: 'Vào Học qua Video',
    translate: 'Vào Dịch tài liệu',
    compete: 'Vào Thi Đua',
    rankings: 'Vào Bảng xếp hạng',
    profile: 'Vào Hồ sơ',
    admin: 'Vào Quản trị nội dung',
  };
  return { kind: 'open_tab', tab, label: action.label || tabLabels[tab] };
}

/**
 * When the decision layer rejects a reply and no provider is usable, the buddy
 * still answers from the real rows. This is deliberately not a canned apology:
 * it names the real next lesson, the real weak topic and the screen the learner
 * is on.
 */
export function buildOfflineCoachReply(
  snapshot: StudySnapshot,
  steps: StudyStep[],
  intent: ChatIntent,
  context: ChatContext | null,
): AiReply {
  const first = steps[0];
  const weak = snapshot.weakTopics[0];
  const lines = [
    `Việc tiếp theo: ${first.title} (${first.minutes} phút). ${first.reason}`,
  ];
  if (weak) {
    lines.push(`Chủ đề yếu nhất: ${weak.topic}: ${weak.mistakes} câu sai gần đây.`);
  }
  if (context?.focus) {
    lines.push(`Bạn đang ở: ${context.focus}.`);
  }
  if (intent === 'explain') {
    lines.push('Phần giải thích chi tiết cần AI; thử lại sau một lượt.');
  } else if (intent === 'practice') {
    lines.push('Làm bài tiếp theo trước đã, bài tập riêng cần AI.');
  }
  const followups = intent === 'plan'
    ? ['Bài tiếp theo học trong bao lâu?', 'Chủ đề yếu nhất của mình là gì?']
    : ['Hôm nay mình nên học gì trước?', 'Giải thích chủ đề mình đang xem'];
  // The offline answer stays actionable too: point at the real first step.
  const target = first.target;
  const action: ChatAction = target.videoId
    ? { kind: 'open_video', tab: 'videos', videoId: target.videoId, label: 'Mở video' }
    : target.lessonId
      ? { kind: 'open_lesson', tab: 'study', lessonId: target.lessonId, lessonTitle: target.lessonTitle, label: 'Mở bài học' }
      : { kind: 'open_tab', tab: target.tab, label: 'Đi tới màn hình' };
  return { reply: lines.join('\n'), feedback: [], followups, action, reminder: null };
}
