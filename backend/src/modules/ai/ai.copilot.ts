import { getLeague, getShop, getWallet } from '../gamification/gamification.service';
import { normalizeLeagueTier } from '../gamification/gamification.types';
import type { LeagueTier, ShopItem, ShopSlot } from '../gamification/gamification.types';
import type { BuddyCommand } from './ai.commands';
import { normalizeDestination } from './ai.language';
import { pickNextLesson, resolveChatAction } from './ai.study';
import { exactCatalogueMatches, rankCatalog, videoCatalogueQuery, withinVideoDuration } from './ai.search';
import { getBuddyVideoLibraries, getStudyStats } from './ai.repository';
import type { VideoCatalogEntry } from './ai.repository';
import type { AiReply, ChatAction, ChatContext, LearnerContext } from './ai.types';

export async function buildBuddyContext(userId: number) {
  const { study, wallet, readShop } = await buildBuddyTurnContext(userId, true);
  return { study, wallet, shop: await readShop() };
}

export type BuddyCoachContext = Awaited<ReturnType<typeof buildBuddyContext>>;
export type BuddyGuideContext = Omit<BuddyCoachContext, 'shop'> & {
  shop: Pick<BuddyCoachContext['shop'], 'coins' | 'items'>;
};

/** Reuse catalogue reads within one turn without caching private data across turns. */
export function createBuddyCatalogueReads(userId: number) {
  let shop: ReturnType<typeof getShop> | undefined;
  let videos: ReturnType<typeof getBuddyVideoLibraries> | undefined;
  return {
    readShop: () => shop ??= getShop(userId),
    readVideos: () => videos ??= getBuddyVideoLibraries(userId),
  };
}

export type BuddyCatalogueReads = ReturnType<typeof createBuddyCatalogueReads>;

export async function buildBuddyTurnContext(
  userId: number,
  prefetchShop: boolean,
  { readShop, readVideos } = createBuddyCatalogueReads(userId),
) {
  const [study, wallet] = await Promise.all([
    getStudyStats(userId, readVideos()),
    getWallet(userId),
    prefetchShop ? readShop() : null,
  ]);
  return { study, wallet, readShop };
}

export type BuddyTurnContext = Awaited<ReturnType<typeof buildBuddyTurnContext>>;

export async function buildBuddySnapshot(userId: number) {
  const [context, league] = await Promise.all([buildBuddyContext(userId), getLeague(userId)]);
  return { ...context, league };
}

export type BuddySnapshot = Awaited<ReturnType<typeof buildBuddySnapshot>>;

const TIER_NAMES: Record<LeagueTier, [vi: string, en: string]> = {
  coal: ['Than', 'Coal'],
  copper: ['Đồng', 'Copper'],
  iron: ['Sắt', 'Iron'],
  gold: ['Vàng', 'Gold'],
  redstone: ['Đá đỏ', 'Redstone'],
  diamond: ['Kim Cương', 'Diamond'],
};

const SLOT_NAMES: Record<ShopSlot, readonly string[]> = {
  car: ['xe', 'car'],
  frame: ['khung', 'khung anh', 'frame'],
  nameplate: ['nen', 'bang ten', 'khung ten', 'nameplate'],
  booster: ['vat pham', 'bo tro', 'booster'],
};

/** Colour words are matched against the body colour, not any coincidence in a name. */
const COLOR_TOKENS = new Set([
  'do', 'red', 'cam', 'orange', 'vang', 'yellow', 'gold', 'nau', 'brown',
  'xanh', 'green', 'mint', 'ngoc', 'teal', 'cyan', 'navy', 'blue', 'tim',
  'purple', 'violet', 'hong', 'pink', 'magenta', 'den', 'black', 'trang', 'white',
  'xam', 'gray',
]);

/** Words that describe the request, not the item itself. */
const ITEM_QUERY_STOP_WORDS = new Set([
  'a', 'an', 'the', 'mot', 'chiec', 'cai', 'con', 'cua', 'trong', 'in', 'of',
  'mau', 'color', 'colour', 'co', 'khong', 'ko', 'k', 'nao', 'gi', 'nhe', 'voi',
  'giup', 'minh', 'toi', 'muon', 'mua', 'tim', 'xem', 'mo', 'buy', 'find', 'look',
  'for', 'see', 'show', 'me', 'please', 'vat', 'pham', 'item', 'nay',
  'you', 'your', 'have', 'has', 'got', 'is', 'are', 'there', 'with', 'want', 'like', 'gioi',
]);

/**
 * Read the human colour out of the shop row's hex `body` so "xe màu đỏ" can be
 * matched against the database instead of hoping the model guessed.
 */
function colorWords(hex: string | null | undefined): string[] {
  const match = /^#?([0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!match) return [];
  const value = Number.parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 510;
  const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));

  if (saturation < 0.12 || max === min) {
    if (lightness > 0.88) return ['trang', 'white'];
    if (lightness < 0.18) return ['den', 'black'];
    return ['xam', 'gray'];
  }
  if (lightness < 0.22) return ['den', 'black'];
  const hue = max === r
    ? ((g - b) / (max - min)) * 60
    : max === g
      ? ((b - r) / (max - min)) * 60 + 120
      : ((r - g) / (max - min)) * 60 + 240;
  const h = (hue + 360) % 360;

  if (h < 15 || h >= 345) return ['do', 'red'];
  if (h < 36) return ['cam', 'orange'];
  if (h < 70) return lightness < 0.5 ? ['nau', 'gold', 'brown'] : ['vang', 'yellow', 'gold'];
  if (h < 110) return ['xanh la', 'green'];
  if (h < 165) return lightness > 0.62 ? ['bac ha', 'mint', 'green'] : ['xanh la', 'green'];
  if (h < 200) return ['xanh ngoc', 'teal', 'cyan'];
  if (h < 250) return lightness < 0.38 ? ['xanh navy', 'navy', 'blue'] : ['xanh duong', 'blue'];
  if (h < 290) return ['tim', 'purple', 'violet'];
  return ['hong', 'pink', 'magenta'];
}

function itemTokens(item: ShopItem): { name: Set<string>; description: Set<string>; colors: Set<string>; meta: Set<string> } {
  const words = (value: string) => new Set(normalizeDestination(value).split(' ').filter(Boolean));
  return {
    name: words(`${item.name} ${item.code.replaceAll('_', ' ')}`),
    description: words(item.description),
    colors: words(colorWords(item.style?.body).join(' ')),
    meta: words(`${item.rarity} ${SLOT_NAMES[item.slot].join(' ')}`),
  };
}

/**
 * Finds the real shop row a learner is describing. It reads the database-backed
 * catalogue (names, descriptions, slot, rarity and the car body colour) and only
 * returns a single winner, so an ambiguous description is a question rather
 * than a wrong jump.
 */
export function findShopItems(query: string, items: readonly ShopItem[]): ShopItem[] {
  const normalized = normalizeDestination(query);
  const aliases: Record<string, string> = {
    khien: 'shield', 'khien bao ve': 'shield', 'khien bao ve chuoi': 'shield', 'bao ve streak': 'shield',
  };
  const term = aliases[normalized] ?? normalized;
  const visible = items.filter((item) => item.slot !== 'nameplate' || item.unlock_type !== 'default');
  const fields = (item: ShopItem) => [normalizeDestination(item.code), normalizeDestination(item.name)];

  const exact = visible.filter((item) => fields(item).includes(normalized) || fields(item).includes(term));
  if (exact.length) return exact;

  const slotOrder: ShopSlot[] = ['nameplate', 'frame', 'car', 'booster'];
  const shopSlot = slotOrder.find((slot) =>
    SLOT_NAMES[slot].some((name) => ` ${normalized} `.includes(` ${name} `)));
  const candidates = shopSlot ? visible.filter((item) => item.slot === shopSlot) : visible;
  const byPrice = /\b(re nhat|cheapest|least expensive|dat nhat|most expensive)\b/.exec(normalized);
  const maxPrice = /\b(?:duoi|under|below|toi da|up to) (\d+)\b/.exec(normalized);
  const withinBudget = maxPrice ? candidates.filter(({ price }) =>
    /^(toi da|up to)/.test(maxPrice[0]) ? price <= Number(maxPrice[1]) : price < Number(maxPrice[1]),
  ) : candidates;
  const remaining = term.replace(byPrice?.[0] ?? '', '').replace(maxPrice?.[0] ?? '', '').replace(/\b(rc|race coins?|nhat|nao)\b/g, '');

  const tokens = [...new Set(remaining
    .split(' ')
    .filter((word) => word && !ITEM_QUERY_STOP_WORDS.has(word) && !SLOT_NAMES[shopSlot ?? 'car'].includes(word)))];
  const colorPhrase = /\b(xanh la|xanh duong|xanh ngoc|xanh navy|bac ha|dark blue|light blue)\b/.exec(normalized)?.[1];
  const colors = tokens.filter((word) => (shopSlot === 'car' || /\b(mau|color|colour)\b/.test(normalized))
    && COLOR_TOKENS.has(word) && !colorPhrase?.split(' ').includes(word));

  const scored = withinBudget
    .map((item) => {
      const parts = itemTokens(item);
      const bodyColors = colorWords(item.style?.body);
      if (colorPhrase && !bodyColors.includes(colorPhrase === 'dark blue' ? 'navy' : colorPhrase === 'light blue' ? 'xanh duong' : colorPhrase)) return { item, score: -1 };
      if (colors.some((word) => !parts.colors.has(word)
        && !(word === 'xanh' && bodyColors.some((color) => color.startsWith('xanh') || color === 'green')))) return { item, score: -1 };
      let score = 0;
      for (const token of tokens) {
        if (parts.colors.has(token)) {
          score += 5;
          if (parts.name.has(token)) score += 2;
          if (parts.description.has(token)) score += 1;
        }
        else if (parts.name.has(token)) score += 5;
        else if (parts.meta.has(token)) score += 2;
        else if (parts.description.has(token)) score += 1;
      }
      return { item, score };
    })
    .filter(({ score }) => score > 0 || (score === 0 && (Boolean(colorPhrase) || tokens.length === 0)))
    .sort((a, b) => b.score - a.score || a.item.id - b.item.id);
  const matches = scored.filter(({ score }) => score === scored[0]?.score).map(({ item }) => item);
  if (!byPrice || !matches.length) return matches;
  const prices = matches.map(({ price }) => price);
  const price = /re nhat|cheapest|least expensive/.test(byPrice[0]) ? Math.min(...prices) : Math.max(...prices);
  return matches.filter((item) => item.price === price);
}

export function matchShopItem(query: string, items: readonly ShopItem[]): ShopItem | undefined {
  const matches = findShopItems(query, items);
  return matches.length === 1 ? matches[0] : undefined;
}

function shopItemReply(item: ShopItem, coins: number, en: boolean): string {
  const name = `“${item.name}”`;
  if (!item.unlocked) {
    if (!en) return `${name} giá ${item.price} RC và đang khóa${item.unlock_label ? ` (${item.unlock_label})` : ''}.`;
    const value = item.unlock_value;
    const requirements = {
      level: value ? `Reach level ${value}.` : '',
      stage: value ? `Complete stage ${value}.` : '',
      league: value ? `Reach the ${TIER_NAMES[normalizeLeagueTier(value)][1]} league this season.` : '',
      achievement: value === 'lessons_10' ? 'Earn the 10-lesson badge.'
        : value === 'xp_500' ? 'Earn the 500 XP badge.' : 'Earn the required achievement.',
      default: '',
    };
    return [`${name} costs ${item.price} RC and is locked.`, requirements[item.unlock_type]].filter(Boolean).join(' ');
  }
  if (item.owned) return en ? `You already own ${name}.` : `Bạn đã sở hữu ${name}.`;
  const shortfall = item.price - coins;
  if (shortfall > 0) {
    return en ? `You need ${shortfall} more RC for ${name}. It costs ${item.price} RC.`
      : `Bạn còn thiếu ${shortfall} RC để mua ${name}. Giá là ${item.price} RC.`;
  }
  if (item.price === 0) {
    return en ? `${name} is free. Select “Nhận” on the card to claim it.`
      : `${name} miễn phí. Bấm “Nhận” trên thẻ để lấy.`;
  }
  return en ? `You have enough RC for ${name} (${item.price} RC). Select “Mua” on the card to buy it.`
    : `Bạn đủ RC để mua ${name} (${item.price} RC). Bấm “Mua” trên thẻ để mua.`;
}

function answer(reply: string, action: ChatAction | null): AiReply {
  return { reply, action, feedback: [], followups: [], reminder: null };
}

function shopItemAnswer(item: ShopItem, coins: number, en: boolean): AiReply {
  return answer(shopItemReply(item, coins, en), {
    kind: 'show_shop_item', tab: 'shop', itemCode: item.code,
    label: en ? `View ${item.name}` : `Xem ${item.name}`,
  });
}

export function resolveExactShopItem(command: Extract<BuddyCommand, { kind: 'shopItem' }>, shop: BuddyGuideContext['shop']): AiReply | null {
  const name = normalizeDestination(command.params.item);
  if (!name) return null;
  const matches = shop.items.filter((item) => {
    if (item.slot === 'nameplate' && item.unlock_type === 'default') return false;
    const code = normalizeDestination(item.code);
    return normalizeDestination(item.name) === name || code === name
      || (item.slot === 'booster' && code === `booster ${name}`);
  });
  if (matches.length !== 1) return null;
  const reply = shopItemAnswer(matches[0], shop.coins, command.language === 'en');
  return { ...reply, action: resolveChatAction(reply.action, {}, shop.items) };
}

function videoAnswer(video: VideoCatalogEntry, en: boolean, lookupOnly?: boolean): AiReply {
  if (lookupOnly) {
    return answer(en ? `The code for “${video.title}” is ${video.code ?? video.id}.`
      : `Mã của “${video.title}” là ${video.code ?? video.id}.`, null);
  }
  return answer(en ? `Opened “${video.title}”.${video.code ? ` Code: ${video.code}.` : ''}`
    : `Đã mở “${video.title}”.${video.code ? ` Mã video: ${video.code}.` : ''}`,
    { kind: 'open_video', tab: 'videos', videoId: video.id, label: '' });
}

export function resolveExactVideo(
  command: Extract<BuddyCommand, { kind: 'video' }>,
  libraries: Awaited<ReturnType<typeof getBuddyVideoLibraries>>,
  context: ChatContext | null,
): AiReply | null {
  const { params } = command;
  if (params.choice !== 'topic') return null;
  const visible = params.owned ? libraries.ownedVideoCatalog : [...libraries.videoCatalog, ...libraries.ownedVideoCatalog];
  const current = /^(?:nay|dang xem|hien tai|this|current)$/u.test(params.topic);
  const activeTitle = context?.tab === 'videos' ? /^Video: (.+)$/u.exec(context.focus ?? '')?.[1] : undefined;
  const query = current ? normalizeDestination(activeTitle ?? '') : params.topic;
  if (!query) return null;
  const exactIds = current ? [] : visible.filter(({ id, code }) =>
    (code && normalizeDestination(code) === query) || (/^\d+$/u.test(query) && String(id) === query));
  const filter = exactIds.length || params.code || current ? { topic: query } : videoCatalogueQuery(query);
  if (!filter) return null;
  const matches = exactIds.length || params.code ? exactIds
    : current ? visible.filter(({ title }) => normalizeDestination(title) === query)
      : exactCatalogueMatches(filter.topic, visible.filter((item) => withinVideoDuration(item, filter.maxSeconds)));
  if (matches.length !== 1) return null;
  const reply = videoAnswer(matches[0], command.language === 'en', params.lookupOnly);
  return { ...reply, action: resolveChatAction(reply.action, { videoCatalog: matches }) };
}

export function resolveBuddyCommand(
  command: BuddyCommand,
  snapshot: BuddySnapshot,
  learner?: Pick<LearnerContext, 'weakTopics'>,
  context?: ChatContext | null,
): AiReply {
  return command.kind === 'rank'
    ? resolveBuddyRank(command.language, snapshot.league)
    : resolveBuddyStudyCommand(command, snapshot, learner, context);
}

export function resolveBuddyRank(language: BuddyCommand['language'], league: BuddySnapshot['league']): AiReply {
  const en = language === 'en';
  const tier = TIER_NAMES[league.tier][en ? 1 : 0];
  const rank = league.my_rank;
  const reply = en
    ? (rank === null ? `You’re in the ${tier} league with ${league.race_points} RP and no weekly rank yet.`
      : `You’re ranked #${rank} in the ${tier} league this week with ${league.race_points} RP.`)
    : (rank === null ? `Bạn ở giải ${tier}, có ${league.race_points} RP và chưa có hạng tuần này.`
      : `Bạn đứng hạng ${rank} giải ${tier} tuần này với ${league.race_points} RP.`);
  return answer(reply, { kind: 'spotlight', tab: 'rankings', highlight: 'rank:me', label: en ? 'View weekly rank' : 'Xem hạng tuần' });
}

export function resolveBuddyStudyCommand(
  command: Exclude<BuddyCommand, { kind: 'rank' }>,
  snapshot: BuddyGuideContext,
  learner?: Pick<LearnerContext, 'weakTopics'>,
  context?: ChatContext | null,
): AiReply {
  const { study, wallet } = snapshot;
  const en = command.language === 'en';
  switch (command.kind) {
    case 'shopItem': {
      const { shop } = snapshot;
      if (!command.params.item) {
        return answer(en ? 'Which color or car do you mean?' : 'Bạn muốn xem xe nào hoặc xe màu gì?', null);
      }
      const matches = findShopItems(command.params.item, shop.items);
      // A request to show the car can use the learner's equipped car when it matches.
      const equipped = command.params.preferEquipped ? matches.find((item) => item.slot === 'car' && item.equipped) : undefined;
      if (matches.length > 1 && !equipped) {
        const options = matches.slice(0, 3);
        const names = options.map(({ name, price }) => `“${name}” (${price} RC)`).join(', ');
        const reply = answer(en ? `I found ${names}. Which one would you like to see?`
          : `Mình tìm thấy ${names}. Bạn muốn xem món nào?`, null);
        return { ...reply, followups: options.map(({ name }) => en ? `Show me ${name} in the shop` : `Xem ${name} trong Gara`) };
      }
      const item = equipped ?? matches[0];
      if (!item) {
        return answer(en ? 'I couldn’t find a matching item in the shop. What other details can you share?'
          : 'Mình chưa tìm thấy món phù hợp trong Gara. Bạn mô tả thêm tên, màu hoặc kiểu dáng nhé.', null);
      }
      return shopItemAnswer(item, shop.coins, en);
    }
    case 'shopCatalog': {
      const { items, coins } = snapshot.shop;
      const slots = {
        car: en ? 'cars' : 'xe',
        frame: en ? 'avatar frames' : 'khung avatar',
        nameplate: en ? 'nameplates' : 'nền',
        booster: en ? 'boosters' : 'vật phẩm hỗ trợ',
      } satisfies Record<ShopSlot, string>;
      const summary = (Object.keys(slots) as ShopSlot[]).map((slot) => {
        const count = items.filter((item) => item.slot === slot && (slot !== 'nameplate' || item.unlock_type !== 'default')).length;
        return `${count} ${slots[slot]}`;
      }).join(', ');
      return answer(en ? `The Gara has ${summary}. Your balance is ${coins} RC.`
        : `Gara có ${summary}. Bạn có ${coins} RC.`,
      { kind: 'spotlight', tab: 'shop', highlight: 'control:shop-catalog', label: en ? 'Shop catalog' : 'Danh mục Gara' });
    }
    case 'videoLibrary': {
      if (!command.params.owned) {
        return answer(en ? 'Opened the video library.' : 'Đã mở thư viện video.',
          { kind: 'open_tab', tab: 'videos', label: '' });
      }
      return answer(en ? `You’ve added ${study.ownedVideos} private videos.` : `Bạn đã thêm ${study.ownedVideos} video riêng tư.`,
        { kind: 'spotlight', tab: 'videos', highlight: 'control:owned-videos', label: en ? 'My videos' : 'Video của tôi' });
    }
    case 'video': {
      const { params } = command;
      const { videoCatalog } = study;
      const owned = study.ownedVideoCatalog ?? [];
      const pool = params.owned ? owned : videoCatalog;
      const unfinished = pool.filter(({ completed }) => !completed);
      const preferred = unfinished.length ? unfinished : pool;
      let video: VideoCatalogEntry | undefined;
      if (params.choice === 'topic') {
        const accessible = params.owned ? owned : [...videoCatalog, ...owned];
        const current = /^(?:nay|dang xem|hien tai|this|current)$/.test(params.topic);
        const activeTitle = context?.tab === 'videos' ? /^Video: (.+)$/.exec(context.focus ?? '')?.[1] : undefined;
        const filter = !current && !params.code ? videoCatalogueQuery(params.topic) : null;
        const visible = accessible.filter((item) => withinVideoDuration(item, filter?.maxSeconds));
        const query = current ? normalizeDestination(activeTitle ?? '') : filter?.topic ?? params.topic;
        const codes = visible.filter(({ code }) => code && normalizeDestination(code) === query);
        if (!current && codes.length === 1) video = codes[0];
        if (!video && !current && /^\d+$/.test(query)) video = visible.find(({ id }) => id === Number(query));
        if (!video && !params.code && query) {
          const exact = visible.filter(({ title }) => normalizeDestination(title) === query);
          const ranked = current ? [] : rankCatalog(query, visible);
          if (exact.length === 1) video = exact[0];
          if (exact.length === 0 && ranked[0] && ranked[0].score > (ranked[1]?.score ?? 0)) video = ranked[0].item;
          const choices = exact.length > 1 ? exact : !video ? ranked.slice(0, 3).map(({ item }) => item) : [];
          if (choices.length > 1 && !params.lookupOnly && !current) {
            const titles = choices.slice(0, 3).map(({ title }) => `“${title}”`).join(', ');
            return {
              ...answer(en ? `I found ${titles}. Which one would you like to open?`
                : `Mình tìm thấy ${titles}. Bạn muốn mở video nào?`, null),
              actions: choices.slice(0, 3).map(({ id, title }) => ({ kind: 'open_video', videoId: id, label: title })),
            };
          }
        }
      } else {
        video = params.choice === 'random' ? preferred[Math.floor(Math.random() * preferred.length)] : preferred[0];
      }
      if (!video) {
        return answer(en ? 'I couldn’t find a matching video you can watch. Try its title or code.'
          : 'Mình chưa tìm thấy video phù hợp trong thư viện bạn có thể xem. Bạn thử tên đầy đủ hoặc mã video nhé.', null);
      }
      return videoAnswer(video, en, params.choice === 'topic' && params.lookupOnly);
    }
    case 'studyHistory': {
      const { view, title } = command.params;
      const history = study.lessonHistory ?? [];
      if (view === 'absence') {
        const days = study.daysSinceStudy;
        return answer(days == null
          ? (en ? 'There’s no saved study activity yet.' : 'Tài khoản của bạn chưa có hoạt động học được lưu.')
          : days <= 0
            ? (en ? 'You studied within the last 24 hours.' : 'Bạn đã học trong vòng 24 giờ qua.')
            : (en ? `Your last recorded study activity was ${days} days ago.` : `Lần học gần nhất được ghi nhận cách đây ${days} ngày.`), null);
      }
      if (view === 'current') {
        const activeTitle = context?.tab === 'study' ? /^Bài học: (.+)$/.exec(context.focus ?? '')?.[1] : undefined;
        const active = activeTitle && study.lessons.find(({ title }) => title === activeTitle);
        if (active) return answer(en ? `You’re working on “${active.title}”.` : `Bạn đang học bài “${active.title}”.`, null);
        const next = pickNextLesson(study);
        return answer(next
          ? (en ? `Your next roadmap lesson is “${next.title}”.` : `Bài tiếp theo trên lộ trình của bạn là “${next.title}”.`)
          : (en ? 'You’ve reached the end of your roadmap.' : 'Bạn đã học hết lộ trình hiện tại.'), null);
      }
      if (view === 'weak') {
        const topics = learner?.weakTopics.slice(0, 3) ?? [];
        const mistakes = topics.map(({ topic, mistakes }) => `${topic} (${mistakes} ${en ? 'errors' : 'lượt sai'})`).join(', ');
        return answer(mistakes
          ? (en ? `Most recorded mistakes: ${mistakes}.` : `Bạn sai nhiều nhất ở ${mistakes}.`)
          : (en ? 'There are no recorded incorrect lesson answers yet.' : 'Chưa có câu trả lời sai nào được lưu trong bài học.'), null);
      }
      const exact = title ? history.filter((entry) => normalizeDestination(entry.title) === title) : [];
      const lessons = title
        ? (exact.length ? exact : history.filter((entry) => normalizeDestination(entry.title).includes(title))).slice(0, 3)
        : history.slice(0, 3);
      if (!lessons.length) return answer(en ? 'I couldn’t find a matching lesson in your study history.'
        : 'Mình chưa tìm thấy bài phù hợp trong lịch sử học của bạn.', null);
      const list = lessons.map((entry) => {
        const status = entry.status === 'completed' ? (en ? 'completed' : 'đã hoàn thành') : (en ? 'in progress' : 'đang học');
        const score = entry.score === null ? '' : `, ${entry.score}/100`;
        return `“${entry.title}” (${status}${score}${title ? `, ${entry.attempts} ${en ? 'attempts' : 'lượt làm'}` : ''})`;
      }).join('. ');
      return answer(en ? `Your study history: ${list}.` : `Trong lịch sử học của bạn có ${list}.`, null);
    }
    case 'lesson': {
      const { params } = command;
      const next = pickNextLesson(study);
      const frontier = study.lessons.find(({ id }) => id === next?.id);
      const stages = [...new Set(study.lessons.map(({ stageTitle }) => stageTitle))];
      const stage = params === 'next' || params.stage === undefined ? undefined : stages[params.stage - 1];
      const askStage = () => answer(en ? 'Which stage is that lesson in?' : 'Bạn muốn học bài đó ở chặng nào?', null);
      let lesson: typeof frontier;
      if (params === 'next') {
        lesson = frontier;
      } else if ('number' in params) {
        const stageTitle = params.stage === undefined ? frontier?.stageTitle : stage;
        if (!stageTitle) return askStage();
        lesson = study.lessons.filter((item) => item.stageTitle === stageTitle)[params.number - 1];
        if (!lesson) return askStage();
      } else {
        if (params.stage !== undefined && !stage) return askStage();
        const candidates = stage ? study.lessons.filter(({ stageTitle }) => stageTitle === stage) : study.lessons;
        const topic = /^(?:ve|about) (.+)$/.exec(params.title)?.[1];
        const matches = candidates.filter(({ title }) => normalizeDestination(title) === params.title);
        if (matches.length === 1) lesson = matches[0];
        if (matches.length === 0 && topic) {
          const scored = rankCatalog(topic, candidates);
          if (scored[0]?.score > (scored[1]?.score ?? 0)) lesson = scored[0].item;
        }
      }
      if (!lesson) {
        return answer(params === 'next'
          ? (en ? 'There’s no new lesson on your roadmap.' : 'Lộ trình của bạn đã hết bài mới.')
          : (en ? 'What’s the lesson’s full title and stage?' : 'Bạn cho mình tên đầy đủ và chặng của bài nhé?'), null);
      }
      return answer(en ? `Opened “${lesson.title}”.` : `Đã mở bài “${lesson.title}”.`,
        { kind: 'open_lesson', tab: 'study', lessonId: lesson.id, label: '' });
    }
    case 'wallet':
      return answer(en ? `You have ${wallet.coins} RC.` : `Bạn có ${wallet.coins} RC.`,
        { kind: 'spotlight', tab: 'profile', highlight: 'wallet:summary', label: en ? 'View balance' : 'Xem số dư' });
    case 'stats':
      return answer(
        en ? `You’re level ${wallet.level} with ${wallet.xp} XP and a ${wallet.streak}-day streak.`
          : `Bạn ở cấp ${wallet.level}, có ${wallet.xp} XP và chuỗi ${wallet.streak} ngày.`,
        { kind: 'spotlight', tab: 'profile', highlight: 'profile:stats', label: en ? 'View stats' : 'Xem thống kê' },
      );
    case 'path':
      return answer(
        en ? `You’ve completed ${study.completedLessons} of ${study.totalLessons} lessons.`
          : `Bạn đã hoàn thành ${study.completedLessons}/${study.totalLessons} bài.`,
        { kind: 'spotlight', tab: 'profile', highlight: 'profile:path', label: en ? 'View progress' : 'Xem tiến độ' },
      );
    case 'badges':
      return answer(en ? `Badges earned: ${study.badges}.` : `Bạn đã nhận ${study.badges} huy hiệu.`,
        { kind: 'spotlight', tab: 'profile', highlight: 'profile:badges', label: en ? 'View badges' : 'Xem huy hiệu' });
    case 'equipment': {
      const items = Object.values(wallet.equipment).flatMap((item) => item ? [item.name] : []);
      const reply = items.length
        ? (en ? `Equipped: ${items.join(', ')}.` : `Bạn đang dùng ${items.join(', ')}.`)
        : (en ? 'You have no items equipped.' : 'Bạn chưa trang bị vật phẩm nào.');
      return answer(reply, { kind: 'spotlight', tab: 'profile', highlight: 'profile:stats', label: en ? 'View profile' : 'Xem hồ sơ' });
    }
  }
}
