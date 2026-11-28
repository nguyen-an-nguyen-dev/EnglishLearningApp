import { listDueShortlist } from '../analytics/review.repository';
import { normalizeDestination, type BuddyLanguage } from './ai.language';
import { getBuddyVideoCatalog, getStudyStats } from './ai.repository';
import { rankCatalog, videoCatalogueQuery, withinVideoDuration } from './ai.search';
import { resolveChatAction } from './ai.study';
import type { AiReply, ChatAction } from './ai.types';

function suggestion(reply: string, actions: ChatAction[] = []): AiReply {
  return {
    reply, action: null, ...(actions.length ? { actions } : {}),
    feedback: [], followups: [], reminder: null,
  };
}

/** Explicit recommendation requests stay in chat and never open a choice on their own. */
export function answerRecommendation(userId: number, message: string, language: BuddyLanguage): Promise<AiReply> | null {
  const request = normalizeDestination(message);
  if (/\b(?:and|then|also|va|roi|sau do) (?:give|explain|help|goi y|giai thich|cho minh|mo|open|remind|nhac)\b/u.test(request)) return null;
  const en = language === 'en';
  if (/^(?:what should i review (?:next|today)|hom nay (?:minh |toi )?nen on gi|(?:minh |toi )?nen on gi tiep)$/u.test(request)) {
    return listDueShortlist(userId).then((items) => {
      const names = [...new Set(items.flatMap((item) => item.kind === 'word'
        ? item.word ? [item.word.word] : []
        : item.question ? [item.question.lesson_title] : []))].slice(0, 3);
      return suggestion(names.length
        ? (en ? `Start with these due review topics: ${names.join(', ')}.`
          : `Bắt đầu với các mục đến hạn: ${names.join(', ')}.`)
        : en ? 'No exercises are due right now. You can revisit earlier material in Review.'
          : 'Hiện chưa có bài đến hạn. Bạn có thể mở Ôn tập để xem lại nội dung đã học.',
      [{ kind: 'open_review', tab: 'profile', label: en ? 'Open review' : 'Mở Ôn tập' }]);
    });
  }

  const english = /^(?:(?:please|(?:can|could|would) you) )?(?:(?:recommend|suggest)(?: me)? (?:a |some )?|(?:(?:do you (?:have|know)|are there) )?any (?:of )?)(?:(?<owned>my private|my|private) )?(?:(?<short>short) )?(?:(?<level>[abc][12]) )?(?<resource>videos?|lessons?) (?:about|on) (?<query>.+?)(?: please)?$/u.exec(request);
  const vietnamese = /^(?:(?:ban co the|vui long) )?(?:(?:goi y|de xuat)(?: (?:cho|giup) (?:minh|toi))? (?:mot |vai )?|co )(?<resource>video|bai hoc|bai)(?: (?<owned>rieng tu|cua minh|cua toi))?(?: (?<short>ngan))?(?: (?<level>[abc][12]))?(?: nao)? (?:ve|chu de) (?<query>.+?)(?: nhe| voi| khong)?$/u.exec(request);
  const match = english ?? vietnamese;
  if (!match?.groups) return null;
  const { owned, short, level, resource, query } = match.groups;
  const video = /^videos?$/.test(resource);
  if (!video && (owned || short || level || /\b[abc][12]\b/u.test(query))) return null;

  const noMatch = en ? 'I couldn’t find a matching resource. Try another topic or a different level.'
    : 'Mình chưa tìm thấy tài liệu phù hợp. Bạn thử chủ đề hoặc trình độ khác nhé.';
  if (video) {
    const parsed = videoCatalogueQuery(query);
    if (!parsed || (short && parsed.maxSeconds === undefined)) return null;
    const levels = new Set([level, ...(parsed.topic.match(/\b[abc][12]\b/gu) ?? [])].filter(Boolean));
    if (levels.size > 1) return null;
    const topic = level ? `${level} ${parsed.topic}` : parsed.topic;
    return getBuddyVideoCatalog(userId, Boolean(owned)).then((catalog) => {
      const matches = rankCatalog(topic, catalog.filter((item) => withinVideoDuration(item, parsed.maxSeconds)))
        .slice(0, 3).map(({ item }) => item);
      if (!matches.length) return suggestion(noMatch);
      const titles = matches.map(({ title, level: cefr, durationSeconds }) => {
        const length = parsed.maxSeconds === undefined || durationSeconds === undefined ? ''
          : `, ${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')}`;
        return `“${title}” (${cefr}${length})`;
      }).join(', ');
      return suggestion(en ? `Try ${titles}.` : `Bạn có thể luyện với ${titles}.`,
        matches.map(({ id, title }) => ({ kind: 'open_video', tab: 'videos', videoId: id, videoTitle: title, label: title })));
    });
  }
  return getStudyStats(userId).then((stats) => {
    const matches = rankCatalog(query, stats.lessons).slice(0, 3);
    const actions = matches.map(({ item }) =>
      resolveChatAction({ kind: 'open_lesson', lessonId: item.id, label: item.title }, stats),
    ).filter((action) => action !== null);
    if (!actions.length) return suggestion(noMatch);
    const names = actions.map(({ lessonTitle, mode }) =>
      `“${lessonTitle}”${mode === 'reveal' ? (en ? ' (locked)' : ' (đang khóa)') : ''}`).join(', ');
    return suggestion(en ? `These lessons cover that topic: ${names}.` : `Các bài phù hợp: ${names}.`, actions);
  });
}
