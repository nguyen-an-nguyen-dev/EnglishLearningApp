import { getLeague, getShop, getWallet } from '../gamification/gamification.service';
import { normalizeLeagueTier } from '../gamification/gamification.types';
import type { LeagueTier, ShopItem, ShopSlot } from '../gamification/gamification.types';
import type { BuddyCommand } from './ai.commands';
import { normalizeDestination } from './ai.language';
import { pickNextLesson, scoreCatalogMatch } from './ai.study';
import { getStudyStats } from './ai.repository';
import type { AiReply, ChatAction } from './ai.types';

export async function buildBuddySnapshot(userId: number) {
  const [study, wallet, shop, league] = await Promise.all([
    getStudyStats(userId),
    getWallet(userId),
    getShop(userId),
    getLeague(userId),
  ]);
  return { study, wallet, shop, league };
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

function matchShopItem(query: string, items: readonly ShopItem[]): ShopItem | undefined {
  const aliases: Record<string, string> = {
    khien: 'shield', 'khien bao ve': 'shield', 'khien bao ve chuoi': 'shield', 'bao ve streak': 'shield',
  };
  const term = aliases[query] ?? query;
  const visible = items.filter((item) => item.slot !== 'nameplate' || item.unlock_type !== 'default');
  const fields = (item: ShopItem) => [normalizeDestination(item.code), normalizeDestination(item.name)];
  const exact = visible.filter((item) => fields(item).includes(query));
  if (exact.length) return exact.length === 1 ? exact[0] : undefined;
  const unique = visible.filter((item) => fields(item).some((field) => ` ${field} `.includes(` ${term} `)));
  if (unique.length) return unique.length === 1 ? unique[0] : undefined;
  const bySlot = visible.filter((item) => SLOT_NAMES[item.slot].includes(query));
  return bySlot.length === 1 ? bySlot[0] : undefined;
}

function shopItemReply(item: ShopItem, coins: number, en: boolean): string {
  const name = `“${item.name}”`;
  if (!item.unlocked) {
    if (!en) return `${name} đang khóa${item.unlock_label ? ` (${item.unlock_label})` : ''}.`;
    const value = item.unlock_value;
    const requirements = {
      level: value ? `Reach level ${value}.` : '',
      stage: value ? `Complete stage ${value}.` : '',
      league: value ? `Reach the ${TIER_NAMES[normalizeLeagueTier(value)][1]} league this season.` : '',
      achievement: value === 'lessons_10' ? 'Earn the 10-lesson badge.'
        : value === 'xp_500' ? 'Earn the 500 XP badge.' : 'Earn the required achievement.',
      default: '',
    };
    return [`${name} is locked.`, requirements[item.unlock_type]].filter(Boolean).join(' ');
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

export function resolveBuddyCommand(command: BuddyCommand, snapshot: BuddySnapshot): AiReply {
  const { study, wallet, league } = snapshot;
  const en = command.language === 'en';
  switch (command.kind) {
    case 'shopItem': {
      const { shop } = snapshot;
      const item = matchShopItem(command.params.item, shop.items);
      if (!item) {
        return answer(en ? 'Which shop item do you mean? Try its full name or code.'
          : 'Bạn muốn tìm vật phẩm nào trong Gara? Thử tên đầy đủ hoặc mã vật phẩm nhé.', null);
      }
      return answer(shopItemReply(item, shop.coins, en), {
        kind: 'show_shop_item', tab: 'shop', itemCode: item.code,
        label: en ? `View ${item.name}` : `Xem ${item.name}`,
      });
    }
    case 'video': {
      const { params } = command;
      const { videoCatalog } = study;
      const unfinished = videoCatalog.filter(({ completed }) => !completed);
      const preferred = unfinished.length ? unfinished : videoCatalog;
      const video = params.choice === 'topic'
        ? videoCatalog
          .map((item) => ({ item, score: scoreCatalogMatch(params.topic, normalizeDestination(`${item.title} ${item.topic}`)) }))
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score || Number(a.item.completed) - Number(b.item.completed))[0]?.item
        : params.choice === 'random'
          ? preferred[Math.floor(Math.random() * preferred.length)]
          : preferred[0];
      if (!video) {
        return answer(params.choice === 'topic'
          ? (en ? 'I couldn’t find a published video on that topic. Try a different topic or the full title.'
            : 'Mình chưa tìm thấy video đã xuất bản về chủ đề đó. Bạn thử chủ đề khác hoặc tên đầy đủ nhé.')
          : (en ? 'There are no published videos in the library yet.' : 'Thư viện chưa có video đã xuất bản.'), null);
      }
      return answer(en ? `Opened listening practice for “${video.title}”.` : `Đã mở bài luyện nghe “${video.title}”.`,
        { kind: 'open_video', tab: 'videos', videoId: video.id, label: '' });
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
          const scored = candidates
            .map((item) => ({ item, score: scoreCatalogMatch(topic, normalizeDestination(`${item.title} ${item.topic}`)) }))
            .sort((a, b) => b.score - a.score);
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
    case 'rank': {
      const tier = TIER_NAMES[league.tier][en ? 1 : 0];
      const rank = league.my_rank;
      const reply = en
        ? (rank === null ? `You’re in the ${tier} league with ${league.race_points} RP and no weekly rank yet.`
          : `You’re ranked #${rank} in the ${tier} league this week with ${league.race_points} RP.`)
        : (rank === null ? `Bạn ở giải ${tier}, có ${league.race_points} RP và chưa có hạng tuần này.`
          : `Bạn đứng hạng ${rank} giải ${tier} tuần này với ${league.race_points} RP.`);
      return answer(reply, { kind: 'spotlight', tab: 'rankings', highlight: 'rank:me', label: en ? 'View weekly rank' : 'Xem hạng tuần' });
    }
  }
}
