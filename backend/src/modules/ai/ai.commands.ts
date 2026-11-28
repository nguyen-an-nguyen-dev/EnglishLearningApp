import { buddyLanguage, normalizeDestination } from './ai.language';
import type { BuddyLanguage } from './ai.language';

type SummaryKind = 'wallet' | 'stats' | 'path' | 'badges' | 'equipment' | 'rank';
type SummaryCommand = { [Kind in SummaryKind]: { kind: Kind } }[SummaryKind];

type LessonSelector = { number: number; stage?: number } | { title: string; stage?: number } | 'next';

export type BuddyCommand = { language: BuddyLanguage } & (
  | SummaryCommand
  | { kind: 'studyHistory'; params: { view: 'recent' | 'current' | 'weak' | 'absence'; title?: string } }
  | { kind: 'videoLibrary'; params: { owned: boolean } }
  | { kind: 'lesson'; params: LessonSelector }
  | { kind: 'shopCatalog' }
  | { kind: 'shopItem'; params: { item: string; buy: boolean; preferEquipped?: boolean } }
  | { kind: 'video'; params: { choice: 'random' | 'next'; owned?: boolean }
    | { choice: 'topic'; topic: string; owned?: boolean; code?: boolean; lookupOnly?: boolean } }
);

function parseLesson(text: string): LessonSelector | null {
  if (/^(?:open|start|study|resume) (?:my |the )?(?:current|next) lesson$/.test(text)) return 'next';
  const vietnamese = /^(?:(?:minh|toi) muon )?(?:(?:mo|hoc|tim|vao|bat dau|cho (?:toi|minh) hoc) )?bai(?: hoc)? (.+)$/;
  const english = /^(?:please )?(?:(?:open|find|study|start|take|go to|show me|take me to) )?lesson (.+)$/;
  const raw = (vietnamese.exec(text) ?? english.exec(text))?.[1];
  if (!raw) return /^(?:(?:open|start|study) )?next lesson$/.test(text) ? 'next' : null;

  const query = raw.replace(/ (?:giup (?:minh|toi)|voi|nhe|please)$/, '');
  if (/^(?:tiep theo|ke tiep|dang hoc|hien tai|next)$/.test(query)) return 'next';
  const location = /^(.*?) +(?:(?:trong|o|thuoc|in|of|from) +)?(?:chang|stage) +(?:thu +)?([0-9]+)$/.exec(query);
  const stage = location ? Number(location[2]) : undefined;
  const target = (location?.[1] ?? query).replace(/^(?:thu|number|so) /, '');
  return /^\d+$/.test(target) ? { number: Number(target), stage } : { title: target, stage };
}

function parseVideo(text: string): Extract<BuddyCommand, { kind: 'video' }>['params'] | null {
  text = text
    .replace(/^(?:xin chao|chao)(?: (?:anh|chi|ban|em|buddy))? /, '')
    .replace(/^(?:(?:anh|chi|ban|em|cau|buddy) )?co the /, '');
  const vi = /^(?:(?:minh|toi) muon )?(?:mo(?: xem)?|xem|tim|luyen(?: nghe(?: qua)?)?|chon|bat|cho (?:minh|toi)(?: xem)?)(?: (?:giup|gium|cho) (?:minh|toi)(?: xem)?)? (?:mot )?(?:video|clip)(?: (.*))?$/;
  const en = /^(?:please )?(?:open|watch|play|find|pick|show me|give me|choose|start) (?:(?:a|the) )?(?:(random|next|any) )?(?:(my|private|my private) )?(?:video|clip)(?: (.*))?$/;
  if (/^(?:please )?(?:open|watch|play|show me) this (?:video|clip)$/.test(text)) return { choice: 'topic', topic: 'this' };
  const english = en.exec(text);
  const vietnamese = vi.exec(text);
  const standaloneRandom = /^(?:(?:video|clip) (?:ngau nhien|bat ky|bat ki)|random (?:video|clip))$/.test(text);
  if (standaloneRandom || english?.[1] === 'random' || english?.[1] === 'any') {
    return { choice: 'random', ...(english?.[2] ? { owned: true } : {}) };
  }
  if (!english && !vietnamese) return null;
  const query = (english?.[3] ?? vietnamese?.[1] ?? '').replace(/(?:^| )(?:duoc khong|giup (?:minh|toi)|voi|nhe|please)$/, '');
  if (!query || /^(?:tiep theo|ke tiep|next)$/.test(query)) return { choice: 'next', ...(english?.[2] ? { owned: true } : {}) };
  if (/^(?:thu vien|library)$/.test(query)) return null;
  const ownership = /^(?:rieng tu|private)(?: |$)|(?:^| )(?:cua (?:minh|toi)|tu (?:tai|them|import)|i (?:added|imported))$/g;
  const topic = query
    .replace(ownership, '')
    .trim()
    .replace(/^(?:ten|ve|about|on|chu de|co chu de) /, '');
  const owned = Boolean(english?.[2]) || query !== query.replace(ownership, '');
  if (!topic || /^(?:tiep theo|ke tiep|next)$/.test(topic)) return { choice: 'next', ...(owned ? { owned } : {}) };
  if (/^(?:ngau nhien|bat ky|bat ki|random|nao do|nao cung duoc|gi cung duoc)(?: (?:ngau nhien|bat ky|bat ki))?$/.test(topic)) {
    return { choice: 'random', ...(owned ? { owned } : {}) };
  }
  const code = /^(?:(?:co )?ma(?: so)?|code|id) (.+)$/.exec(topic);
  return code ? { choice: 'topic', topic: code[1], code: true, owned } : { choice: 'topic', topic, ...(owned ? { owned } : {}) };
}

export function parseBuddyCommand(message: string): BuddyCommand | null {
  const text = normalizeDestination(message).replace(/^(?:en buddy|buddy|lam on|vui long) /, '');
  const language = buddyLanguage(message);
  if (/\b(nhac (?:minh|toi|em|nho)|remind|dung (?:mo|chuyen|tim)|do not|don t)\b/.test(text)) return null;
  if (/\b(bao lau (?:roi )?(?:(?:minh|toi|em) )?(?:chua|khong) hoc|lau (?:chua|khong) hoc|lan cuoi (?:hoc|go hoc)|lan cuoi (?:minh|toi) hoc|last (?:time i studied|studied)|since i (?:last )?studied)\b/.test(text)) {
    return { kind: 'studyHistory', params: { view: 'absence' }, language };
  }
  if (/\b((?:loi|sai) (?:gi|nhieu|o dau|o bai nao|gan day|thuong gap)|hay sai|hay mac loi|chu de yeu|weak (?:topics|areas)|(?:my|recent|common) mistakes|mistakes do i make)\b/.test(text)) {
    return { kind: 'studyHistory', params: { view: 'weak' }, language };
  }
  if (/\b(bai (?:hoc )?(?:hien tai|tiep theo) la gi|dang hoc bai nao|dang o bai nao|what (?:is my current lesson|lesson am i on|is my next lesson))\b/.test(text)) {
    return { kind: 'studyHistory', params: { view: 'current' }, language };
  }
  const scoredLesson = /^(?:(?:diem|lich su|so lan lam|ket qua) (?:cua )?bai(?: hoc)?|(?:my )?(?:score|results?) (?:for|on) lesson) (.+)$/.exec(text)?.[1]
    .replace(/^(?:so|ten) /, '').replace(/ (?:la bao nhieu|bao nhieu|cua (?:minh|toi))$/, '');
  if (scoredLesson || /\b(bai (?:hoc |tap )?(?:cu|gan nhat|da hoc|da lam|vua hoc|vua lam)|da (?:hoc|lam|hoan thanh) (?:nhung )?bai (?:gi|nao)|lich su hoc|study history|last lesson|previous lesson|recent lessons)\b/.test(text)) {
    const title = scoredLesson && !/^(?:cu|gan nhat|vua hoc|vua lam|da hoc|da lam)$/.test(scoredLesson) ? scoredLesson : undefined;
    return { kind: 'studyHistory', params: { view: 'recent', ...(title ? { title } : {}) }, language };
  }
  const codeLookup = /^(?:(?:tra|lay|tim|cho (?:minh|toi)|what is|find|show me) )?(?:ma (?:(?:va (?:mo|xem)|cua) )?video|(?:the )?(?:code (?:for|of) (?:the )?video|video code|code of this video))(?: (.+))?$/.exec(text);
  if (codeLookup) {
    const topic = (codeLookup[1] ?? '').replace(/(?:^| )(?:la gi|bao nhieu)$/, '');
    return { kind: 'video', params: {
      choice: 'topic', topic: topic || 'this', lookupOnly: !/\bva (?:mo|xem) video\b/.test(text),
    }, language };
  }
  if (/\b(la gi|what is a|what is an|what are badges|tai sao|why|huong dan|how (do|can) i (earn|get|buy))\b/.test(text)) return null;
  if (/^(?:(?:mo|xem|vao|chuyen (?:qua|sang)|open|show me|go to) )?(?:(?:thu vien|tab|danh sach) video|hoc qua video|video (?:library|tab)|videos|(?:my|private) videos|(?:cac )?video (?:rieng tu|cua (?:minh|toi)))(?: (?:rieng tu|cua (?:minh|toi)))?$/.test(text)) {
    return { kind: 'videoLibrary', params: { owned: /\b(rieng tu|cua (?:minh|toi)|my|private)\b/.test(text) }, language };
  }
  if (/^(?:(?:mo|xem|vao|open|show me) )?(?:toan bo |tat ca |the )?(?:gara(?: shop| engorace)?|cua hang|shop|garage|danh muc (?:gara|cua hang)|shop catalog)(?: (?:co|ban) (?:nhung )?gi)?$/.test(text)
    || /^(?:what (?:is|s) in (?:the )?(?:shop|garage)|what does the shop sell)$/.test(text)) return { kind: 'shopCatalog', language };
  const video = parseVideo(text);
  if (video) return { kind: 'video', params: video, language };
  const lesson = parseLesson(text);
  if (lesson) return { kind: 'lesson', params: lesson, language };
  // Video questions must not fall through to the shop matcher.
  if (/\b(video|clip)\b/.test(text)) return null;
  if (/(?:màu (?:đó|này)|xe (?:đó|này)|that colou?r|that car)(?:\s*[.!?]|\s*(?:thì sao|nhé|đi))?$/iu.test(message.normalize('NFC').trim())) {
    return { kind: 'shopItem', params: { item: '', buy: false }, language };
  }
  const shop = /^(?:(?:toi|minh) muon |i (?:want|would like) to |please )?(mua|tim|xem|mo|buy|find|look for|see|show me|open) (.+)$/.exec(text);
  if (shop) {
    const item = shop[2]
      .replace(/^(?:a|an|the|mot|vat pham) /, '')
      .replace(/ (?:trong (?:gara|cua hang)|in (?:the )?(?:shop|garage)|giup (?:minh|toi)|voi|nhe|please)$/, '');
    if (item && !/^(?:video|clip|bai|lesson|cach|thong tin|tu|nghia|out|how|where)\b/.test(item)) {
      return { kind: 'shopItem', params: { item, buy: shop[1] === 'mua' || shop[1] === 'buy' }, language };
    }
  }
  // A bare description ("chiếc xe màu đỏ", "có xe đỏ không", "red car") is
  // still a catalogue lookup: the caller checks the real shop rows before
  // deciding whether the model should answer instead.
  const mentionsCar = /\b(xe|car)\b/.test(text);
  const aboutText = /\b(dich|translate|nghia|meaning|phat am|pronounce|giai thich|explain|bai|lesson|video|clip)\b/.test(text);
  if (mentionsCar && !aboutText) {
    return { kind: 'shopItem', params: { item: text, buy: false }, language };
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
