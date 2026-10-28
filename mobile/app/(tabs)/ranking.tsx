import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
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
import { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop, Svg } from 'react-native-svg';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme, type AppTheme } from '@/contexts/theme-context';
import { EarnedBadge, fetchMyBadges, fetchRanking, RankingData, RankingEntry } from '@/services/ranking';

type BadgeIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];
type AccentKey = keyof typeof PALETTE;

// Every card carries its own colour pair: `strong`/`soft` for light mode, `bright`/`deep` for dark.
const PALETTE = {
  cyan: { strong: '#0B9FD3', bright: '#5FD8FF', soft: '#E4F8FE', deep: '#122B36' },
  violet: { strong: '#7A4CE0', bright: '#B79BFF', soft: '#F1ECFE', deep: '#241C38' },
  gold: { strong: '#D9930B', bright: '#F5B942', soft: '#FFF3D8', deep: '#332713' },
  silver: { strong: '#64798F', bright: '#D8E1EC', soft: '#EDF2F8', deep: '#1F2731' },
  bronze: { strong: '#C06C25', bright: '#CE8A4E', soft: '#FBE7D5', deep: '#33240F' },
  mint: { strong: '#0CA974', bright: '#63E5B2', soft: '#E0F9EE', deep: '#14302A' },
  coral: { strong: '#EF4E5B', bright: '#FF8F97', soft: '#FFECEE', deep: '#351D21' },
  blue: { strong: '#2E6BE6', bright: '#93B4FF', soft: '#E8EFFE', deep: '#1A2438' },
} as const;

const MEDAL_ACCENTS: AccentKey[] = ['gold', 'silver', 'bronze'];

// Badges stay inside the cyan→blue→violet brand ramp; gold/silver/bronze belong to the podium rows only.
const BADGE_STYLES: Record<string, { accent: AccentKey; icon: BadgeIcon }> = {
  first_lesson: { accent: 'cyan', icon: 'school' },
  lessons_10: { accent: 'blue', icon: 'medal' },
  xp_100: { accent: 'mint', icon: 'lightning-bolt' },
  xp_500: { accent: 'violet', icon: 'trophy' },
};
const DEFAULT_BADGE = { accent: 'blue', icon: 'diamond-stone' } as const;

// One two-stop brand ramp per big card, so the coloured blocks read as siblings instead of rivals.
const HERO_RAMP = { light: ['#0EA5D9', '#2E6BE6'], dark: ['#0B6E9E', '#2B4BA8'] } as const;
const BATTLE_RAMP = { light: ['#5B53E8', '#8B3FE0'], dark: ['#3E37A8', '#6C31B8'] } as const;

const LEADERBOARD_VISIBLE_ROWS = 3;
const LEADERBOARD_ROW_HEIGHT = 58;
const LEADERBOARD_ROW_GAP = 10;
const LEADERBOARD_FRAME_PADDING = 14;
const CARD_GAP = 13;
const CARD_RADIUS = 20;

const LIST_FRAME_LIGHT = '#D3E5F1';
const LIST_FRAME_DARK = '#0B151D';
// Own card uses the same fill as every other row; it is marked only by a white border + white halo.
const ROW_FILL_LIGHT = '#F5FAFD';
const ROW_FILL_DARK = '#141C26';
const SELF_BORDER = '#FFFFFF';
// Dark mode glows white; light mode needs a cool lift, otherwise a white halo vanishes on the pale frame.
const SELF_BLOOM_LIGHT = '#1B3A55';
const SELF_BLOOM_DARK = '#FFFFFF';
const SELF_BLOOM_RADIUS = 34;
const SELF_BLOOM_STRENGTH_LIGHT = 0.5;
const SELF_BLOOM_STRENGTH_DARK = 1;
// Left-edge accent stripe; the spill itself is a real SVG gradient (see LeftBeam).
const ROW_STRIPE_WIDTH = 5;

function toneFor(accent: AccentKey, theme: AppTheme) {
  const pair = PALETTE[accent];
  return theme === 'dark'
    ? { foreground: pair.bright, background: pair.deep, border: `${pair.bright}66` }
    : { foreground: pair.strong, background: pair.soft, border: `${pair.strong}4D` };
}

// A genuine horizontal gradient for the light spill; stacked alpha panels banded into visible steps.
function LeftBeam({ accent, theme }: { accent: AccentKey; theme: AppTheme }) {
  const color = theme === 'dark' ? PALETTE[accent].bright : PALETTE[accent].strong;
  const id = `beam-${accent}-${theme}`;
  const peak = theme === 'dark' ? 0.5 : 0.24;
  return (
    <Svg preserveAspectRatio="none" style={StyleSheet.absoluteFill} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <Stop offset="0" stopColor={color} stopOpacity={peak} />
          <Stop offset="0.12" stopColor={color} stopOpacity={peak * 0.52} />
          <Stop offset="0.28" stopColor={color} stopOpacity={peak * 0.2} />
          <Stop offset="0.46" stopColor={color} stopOpacity={peak * 0.06} />
          <Stop offset="0.68" stopColor={color} stopOpacity={0} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect fill={`url(#${id})`} height="100%" width="100%" x={0} y={0} />
    </Svg>
  );
}

// Diagonal brand wash plus a top sheen — depth without the decorative glow blobs.
function GradientSurface({ from, to }: { from: string; to: string }) {
  const id = `card-${from.slice(1)}-${to.slice(1)}`;
  return (
    <Svg preserveAspectRatio="none" style={StyleSheet.absoluteFill} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={id} x1="0" x2="1" y1="0" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
        <LinearGradient id={`${id}-sheen`} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.2} />
          <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.05} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect fill={`url(#${id})`} height="100%" width="100%" x={0} y={0} />
      <Rect fill={`url(#${id}-sheen)`} height="55%" width="100%" x={0} y={0} />
    </Svg>
  );
}

function initialsOf(entry: RankingEntry): string {
  const letters = entry.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return entry.avatar || letters || '?';
}

const LAUREL_LEAVES = [
  { x: 8.8, y: 15.4, r: -38 },
  { x: 5.6, y: 12.6, r: -58 },
  { x: 3.9, y: 9.0, r: -80 },
  { x: 4.2, y: 5.4, r: -102 },
];

// Two sprigs mirrored around x=12, rank number sitting in the opening of the wreath.
function LaurelRank({ accent, rank, theme }: { accent: AccentKey; rank: number; theme: AppTheme }) {
  const color = theme === 'dark' ? PALETTE[accent].bright : PALETTE[accent].strong;
  const sprig = (
    <G>
      <Path d="M11.4 17.8 Q3.6 14.8 4.3 4.2" fill="none" stroke={color} strokeLinecap="round" strokeWidth={1} />
      {LAUREL_LEAVES.map((leaf) => (
        <Ellipse
          key={leaf.x}
          cx={leaf.x}
          cy={leaf.y}
          fill={color}
          rx={2}
          ry={1.05}
          transform={`rotate(${leaf.r} ${leaf.x} ${leaf.y})`}
        />
      ))}
    </G>
  );
  return (
    <View style={styles.laurelWrap}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 24 22">
        {sprig}
        <G transform="translate(24,0) scale(-1,1)">{sprig}</G>
      </Svg>
      <Text style={[styles.laurelNumber, { color }]}>{rank}</Text>
    </View>
  );
}

// Coloured lift for every card: light mode keeps it faint, dark mode needs more opacity to read on #0D1117.
function cardShadow(theme: AppTheme, color: string, opacity: number, radius = 18) {
  return theme === 'dark'
    ? { shadowColor: color, shadowOpacity: Math.min(0.9, opacity + 0.25), shadowRadius: radius, shadowOffset: { width: 0, height: 8 }, elevation: 8 }
    : { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: 8 }, elevation: 5 };
}

// Calm lift for the non-leaderboard cards — colour belongs to the leaderboard, these only need depth.
function surfaceShadow(theme: AppTheme) {
  return cardShadow(theme, theme === 'dark' ? '#000000' : '#16323F', theme === 'dark' ? 0.5 : 0.09);
}

// Own-row halo: no downward offset, so the white ring lights up evenly on all four edges.
function ownRowGlow(theme: AppTheme) {
  return theme === 'dark'
    ? { shadowColor: SELF_BLOOM_DARK, shadowOpacity: SELF_BLOOM_STRENGTH_DARK, shadowRadius: SELF_BLOOM_RADIUS, shadowOffset: { width: 0, height: 0 }, elevation: 16 }
    : { shadowColor: SELF_BLOOM_LIGHT, shadowOpacity: SELF_BLOOM_STRENGTH_LIGHT, shadowRadius: SELF_BLOOM_RADIUS, shadowOffset: { width: 0, height: 3 }, elevation: 10 };
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

  const leaderboard = ranking?.leaderboard ?? [];
  const dividerColor = theme === 'dark' ? '#1E333E' : '#DCEAF3';
  const neutralFill = theme === 'dark' ? '#1F242B' : '#F1F5F9';
  const rowFill = theme === 'dark' ? ROW_FILL_DARK : ROW_FILL_LIGHT;
  // Header chip stays in the calm cyan family; the big cards own the two brand ramps.
  const cyanChip = theme === 'dark' ? PALETTE.cyan.deep : PALETTE.cyan.soft;
  const cyanInk = theme === 'dark' ? PALETTE.cyan.bright : PALETTE.cyan.strong;
  const [heroFrom, heroTo] = theme === 'dark' ? HERO_RAMP.dark : HERO_RAMP.light;
  const [battleFrom, battleTo] = theme === 'dark' ? BATTLE_RAMP.dark : BATTLE_RAMP.light;
  const currentUserEntry = leaderboard.find((entry) => entry.userId === user?.id);
  const currentUserRank = ranking?.current_user_rank;
  const myXp = currentUserEntry?.xp ?? user?.xp ?? 0;
  const topXp = leaderboard[0]?.xp ?? 0;
  const xpShare = topXp > 0 ? Math.min(100, Math.round((myXp / topXp) * 100)) : 0;
  // Exactly 3 row cards tall: frame padding + cards + gaps + the frame's 1px borders.
  const leaderboardHeight =
    LEADERBOARD_FRAME_PADDING * 2
    + LEADERBOARD_VISIBLE_ROWS * LEADERBOARD_ROW_HEIGHT
    + (LEADERBOARD_VISIBLE_ROWS - 1) * LEADERBOARD_ROW_GAP
    + 2;
  // The full list stays scrollable; entering the tab parks the own card at the bottom of the 3-row window.
  const myIndex = leaderboard.findIndex((entry) => entry.userId === user?.id);
  const rowPitch = LEADERBOARD_ROW_HEIGHT + LEADERBOARD_ROW_GAP;
  useEffect(() => {
    if (!revealOwnRow.current || myIndex < 0) return;
    revealOwnRow.current = false;
    const y = Math.max(0, LEADERBOARD_FRAME_PADDING + myIndex * rowPitch - (LEADERBOARD_VISIBLE_ROWS - 1) * rowPitch);
    const frame = requestAnimationFrame(() => listRef.current?.scrollTo({ y, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [myIndex, rowPitch]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { backgroundColor: colors.background }]}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme === 'dark' ? PALETTE.cyan.bright : PALETTE.cyan.strong}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Ranking</Text>
          <View style={[styles.headerBadge, { backgroundColor: cyanChip, borderColor: dividerColor }]}>
            <MaterialCommunityIcons color={cyanInk} name="trophy-award" size={22} />
          </View>
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

        <View style={[styles.heroCard, cardShadow(theme, heroFrom, theme === 'dark' ? 0.4 : 0.26)]}>
          <GradientSurface from={heroFrom} to={heroTo} />
          <View style={styles.heroRow}>
            <View style={styles.heroIdentity}>
              <Text style={styles.heroLabel}>VỊ TRÍ CỦA BẠN</Text>
              <Text numberOfLines={1} style={styles.currentUserName}>
                {currentUserEntry?.name ?? user?.name ?? 'Học viên'}
              </Text>
              <View style={styles.heroXpChip}>
                <MaterialCommunityIcons color="#FFFFFF" name="lightning-bolt" size={13} />
                <Text style={styles.heroXpText}>{myXp.toLocaleString()} XP</Text>
              </View>
            </View>
            <View style={styles.heroRank}>
              <Text style={styles.heroRankValue}>{currentUserRank ? `#${currentUserRank}` : '—'}</Text>
              <Text style={styles.heroRankCaption}>
                {leaderboard.length ? `trong ${leaderboard.length} người` : 'chưa xếp hạng'}
              </Text>
            </View>
          </View>
          <View style={styles.heroTrack}>
            <View style={[styles.heroFill, { width: `${xpShare}%` }]} />
          </View>
          <Text style={styles.heroHint}>
            {leaderboard.length === 0
              ? 'Học bài để bắt đầu ghi điểm XP.'
              : xpShare < 100
                ? `Còn ${(topXp - myXp).toLocaleString()} XP nữa để vươn lên dẫn đầu`
                : 'Bạn đang dẫn đầu bảng xếp hạng!'}
          </Text>
        </View>

        <SectionHeader colors={colors} meta={`${leaderboard.length} học viên`} title="Bảng xếp hạng" />

        <View style={[styles.leaderboardViewport, { height: leaderboardHeight }]}>
          {loading && !refreshing ? (
            <View style={styles.loadingState}><ActivityIndicator color={PALETTE.cyan.strong} /></View>
          ) : leaderboard.length ? (
            <View
              style={[
                styles.leaderboardFrame,
                {
                  backgroundColor: theme === 'dark' ? LIST_FRAME_DARK : LIST_FRAME_LIGHT,
                  borderColor: dividerColor,
                },
                cardShadow(theme, theme === 'dark' ? '#000000' : PALETTE.cyan.strong, theme === 'dark' ? 0.4 : 0.12),
              ]}
            >
              <ScrollView ref={listRef} nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={styles.leaderboardScroll}>
                {leaderboard.map((entry) => {
                  // Medal styling follows the real rank, so the pinned own-card never borrows a podium look.
                  const accent = entry.rank >= 1 && entry.rank <= 3 ? MEDAL_ACCENTS[entry.rank - 1] : null;
                  const medal = accent ? toneFor(accent, theme) : null;
                  const isCurrentUser = entry.userId === user?.id;
                  // Own card keeps a normal fill; only its border and halo say "this is you".
                  const litAccent: AccentKey | null = isCurrentUser ? null : accent;
                  const glowColor = theme === 'dark' ? '#000000' : '#1B3A55';
                  const glowStrength = accent ? 0.18 : 0.1;
                  const avatarFill = medal ? medal.background : neutralFill;
                  const avatarBorder = medal ? medal.border : dividerColor;
                  const avatarInk = medal ? medal.foreground : colors.textMuted;
                  return (
                    <View
                      key={entry.userId}
                      style={[
                        styles.rankingCard,
                        isCurrentUser && styles.rankingCardSelf,
                        {
                          backgroundColor: rowFill,
                          borderColor: isCurrentUser ? SELF_BORDER : medal ? medal.border : dividerColor,
                        },
                        isCurrentUser ? ownRowGlow(theme) : cardShadow(theme, glowColor, glowStrength, 16),
                      ]}
                    >
                      {litAccent ? <LeftBeam accent={litAccent} theme={theme} /> : null}
                      {litAccent ? (
                        <View
                          style={[
                            styles.rowStripe,
                            { backgroundColor: theme === 'dark' ? PALETTE[litAccent].bright : PALETTE[litAccent].strong },
                          ]}
                        />
                      ) : null}
                      <View style={styles.rankCell}>
                        {accent ? (
                          <LaurelRank accent={accent} rank={entry.rank} theme={theme} />
                        ) : (
                          <Text style={[styles.rankNumber, { color: colors.textMuted }]}>{entry.rank}</Text>
                        )}
                      </View>
                      <View style={[styles.avatar, { backgroundColor: avatarFill, borderColor: avatarBorder }]}>
                        <Text style={[styles.avatarText, { color: avatarInk }]}>{initialsOf(entry)}</Text>
                      </View>
                      <View style={styles.rankingIdentity}>
                        <Text numberOfLines={1} style={[styles.rankingName, { color: colors.text }]}>
                          {entry.name}
                        </Text>
                        {isCurrentUser ? <Text style={styles.youLabel}>Bạn</Text> : null}
                      </View>
                      <Text style={[styles.rowXp, { color: colors.text }]}>{entry.xp.toLocaleString()}</Text>
                      <Text style={[styles.rowXpUnit, { color: colors.textMuted }]}>XP</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor: theme === 'dark' ? LIST_FRAME_DARK : LIST_FRAME_LIGHT,
                  borderColor: dividerColor,
                },
              ]}
            >
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Chưa có dữ liệu xếp hạng.</Text>
            </View>
          )}
        </View>

        <SectionHeader colors={colors} meta="1 vs 1" title="Game học tiếng Anh" />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/battle')}
          style={({ pressed }) => [
            styles.battleCard,
            cardShadow(theme, battleFrom, theme === 'dark' ? 0.4 : 0.24),
            pressed && styles.battleCardPressed,
          ]}
        >
          <GradientSurface from={battleFrom} to={battleTo} />
          <View style={styles.battleRow}>
            <View style={styles.battleIconWrap}>
              <MaterialCommunityIcons color="#FFFFFF" name="sword-cross" size={25} />
            </View>
            <View style={styles.battleCopy}>
              <Text style={styles.battleKicker}>ĐẤU TỪ 1 VS 1 · TRỰC TIẾP</Text>
              <Text style={styles.battleTitle}>Word Battle</Text>
              <Text style={styles.battleDescription}>12 từ, 30 giây mỗi từ — ai đoán nhanh hơn thắng</Text>
            </View>
            <View style={styles.battleCta}>
              <Text style={[styles.battleCtaText, { color: battleFrom }]}>Chiến đấu</Text>
              <MaterialCommunityIcons color={battleFrom} name="chevron-right" size={15} />
            </View>
          </View>
        </Pressable>

        <SectionHeader colors={colors} meta={`${badges.length} đã nhận`} title="Huy hiệu" />

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

function SectionHeader({ colors, meta, title }: { colors: typeof Colors.light; meta: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>{meta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 32 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: '#17263B', fontSize: 27, fontWeight: '900', letterSpacing: -0.4 },
  headerBadge: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, marginBottom: 14, borderRadius: 14, backgroundColor: PALETTE.coral.deep },
  errorText: { flex: 1, color: PALETTE.coral.bright, fontSize: 12, fontWeight: '600' },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },

  heroCard: { padding: 18, borderRadius: CARD_RADIUS, overflow: 'hidden' },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heroIdentity: { flex: 1, minWidth: 0, gap: 7 },
  heroLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  currentUserName: { color: '#FFFFFF', fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  heroXpChip: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroXpText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' },
  heroRank: { alignItems: 'flex-end', gap: 2 },
  heroRankValue: { color: '#FFFFFF', fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  heroRankCaption: { color: 'rgba(255,255,255,0.78)', fontSize: 10.5, fontWeight: '600' },
  heroTrack: { height: 6, marginTop: 16, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.26)', overflow: 'hidden' },
  heroFill: { height: '100%', borderRadius: 3, backgroundColor: '#FFFFFF' },
  heroHint: { color: 'rgba(255,255,255,0.88)', fontSize: 11.5, fontWeight: '600', marginTop: 9 },

  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  sectionTitle: { color: '#203447', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  sectionMeta: { color: '#738290', fontSize: 12, fontWeight: '500' },

  loadingState: { paddingVertical: 34, alignItems: 'center', justifyContent: 'center' },

  leaderboardViewport: { flexShrink: 0 },
  leaderboardFrame: { flex: 1, borderRadius: CARD_RADIUS, borderWidth: 1, overflow: 'hidden' },
  leaderboardScroll: { padding: LEADERBOARD_FRAME_PADDING, gap: LEADERBOARD_ROW_GAP },
  rankingCard: {
    minHeight: LEADERBOARD_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rankingCardSelf: { borderWidth: 2 },
  rowStripe: { position: 'absolute', top: 0, bottom: 0, left: 0, width: ROW_STRIPE_WIDTH },
  rankCell: { width: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  rankNumber: { width: 13, textAlign: 'right', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  laurelWrap: { width: 21, height: 19, alignItems: 'center', justifyContent: 'center' },
  laurelNumber: { fontSize: 9.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  avatar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, borderWidth: 1 },
  avatarText: { fontSize: 13, fontWeight: '700' },
  rankingIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  rankingName: { flexShrink: 1, fontSize: 14.5, fontWeight: '600', letterSpacing: -0.1 },
  youLabel: { color: PALETTE.cyan.strong, fontSize: 10.5, fontWeight: '800' },
  rowXp: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rowXpUnit: { fontSize: 10.5, fontWeight: '600', marginLeft: 4 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderRadius: CARD_RADIUS },
  emptyText: { fontSize: 13, fontWeight: '500' },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },
  badgeTile: { flexGrow: 1, flexBasis: '47%', gap: 5, padding: 13, borderRadius: 16, borderWidth: 1 },
  badgeIconWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginBottom: 3 },
  badgeName: { fontSize: 12.5, fontWeight: '900' },
  badgeDescription: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  noBadges: { fontSize: 12, paddingVertical: 5, fontWeight: '600' },

  battleCard: { padding: 14, borderRadius: CARD_RADIUS, overflow: 'hidden' },
  battleCardPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  battleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  battleIconWrap: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  battleCopy: { flex: 1, minWidth: 0, gap: 3 },
  battleKicker: { color: 'rgba(255,255,255,0.75)', fontSize: 9.5, fontWeight: '800', letterSpacing: 1.3 },
  battleTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  battleDescription: { color: 'rgba(255,255,255,0.82)', fontSize: 11.5, fontWeight: '600' },
  battleCta: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: '#FFFFFF' },
  battleCtaText: { fontSize: 12.5, fontWeight: '900' },
});
