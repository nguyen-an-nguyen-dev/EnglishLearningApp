import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop, Svg } from 'react-native-svg';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme, type AppTheme } from '@/contexts/theme-context';
import { EarnedBadge, fetchMyBadges, fetchRanking, RankingData } from '@/services/ranking';

type BadgeIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];
type AccentKey = keyof typeof PALETTE;

// Every badge card carries its own colour pair: `strong`/`soft` for light mode, `bright`/`deep` for dark.
const PALETTE = {
  cyan: { strong: '#0B9FD3', bright: '#5FD8FF', soft: '#E4F8FE', deep: '#122B36' },
  violet: { strong: '#7A4CE0', bright: '#B79BFF', soft: '#F1ECFE', deep: '#241C38' },
  gold: { strong: '#D9930B', bright: '#F5B942', soft: '#FFF3D8', deep: '#332713' },
  mint: { strong: '#0CA974', bright: '#63E5B2', soft: '#E0F9EE', deep: '#14302A' },
  coral: { strong: '#EF4E5B', bright: '#FF8F97', soft: '#FFECEE', deep: '#351D21' },
  blue: { strong: '#2E6BE6', bright: '#93B4FF', soft: '#E8EFFE', deep: '#1A2438' },
} as const;

const BADGE_STYLES: Record<string, { accent: AccentKey; icon: BadgeIcon }> = {
  first_lesson: { accent: 'cyan', icon: 'school' },
  lessons_10: { accent: 'blue', icon: 'medal' },
  xp_100: { accent: 'mint', icon: 'lightning-bolt' },
  xp_500: { accent: 'violet', icon: 'trophy' },
};
const DEFAULT_BADGE = { accent: 'blue', icon: 'diamond-stone' } as const;

// The hero is a sky-blue ramp, the battle card a periwinkle-violet one; both stay light enough
// to keep white type readable while reading as siblings of the same brand family.
const HERO_RAMP = { light: ['#A9DBFD', '#3E8DF9'], dark: ['#2C6FC0', '#173B7E'] } as const;
const BATTLE_RAMP = { light: ['#9C93F8', '#7A5CE8'], dark: ['#4A3FA8', '#2C2570'] } as const;
const PAGE_RAMP = { light: ['#C7E1FD', '#F7F9FD'], dark: ['#131A23', '#0D1117'] } as const;
const CHECKER_INK = { light: '#5FA8EE', dark: '#33506E' } as const;

// Podium discs: face gradient + laurel colour, per theme.
const PODIUM = {
  1: { light: { from: '#FFDC72', to: '#EFA31F', laurel: '#E39A22' }, dark: { from: '#F4C85A', to: '#8A6218', laurel: '#E0B24E' } },
  2: { light: { from: '#EEF2F8', to: '#A3B2CB', laurel: '#98A7C0' }, dark: { from: '#CBD6E4', to: '#5A6B82', laurel: '#B4C2D6' } },
  3: { light: { from: '#F7C89E', to: '#CE7C33', laurel: '#C1762F' }, dark: { from: '#E2A876', to: '#7A4517', laurel: '#D6A070' } },
} as const;

// The own row is the only warm card in the list: cream fill inside a gold rim.
type RowLook = {
  fill: string;
  border: string;
  selfFill: string;
  selfBorder: string;
  selfGlow: string;
  selfGlowOpacity: number;
  ring: string;
  chipBg: string;
  chipInk: string;
};

const ROW_LOOK: Record<AppTheme, RowLook> = {
  light: {
    fill: '#FFFFFF',
    border: '#E8EEF7',
    selfFill: '#FEF3DC',
    selfBorder: '#F5C445',
    selfGlow: '#EFA221',
    selfGlowOpacity: 0.3,
    ring: '#FFFFFF',
    chipBg: '#FFE9C4',
    chipInk: '#B4560B',
  },
  dark: {
    fill: '#141C26',
    border: '#242F3C',
    selfFill: '#2A2314',
    selfBorder: '#B98A2E',
    selfGlow: '#E3B450',
    selfGlowOpacity: 0.28,
    ring: '#FFFFFF',
    chipBg: '#3B2C14',
    chipInk: '#FFC46B',
  },
};

const SECTION_TONE = {
  light: { icon: '#2E6BE6', chipBg: '#EDF3FB', chipBorder: '#DCE7F3', chipInk: '#22385A' },
  dark: { icon: '#5FD8FF', chipBg: '#18222E', chipBorder: '#26313D', chipInk: '#C9D6E4' },
} as const;

// Flat vector avatars: the backend never returns a picture, so each racer gets a
// deterministic tint plus the same head-and-shoulders silhouette in a darker shade of it.
const AVATAR_TINTS: Array<[string, string]> = [
  ['#D3EAFD', '#3F6D9E'],
  ['#FBDFE9', '#A85574'],
  ['#DAF4E7', '#3C8C64'],
  ['#EAE1FD', '#6E51AC'],
  ['#FCEAD1', '#A5732F'],
  ['#DCEEF8', '#41728C'],
];

const LEADERBOARD_VISIBLE_ROWS = 3;
const LEADERBOARD_ROW_HEIGHT = 60;
const LEADERBOARD_ROW_GAP = 12;
const CARD_GAP = 13;
const CARD_RADIUS = 20;
const GOLD = { from: '#FFD964', to: '#E89A16' } as const;

function toneFor(accent: AccentKey, theme: AppTheme) {
  const pair = PALETTE[accent];
  return theme === 'dark'
    ? { foreground: pair.bright, background: pair.deep, border: `${pair.bright}66` }
    : { foreground: pair.strong, background: pair.soft, border: `${pair.strong}4D` };
}

function tintIndexOf(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) % 997;
  return hash % AVATAR_TINTS.length;
}

// Diagonal brand wash plus a top sheen — depth without decorative glow blobs.
function GradientSurface({ from, to, seed }: { from: string; to: string; seed: string }) {
  const id = `card-${seed}-${from.slice(1)}-${to.slice(1)}`;
  return (
    <Svg preserveAspectRatio="none" style={StyleSheet.absoluteFill} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={id} x1="0" x2="1" y1="0" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
        <LinearGradient id={`${id}-sheen`} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
          <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.06} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect fill={`url(#${id})`} height="100%" width="100%" x={0} y={0} />
      <Rect fill={`url(#${id}-sheen)`} height="55%" width="100%" x={0} y={0} />
    </Svg>
  );
}

// Fixed page backdrop: a sky gradient that settles into the page colour, with a
// rotated racing checker in the top-right corner.
function PageBackdrop({ theme }: { theme: AppTheme }) {
  const { width, height } = Dimensions.get('window');
  const [from, to] = theme === 'dark' ? PAGE_RAMP.dark : PAGE_RAMP.light;
  const id = `page-${theme}`;
  const cell = 18;
  const columns = 9;
  const rows = 12;
  const squares: { key: string; x: number; y: number }[] = [];
  for (let column = 0; column < columns; column += 1) {
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      if ((column + rowIndex) % 2 === 0) continue;
      squares.push({ key: `${column}-${rowIndex}`, x: column * cell, y: rowIndex * cell });
    }
  }
  return (
    <Svg height={height} style={styles.backdrop} viewBox={`0 0 ${width} ${height}`} width={width}>
      <Defs>
        <LinearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="0.42" stopColor={to} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect fill={`url(#${id})`} height={height} width={width} x={0} y={0} />
      <G opacity={theme === 'dark' ? 0.14 : 0.11}>
        <G transform={`translate(${width - columns * cell - 8} -26) rotate(-18)`}>
          {squares.map((square) => (
            <Rect
              fill={CHECKER_INK[theme]}
              height={cell}
              key={square.key}
              width={cell}
              x={square.x}
              y={square.y}
            />
          ))}
        </G>
      </G>
    </Svg>
  );
}

function TrophyMark({ theme }: { theme: AppTheme }) {
  const id = `trophy-${theme}`;
  return (
    <Svg height={64} style={styles.headerArt} viewBox="0 0 64 64" width={64}>
      <Defs>
        <LinearGradient id={id} x1="0" x2="0.6" y1="0" y2="1">
          <Stop offset="0" stopColor={GOLD.from} />
          <Stop offset="1" stopColor={GOLD.to} />
        </LinearGradient>
      </Defs>
      <Path d="M21 9 H43 V25 Q43 37 32 39 Q21 37 21 25 Z" fill={`url(#${id})`} />
      <G fill="none" stroke={GOLD.to} strokeLinecap="round" strokeWidth="3.4">
        <Path d="M21 13 Q10 14 10 21 Q10 28 19 28" />
        <Path d="M43 13 Q54 14 54 21 Q54 28 45 28" />
      </G>
      <Rect fill={GOLD.to} height="6" width="7" x="28.5" y="38" />
      <Path d="M23 44 H41 L44 51 H20 Z" fill={`url(#${id})`} />
      <Rect fill={GOLD.to} height="5" rx="2.5" width="30" x="17" y="51" />
      <Path d="M32 15 L34.4 20 L39.8 20.8 L35.8 24.4 L36.8 29.8 L32 27.2 L27.2 29.8 L28.2 24.4 L24.2 20.8 L29.6 20 Z" fill="#FFFFFF" opacity="0.55" />
      <G fill={GOLD.from} opacity={theme === 'dark' ? 0.75 : 0.95}>
        <Path d="M53 4 L55 9 L60 11 L55 13 L53 18 L51 13 L46 11 L51 9 Z" />
        <Path d="M9 30 L10.6 34 L14.6 35.6 L10.6 37.2 L9 41 L7.4 37.2 L3.4 35.6 L7.4 34 Z" />
      </G>
    </Svg>
  );
}

function CrownMark() {
  return (
    <Svg height={20} viewBox="0 0 34 22" width={31}>
      <Defs>
        <LinearGradient id="crown-face" x1="0" x2="0.4" y1="0" y2="1">
          <Stop offset="0" stopColor={GOLD.from} />
          <Stop offset="1" stopColor={GOLD.to} />
        </LinearGradient>
      </Defs>
      <Path d="M3 17 L6.5 5 L12 11 L17 2.5 L22 11 L27.5 5 L31 17 Z" fill="url(#crown-face)" />
      <Rect fill={GOLD.to} height="3.4" rx="1.6" width="28" x="3" y="17.4" />
      <Circle cx="17" cy="12" fill="#FFFFFF" opacity="0.45" r="2.1" />
    </Svg>
  );
}

// Checkered finish flag on a small pedestal, drawn as skewed quads so it waves without a clip path.
function FlagMark({ theme }: { theme: AppTheme }) {
  const dark = theme === 'dark' ? '#0E1622' : '#243043';
  const light = theme === 'dark' ? '#C7D6E6' : '#FFFFFF';
  const cell = 7.4;
  const squares: { key: string; fill: string; x: number; y: number }[] = [];
  for (let column = 0; column < 5; column += 1) {
    for (let rowIndex = 0; rowIndex < 4; rowIndex += 1) {
      squares.push({
        key: `${column}-${rowIndex}`,
        fill: (column + rowIndex) % 2 === 0 ? dark : light,
        x: 17 + column * cell,
        y: 10 + rowIndex * cell + Math.sin((column / 5) * Math.PI * 2) * 1.8,
      });
    }
  }
  return (
    <Svg height={54} viewBox="0 0 58 66" width={48}>
      <Ellipse cx="29" cy="61" fill={theme === 'dark' ? '#3B3380' : '#7F71EE'} opacity="0.55" rx="17" ry="4.4" />
      <Ellipse cx="29" cy="58" fill={theme === 'dark' ? '#4A41A0' : '#9186F4'} opacity="0.6" rx="13" ry="3.6" />
      <Rect fill="#8FA0B8" height="52" rx="1.5" width="3" x="13.5" y="8" />
      <Circle cx="15" cy="8" fill={GOLD.from} r="3.4" />
      {squares.map((square) => (
        <Rect
          fill={square.fill}
          height={cell}
          key={square.key}
          width={cell}
          x={square.x}
          y={square.y}
        />
      ))}
      <Path d="M17 10 Q28 6 54 12 L54 16 Q28 10 17 14 Z" fill="#FFFFFF" opacity="0.28" />
    </Svg>
  );
}

const LAUREL_LEAVES = [
  { x: 11.4, y: 28.4, r: -46 },
  { x: 6.8, y: 23.4, r: -66 },
  { x: 4.4, y: 17.0, r: -88 },
  { x: 4.9, y: 10.6, r: -110 },
  { x: 7.4, y: 5.4, r: -132 },
];

function MedalDisc({ rank, theme }: { rank: number; theme: AppTheme }) {
  const look = PODIUM[rank as 1 | 2 | 3][theme];
  const id = `medal-${rank}-${theme}`;
  return (
    <View style={styles.medalDisc}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 34 34">
        <Defs>
          <LinearGradient id={id} x1="0" x2="0.35" y1="0" y2="1">
            <Stop offset="0" stopColor={look.from} />
            <Stop offset="1" stopColor={look.to} />
          </LinearGradient>
        </Defs>
        <Circle cx="17" cy="17" fill={`url(#${id})`} r="16" />
        <Circle cx="17" cy="13" fill="#FFFFFF" opacity="0.22" r="10.5" />
        <Circle cx="17" cy="17" fill="none" r="15.2" stroke={look.to} strokeOpacity="0.75" strokeWidth="1.4" />
      </Svg>
      <Text style={styles.medalNumber}>{rank}</Text>
    </View>
  );
}

function LaurelRank({ rank, theme }: { rank: number; theme: AppTheme }) {
  const look = PODIUM[rank as 1 | 2 | 3][theme];
  const sprig = (
    <G>
      <Path d="M17 33 Q3.6 23 7 5.6" fill="none" stroke={look.laurel} strokeLinecap="round" strokeWidth="1.1" />
      {LAUREL_LEAVES.map((leaf) => (
        <Ellipse
          key={leaf.x}
          cx={leaf.x}
          cy={leaf.y}
          fill={look.laurel}
          rx={2.2}
          ry={1.1}
          transform={`rotate(${leaf.r} ${leaf.x} ${leaf.y})`}
        />
      ))}
    </G>
  );
  return (
    <View style={styles.podiumWrap}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 50 36">
        {sprig}
        <G transform="translate(50,0) scale(-1,1)">{sprig}</G>
      </Svg>
      <MedalDisc rank={rank} theme={theme} />
    </View>
  );
}

function AvatarFace({ name, ring, size, theme }: { name: string; ring: boolean; size: number; theme: AppTheme }) {
  const [bg, ink] = AVATAR_TINTS[tintIndexOf(name)];
  const look = ROW_LOOK[theme];
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderColor: ring ? look.ring : `${ink}40`,
          borderWidth: ring ? 3 : 1.5,
        },
      ]}
    >
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 44 44">
        <Circle cx="22" cy="16.8" fill={ink} opacity="0.95" r="7.8" />
        <Path d="M7 44 Q7 30.6 22 30.6 Q37 30.6 37 44 Z" fill={ink} opacity="0.95" />
        <Circle cx="19.4" cy="14.4" fill="#FFFFFF" opacity="0.28" r="2.4" />
      </Svg>
    </View>
  );
}

// Coloured lift for cards: light mode keeps it faint, dark mode needs more opacity to read on #0D1117.
function cardShadow(theme: AppTheme, color: string, opacity: number, radius = 18) {
  return theme === 'dark'
    ? { shadowColor: color, shadowOpacity: Math.min(0.9, opacity + 0.25), shadowRadius: radius, shadowOffset: { width: 0, height: 8 }, elevation: 8 }
    : { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: 8 }, elevation: 5 };
}

// Calm lift for the non-leaderboard cards — colour belongs to the leaderboard, these only need depth.
function surfaceShadow(theme: AppTheme) {
  return cardShadow(theme, theme === 'dark' ? '#000000' : '#16323F', theme === 'dark' ? 0.5 : 0.09);
}

function rowShadow(theme: AppTheme, look: RowLook, isSelf: boolean) {
  return isSelf
    ? cardShadow(theme, look.selfGlow, look.selfGlowOpacity, 16)
    : cardShadow(theme, theme === 'dark' ? '#000000' : '#8FA5BC', theme === 'dark' ? 0.45 : 0.22, 12);
}

export default function RankingScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const [ranking, setRanking] = useState<RankingData | null>(null);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [listExpanded, setListExpanded] = useState(false);
  const listRef = useRef<ScrollViewInstance | null>(null);
  const revealOwnRow = useRef(false);

  const loadRanking = useCallback(async () => {
    try {
      setErrorMessage(null);
      const [rankingData, earnedBadges] = await Promise.all([fetchRanking(), fetchMyBadges()]);
      setRanking(rankingData);
      setBadges(earnedBadges);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải bảng xếp hạng.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      revealOwnRow.current = true;
      void loadRanking();
    }, [loadRanking]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadRanking();
  }, [loadRanking]);

  const look = ROW_LOOK[theme];
  const section = SECTION_TONE[theme];
  const leaderboard = ranking?.leaderboard ?? [];
  const [heroFrom, heroTo] = theme === 'dark' ? HERO_RAMP.dark : HERO_RAMP.light;
  const [battleFrom, battleTo] = theme === 'dark' ? BATTLE_RAMP.dark : BATTLE_RAMP.light;
  const currentUserEntry = leaderboard.find((entry) => entry.userId === user?.id);
  const currentUserRank = ranking?.current_user_rank;
  const myXp = currentUserEntry?.xp ?? user?.xp ?? 0;
  const rowPitch = LEADERBOARD_ROW_HEIGHT + LEADERBOARD_ROW_GAP;
  const visibleRows = listExpanded ? Math.max(leaderboard.length, 1) : LEADERBOARD_VISIBLE_ROWS;
  const leaderboardHeight = visibleRows * LEADERBOARD_ROW_HEIGHT + (visibleRows - 1) * LEADERBOARD_ROW_GAP + 4;
  // The full list stays scrollable; entering the tab parks the own card at the bottom of the window.
  const myIndex = leaderboard.findIndex((entry) => entry.userId === user?.id);
  useEffect(() => {
    if (!revealOwnRow.current || myIndex < 0) return;
    revealOwnRow.current = false;
    const y = Math.max(0, myIndex * rowPitch - (LEADERBOARD_VISIBLE_ROWS - 1) * rowPitch);
    const frame = requestAnimationFrame(() => listRef.current?.scrollTo({ y, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [myIndex, rowPitch]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme === 'dark' ? PAGE_RAMP.dark[1] : PAGE_RAMP.light[1] }]}>
      <PageBackdrop theme={theme} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme === 'dark' ? PALETTE.cyan.bright : PALETTE.cyan.strong}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.header}>
          <TrophyMark theme={theme} />
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: colors.text }]}>Ranking</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Learn · Race · Win</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cài đặt"
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.settingsButton, { backgroundColor: colors.cardBackground, borderColor: section.chipBorder }, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons color={colors.textMuted} name="cog" size={20} />
          </Pressable>
        </View>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons color={PALETTE.coral.bright} name="alert-circle-outline" size={17} />
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable accessibilityRole="button" onPress={onRefresh}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.heroCard, cardShadow(theme, heroTo, theme === 'dark' ? 0.4 : 0.28)]}>
          <GradientSurface from={heroFrom} to={heroTo} seed="hero" />
          <View style={styles.heroRow}>
            <AvatarFace name={currentUserEntry?.name ?? user?.name ?? 'ban'} ring size={52} theme={theme} />
            <View style={styles.heroIdentity}>
              <Text style={styles.heroLabel}>Vị trí của bạn</Text>
              <Text numberOfLines={1} style={styles.currentUserName}>
                {currentUserEntry?.name ?? user?.name ?? 'Học viên'}
              </Text>
              <View style={styles.heroXpChip}>
                <MaterialCommunityIcons color="#FFD964" name="lightning-bolt" size={13} />
                <Text style={styles.heroXpText}>{myXp.toLocaleString()} XP</Text>
              </View>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroRank}>
              <CrownMark />
              <Text style={styles.heroRankValue}>{currentUserRank ? `#${currentUserRank}` : '—'}</Text>
              <Text style={styles.heroRankCaption}>
                {leaderboard.length ? `trong ${leaderboard.length} người` : 'chưa xếp hạng'}
              </Text>
            </View>
          </View>
          <Svg height={44} preserveAspectRatio="none" style={styles.heroWave} viewBox="0 0 100 44" width="100%">
            <Path d="M0 30 Q22 12 48 22 T100 16 V44 H0 Z" fill="#FFFFFF" opacity="0.1" />
            <Path d="M0 40 Q30 26 62 34 T100 30 V44 H0 Z" fill="#FFFFFF" opacity="0.08" />
          </Svg>
        </View>

        <SectionHeader
          chip={`${leaderboard.length} học viên`}
          icon="account-group"
          expanded={listExpanded}
          onToggle={() => setListExpanded((value) => !value)}
          theme={theme}
          title="Bảng xếp hạng"
        />

        <View style={[styles.leaderboardViewport, { height: leaderboardHeight }]}>
          {loading && !refreshing ? (
            <View style={styles.loadingState}><ActivityIndicator color={PALETTE.cyan.strong} /></View>
          ) : leaderboard.length ? (
            <ScrollView
              ref={listRef}
              contentContainerStyle={styles.leaderboardScroll}
              nestedScrollEnabled
              scrollEnabled={!listExpanded}
              showsVerticalScrollIndicator={false}
            >
              {leaderboard.map((entry) => {
                const medalRank = entry.rank >= 1 && entry.rank <= 3 ? entry.rank : null;
                const isCurrentUser = entry.userId === user?.id;
                return (
                  <View
                    key={entry.userId}
                    style={[
                      styles.rankingCard,
                      {
                        backgroundColor: isCurrentUser ? look.selfFill : look.fill,
                        borderColor: isCurrentUser ? look.selfBorder : look.border,
                      },
                      rowShadow(theme, look, isCurrentUser),
                    ]}
                  >
                    <View style={styles.rankCell}>
                      {medalRank ? (
                        <LaurelRank rank={medalRank} theme={theme} />
                      ) : (
                        <Text style={[styles.rankNumber, { color: colors.textMuted }]}>{entry.rank}</Text>
                      )}
                    </View>
                    <AvatarFace name={entry.name} ring={isCurrentUser} size={35} theme={theme} />
                    <View style={styles.rankingIdentity}>
                      <Text numberOfLines={1} style={[styles.rankingName, { color: colors.text }]}>
                        {entry.name}
                      </Text>
                      {isCurrentUser ? (
                        <View style={[styles.youChip, { backgroundColor: look.chipBg }]}>
                          <Text style={[styles.youChipText, { color: look.chipInk }]}>Bạn</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.rowXp, { color: colors.text }]}>{entry.xp.toLocaleString()}</Text>
                    <Text style={[styles.rowXpUnit, { color: colors.textMuted }]}>XP</Text>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: look.fill, borderColor: look.border }]}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Chưa có dữ liệu xếp hạng.</Text>
            </View>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/battle')}
          style={({ pressed }) => [
            styles.battleCard,
            cardShadow(theme, battleTo, theme === 'dark' ? 0.42 : 0.28),
            pressed && styles.pressed,
          ]}
        >
          <GradientSurface from={battleFrom} to={battleTo} seed="battle" />
          <View style={styles.battleTopRow}>
            <MaterialCommunityIcons color="#FFFFFF" name="controller-classic" size={19} />
            <Text style={styles.battleKicker}>Game học tiếng Anh</Text>
            <MaterialCommunityIcons color="#FFFFFF" name="star" opacity={0.55} size={19} />
          </View>
          <View style={styles.battleRow}>
            <FlagMark theme={theme} />
            <View style={styles.battleCopy}>
              <Text style={styles.battleTitle}>Word Battle</Text>
              <Text style={styles.battleDescription}>Thử thách cùng bạn bè</Text>
            </View>
            <View style={styles.battleCta}>
              <Text style={[styles.battleCtaText, { color: battleTo }]}>Chơi ngay</Text>
              <MaterialCommunityIcons color={battleTo} name="chevron-right" size={16} />
            </View>
          </View>
        </Pressable>

        <SectionHeader
          chip={`${badges.length} đã nhận`}
          icon="medal-outline"
          theme={theme}
          title="Huy hiệu"
        />

        {badges.length ? (
          <View style={styles.badgeGrid}>
            {badges.map((badge) => {
              const style = BADGE_STYLES[badge.code] ?? DEFAULT_BADGE;
              const tone = toneFor(style.accent, theme);
              const accentHex = theme === 'dark' ? PALETTE[style.accent].bright : PALETTE[style.accent].strong;
              return (
                <View
                  key={badge.code}
                  style={[
                    styles.badgeTile,
                    { backgroundColor: `${accentHex}14`, borderColor: `${accentHex}33` },
                    surfaceShadow(theme),
                  ]}
                >
                  <View style={[styles.badgeIconWrap, { backgroundColor: tone.background }]}>
                    <MaterialCommunityIcons color={tone.foreground} name={style.icon} size={19} />
                  </View>
                  <Text numberOfLines={1} style={[styles.badgeName, { color: colors.text }]}>{badge.name}</Text>
                  <Text numberOfLines={2} style={[styles.badgeDescription, { color: colors.textMuted }]}>{badge.description}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={[styles.noBadges, { color: colors.textMuted }]}>Hoàn thành bài học để nhận huy hiệu.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  chip,
  expanded,
  icon,
  onToggle,
  theme,
  title,
}: {
  chip: string;
  expanded?: boolean;
  icon: BadgeIcon;
  onToggle?: () => void;
  theme: AppTheme;
  title: string;
}) {
  const section = SECTION_TONE[theme];
  const chipBody = (
    <View style={[styles.sectionChip, { backgroundColor: section.chipBg, borderColor: section.chipBorder }]}>
      <Text style={[styles.sectionChipText, { color: section.chipInk }]}>{chip}</Text>
      {onToggle ? (
        <MaterialCommunityIcons
          color={section.chipInk}
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={15}
        />
      ) : null}
    </View>
  );
  return (
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons color={section.icon} name={icon} size={21} />
      <Text style={[styles.sectionTitle, { color: Colors[theme].text }]}>{title}</Text>
      <View style={styles.sectionSpacer} />
      {onToggle ? (
        <Pressable accessibilityRole="button" onPress={onToggle}>
          {chipBody}
        </Pressable>
      ) : (
        chipBody
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.light.background },
  backdrop: { position: 'absolute', top: 0, left: 0 },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 32 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  headerArt: { width: 64, height: 64, marginLeft: -6 },
  headerCopy: { flex: 1, minWidth: 0, gap: 1 },
  title: { color: '#17263B', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: '#64748B', fontSize: 12.5, fontWeight: '600' },
  settingsButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, borderWidth: 1 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, marginBottom: 14, borderRadius: 14, backgroundColor: PALETTE.coral.deep },
  errorText: { flex: 1, color: PALETTE.coral.bright, fontSize: 12, fontWeight: '600' },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },

  heroCard: { padding: 16, borderRadius: CARD_RADIUS, overflow: 'hidden' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIdentity: { flex: 1, minWidth: 0, gap: 4 },
  heroLabel: { color: 'rgba(255,255,255,0.86)', fontSize: 12, fontWeight: '600' },
  currentUserName: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  heroXpChip: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.26)' },
  heroXpText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  heroDivider: { width: 1, height: 56, backgroundColor: 'rgba(255,255,255,0.35)' },
  heroRank: { alignItems: 'center', gap: 1, flexShrink: 0 },
  heroRankValue: { color: '#FFFFFF', fontSize: 29, fontWeight: '900', letterSpacing: -1, marginTop: 2 },
  heroRankCaption: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  heroWave: { position: 'absolute', bottom: 0, left: 0 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, marginBottom: 12 },
  sectionTitle: { color: '#203447', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  sectionSpacer: { flex: 1 },
  sectionChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 13, borderWidth: 1 },
  sectionChipText: { color: '#22385A', fontSize: 12, fontWeight: '700' },

  loadingState: { paddingVertical: 34, alignItems: 'center', justifyContent: 'center' },

  leaderboardViewport: { flexShrink: 0, overflow: 'hidden' },
  leaderboardScroll: { gap: LEADERBOARD_ROW_GAP, paddingHorizontal: 2, paddingVertical: 2 },
  rankingCard: {
    height: LEADERBOARD_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 10,
    paddingRight: 11,
    borderRadius: 15,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  rankCell: { width: 44, alignItems: 'center' },
  podiumWrap: { width: 44, height: 33, alignItems: 'center', justifyContent: 'center' },
  medalDisc: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center' },
  medalNumber: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
  rankNumber: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  rankingIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  rankingName: { flexShrink: 1, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  youChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  youChipText: { fontSize: 11, fontWeight: '800' },
  rowXp: { fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] },
  rowXpUnit: { fontSize: 11.5, fontWeight: '700', marginLeft: 4 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderRadius: CARD_RADIUS },
  emptyText: { fontSize: 13, fontWeight: '500' },

  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },

  battleCard: { marginTop: 22, padding: 15, gap: 6, borderRadius: CARD_RADIUS, overflow: 'hidden' },
  battleTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  battleKicker: { flex: 1, color: 'rgba(255,255,255,0.92)', fontSize: 13.5, fontWeight: '700' },
  battleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  battleCopy: { flex: 1, minWidth: 0, gap: 2 },
  battleTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', letterSpacing: -0.4 },
  battleDescription: { color: 'rgba(255,255,255,0.88)', fontSize: 12, fontWeight: '600' },
  battleCta: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 15, backgroundColor: '#FFFFFF' },
  battleCtaText: { fontSize: 13.5, fontWeight: '900' },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },
  badgeTile: { flexGrow: 1, flexBasis: '47%', gap: 5, padding: 13, borderRadius: 16, borderWidth: 1 },
  badgeIconWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginBottom: 3 },
  badgeName: { fontSize: 12.5, fontWeight: '900' },
  badgeDescription: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  noBadges: { fontSize: 12, paddingVertical: 5, fontWeight: '600' },
});
