import { REVIEW_SESSION_LIMIT } from '../analytics/review.scheduler';
import { normalizeDestination, type BuddyLanguage } from './ai.language';
import { getStudyLearnerContext, getStudyStats } from './ai.repository';
import { buildStudyPlan, resolveChatAction, toStudySnapshot } from './ai.study';
import { wholeNumber } from './ai.time';
import type { AiReply, ChatAction } from './ai.types';

export function answerTimedStudyPlan(userId: number, message: string, language: BuddyLanguage): Promise<AiReply> | null {
  const text = normalizeDestination(message);
  const patterns = [
    /^i (?:only )?have (?:only )?(.+?) (?:minutes?|mins?)(?: to study)? what should i (?:study|learn|do)(?: today| first| next)?$/u,
    /^what (?:can|should) i (?:study|learn|do)(?: first)? in (.+?) (?:minutes?|mins?)$/u,
    /^(?:hom nay )?(?:minh|toi|em) (?:chi )?co (.+?) phut (?:thi )?(?:(?:minh|toi|em) )?(?:nen )?hoc gi(?: truoc| tiep| hom nay)?$/u,
    /^(?:trong|voi) (.+?) phut (?:thi )?(?:(?:minh|toi|em) )?(?:nen |co the )?hoc gi(?: truoc| tiep| hom nay)?$/u,
  ];
  const number = patterns.map((pattern) => pattern.exec(text)?.[1]).find(Boolean);
  if (number === undefined) return null;
  const budget = wholeNumber(number);
  if (budget === undefined || budget < 1 || budget > 120) return null;

  return Promise.all([getStudyLearnerContext(userId), getStudyStats(userId)]).then(([learner, stats]) => {
    const en = language === 'en';
    const snapshot = toStudySnapshot(learner, stats);
    const plan = buildStudyPlan(snapshot, stats);
    const tasks: Array<{ title: string; minutes: number; action: ChatAction }> = [];
    let remaining = budget;
    const add = (title: string, minutes: number, action: ChatAction | null) => {
      if (!action || remaining < minutes || tasks.length === 3) return;
      tasks.push({ title, minutes, action });
      remaining -= minutes;
    };

    if (snapshot.reviewDue > 0) {
      const count = Math.min(snapshot.reviewDue, REVIEW_SESSION_LIMIT, remaining);
      add(en ? `Review ${count} due ${count === 1 ? 'item' : 'items'}` : `Ôn ${count} mục đến hạn`, count,
        { kind: 'open_review', tab: 'profile', label: en ? 'Open review' : 'Mở Ôn tập' });
    }
    const lesson = plan.find(({ target }) => target.lessonId !== undefined);
    if (lesson?.target.lessonTitle) {
      const title = en ? `Study “${lesson.target.lessonTitle}”` : `Học bài “${lesson.target.lessonTitle}”`;
      const action = resolveChatAction({ kind: 'open_lesson', lessonId: lesson.target.lessonId, label: title }, stats);
      if (action?.mode === 'open') add(title, lesson.minutes, action);
    }
    if (remaining > 0 && snapshot.savedWords > 0) {
      const count = Math.min(5, snapshot.savedWords, remaining);
      add(en ? `Review ${count} saved ${count === 1 ? 'word' : 'words'}` : `Ôn ${count} từ đã lưu`, count,
        { kind: 'open_notebook', tab: 'videos', highlight: 'control:notebook', label: en ? 'Open notebook' : 'Mở Sổ từ' });
    }
    const video = plan.find(({ kind }) => kind === 'video');
    if (video && snapshot.nextVideo) {
      const title = en ? `Watch part of “${snapshot.nextVideo.title}”` : `Nghe một đoạn “${snapshot.nextVideo.title}”`;
      add(title, video.minutes, resolveChatAction({ kind: 'open_video', videoId: snapshot.nextVideo.id, label: title }, stats));
    }
    if (!tasks.length) {
      add(en ? 'Translate one short sentence' : 'Dịch một câu ngắn', Math.min(3, remaining),
        { kind: 'open_tab', tab: 'translate', label: en ? 'Open translation' : 'Mở Dịch tài liệu' });
    }
    const details = tasks.map(({ title, minutes }) => `${title} (${minutes} ${en ? 'min' : 'phút'}).`).join('\n');
    return {
      reply: `${en ? `Plan about ${budget - remaining} of ${budget} minutes.` : `Dùng khoảng ${budget - remaining}/${budget} phút.`}\n${details}`,
      action: null,
      actions: tasks.map(({ action }) => action),
      followups: [], feedback: [], reminder: null,
    };
  });
}
