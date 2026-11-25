import { buddyLanguage, normalizeDestination } from './ai.language';
import type { BuddyLanguage } from './ai.language';

type SummaryKind = 'wallet' | 'stats' | 'path' | 'badges' | 'equipment' | 'rank';

type LessonSelector = { number: number; stage?: number } | { title: string; stage?: number } | 'next';

export type BuddyCommand = { language: BuddyLanguage } & (
  | { kind: SummaryKind }
  | { kind: 'lesson'; params: LessonSelector }
  | { kind: 'shopItem'; params: { item: string } }
  | { kind: 'video'; params: { choice: 'random' | 'next' } | { choice: 'topic'; topic: string } }
);

function parseLesson(text: string): LessonSelector | null {
  const vietnamese = /^(?:(?:minh|toi) muon )?(?:(?:mo|hoc|tim|vao|bat dau|cho (?:toi|minh) hoc) )?bai(?: hoc)? (.+)$/;
  const english = /^(?:please )?(?:(?:open|find|study|start|take|go to|show me|take me to) )?lesson (.+)$/;
  const raw = (vietnamese.exec(text) ?? english.exec(text))?.[1];
  if (!raw) return /^(?:(?:open|start|study) )?next lesson$/.test(text) ? 'next' : null;

  const query = raw.replace(/ (?:giup (?:minh|toi)|voi|nhe|please)$/, '');
  if (/^(?:tiep theo|ke tiep|next)$/.test(query)) return 'next';
  const location = /^(.*?) +(?:(?:trong|o|thuoc|in|of|from) +)?(?:chang|stage) +(?:thu +)?([0-9]+)$/.exec(query);
  const stage = location ? Number(location[2]) : undefined;
  const target = (location?.[1] ?? query).replace(/^(?:thu|number|so) /, '');
  return /^\d+$/.test(target) ? { number: Number(target), stage } : { title: target, stage };
}

function parseVideo(text: string): Extract<BuddyCommand, { kind: 'video' }>['params'] | null {
  const vi = /^(?:(?:minh|toi) muon )?(?:mo|xem|tim|luyen(?: nghe(?: qua)?)?|chon|bat|cho (?:minh|toi)(?: xem)?) (?:mot )?(?:video|clip)(?: (.*))?$/;
  const en = /^(?:please )?(?:open|watch|play|find|pick|show me|give me|choose|start) (?:(?:a|the|any) )?(?:(random|next) )?(?:video|clip)(?: (.*))?$/;
  const english = en.exec(text);
  const vietnamese = vi.exec(text);
  const standaloneRandom = /^(?:(?:video|clip) (?:ngau nhien|bat ky|bat ki)|random (?:video|clip))$/.test(text);
  if (standaloneRandom || english?.[1] === 'random') return { choice: 'random' };
  if (!english && !vietnamese) return null;
  const query = (english?.[2] ?? vietnamese?.[1] ?? '').replace(/(?:^| )(?:giup (?:minh|toi)|voi|nhe|please)$/, '');
  if (/^(?:ngau nhien|bat ky|bat ki|random|nao do)$/.test(query)) return { choice: 'random' };
  if (!query || /^(?:tiep theo|ke tiep|next)$/.test(query)) return { choice: 'next' };
  if (/^(?:thu vien|library|cua (?:minh|toi)|tu (?:tai|them|import)|i (?:added|imported)|my)$/.test(query)) return null;
  const topic = query.replace(/^(?:ve|about|on|chu de|co chu de) /, '');
  return { choice: 'topic', topic };
}

export function parseBuddyCommand(message: string): BuddyCommand | null {
  const text = normalizeDestination(message);
  if (/\b(nhac (?:minh|toi|em|nho)|remind|la gi|what is a|what is an|what are badges|tai sao|why|huong dan|how (do|can) i (earn|get|buy))\b/.test(text)) return null;
  const language = buddyLanguage(message);
  const video = parseVideo(text);
  if (video) return { kind: 'video', params: video, language };
  const lesson = parseLesson(text);
  if (lesson) return { kind: 'lesson', params: lesson, language };
  const shop = /^(?:(?:toi|minh) muon |i (?:want|would like) to |please )?(?:mua|tim|buy|find|look for) (.+)$/.exec(text);
  if (shop) {
    const item = shop[1]
      .replace(/^(?:a|an|the|mot|vat pham) /, '')
      .replace(/ (?:trong (?:gara|cua hang)|in (?:the )?(?:shop|garage)|giup (?:minh|toi)|voi|nhe|please)$/, '');
    if (item && !/^(?:video|clip|bai|lesson|cach|thong tin|tu|nghia|out|how|where)\b/.test(item)) {
      return { kind: 'shopItem', params: { item }, language };
    }
  }
  const summaries: Array<[SummaryKind, RegExp]> = [
    ['rank', /^(?:(?:xem|cho (?:toi|minh) xem) )?(?:thu hang|xep hang|hang dau)(?: cua (?:toi|minh|em))$|\b(my (?:league |weekly )?(?:rank|ranking|standing|league)|what (?:is )?am i ranked|hang (?:may|gi))\b/],
    ['badges', /^(?:xem )?huy hieu$|\b(huy hieu (?:cua|toi|minh|dang|bao nhieu)|bao nhieu huy hieu|my badges|badges do i have)\b/],
    ['path', /\b(tien do (?:hoc|lo trinh|cua)|bao nhieu bai (?:da|roi)|da (?:hoc|xong|hoan thanh) bao nhieu bai|my (?:study )?progress|lessons (?:have i|completed))\b/],
    ['equipment', /\b(trang bi (?:cua|dang|gi)|dang (?:dung|mac) (?:xe|khung)|my equipment|what (?:am i wearing|have i equipped)|equipped items)\b/],
    ['stats', /\b(cap (?:may|bao nhieu|hien tai)|level (?:am i|may)|my (?:level|xp|streak|stats)|how (?:much xp|long is my streak)|streak(?: cua (?:toi|minh))?|chuoi (?:cua|bao nhieu|may|ngay)|bao nhieu (?:ngay lien tiep|xp)|thong ke (?:cua|hoc))\b/],
    ['wallet', /^(?:vi|wallet|race coins?)$|\b((?:bao nhieu|con|co) (?:rc|race coin)|(?:rc|race coin) (?:cua|con|bao nhieu)|so du|my (?:wallet|balance|rc|race coins)|how (?:much|many) (?:rc|race coins)|wallet balance)\b/],
  ];
  const match = summaries.find(([, pattern]) => pattern.test(text));
  return match ? { kind: match[0], language } : null;
}
