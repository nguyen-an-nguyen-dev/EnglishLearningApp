import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/auth-context';
import { EarnedBadge, fetchMyBadges, fetchRanking, RankingData, RankingEntry } from '@/services/ranking';

const BADGE_ICONS: Record<string, string> = {
  first_lesson: '🎓',
  lessons_10: '🏅',
  xp_100: '💯',
  xp_500: '🏆',
};

export default function RankingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [ranking, setRanking] = useState<RankingData | null>(null);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      void loadRanking();
    }, [loadRanking]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadRanking();
  }, [loadRanking]);

  const currentUserEntry = ranking?.leaderboard.find((entry) => entry.userId === user?.id);
  const currentUserRank = ranking?.current_user_rank;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryDark} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ENGLISH LEARNING</Text>
            <Text style={styles.title}>Ranking</Text>
          </View>
          <Text style={styles.headerIcon}>🏆</Text>
        </View>

        {errorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable onPress={onRefresh} accessibilityRole="button">
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.currentUserPanel}>
          <View>
            <Text style={styles.currentUserLabel}>VỊ TRÍ CỦA BẠN</Text>
            <Text style={styles.currentUserName}>{currentUserEntry?.name ?? user?.name ?? 'Học viên'}</Text>
          </View>
          <View style={styles.currentUserStats}>
            <Text style={styles.currentUserRank}>{currentUserRank ? `#${currentUserRank}` : '—'}</Text>
            <Text style={styles.currentUserXp}>{currentUserEntry?.xp ?? user?.xp ?? 0} XP</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bảng xếp hạng</Text>
          <Text style={styles.sectionMeta}>{ranking?.leaderboard.length ?? 0} học viên</Text>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.primaryDark} />
          </View>
        ) : ranking?.leaderboard.length ? (
          <View style={styles.leaderboard}>
            {ranking.leaderboard.map((entry: RankingEntry) => {
              const isCurrentUser = entry.userId === user?.id;
              const initials = entry.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
              return (
                <View key={entry.userId} style={[styles.rankingRow, isCurrentUser && styles.currentRankingRow]}>
                  <Text style={[styles.rankNumber, entry.rank <= 3 && styles.topRank]}>{entry.rank}</Text>
                  <View style={[styles.avatar, entry.rank === 1 && styles.firstAvatar]}>
                    <Text style={styles.avatarText}>{entry.avatar || initials || '?'}</Text>
                  </View>
                  <View style={styles.rankingIdentity}>
                    <Text numberOfLines={1} style={[styles.rankingName, isCurrentUser && styles.currentRankingName]}>
                      {entry.name}{isCurrentUser ? ' · Bạn' : ''}
                    </Text>
                    <Text style={styles.rankingXp}>{entry.xp.toLocaleString()} XP</Text>
                  </View>
                  {entry.rank <= 3 && <Text style={styles.medal}>{['🥇', '🥈', '🥉'][entry.rank - 1]}</Text>}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Chưa có dữ liệu xếp hạng.</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Huy hiệu</Text>
          <Text style={styles.sectionMeta}>{badges.length} đã nhận</Text>
        </View>
        {badges.length ? (
          <View style={styles.badgeList}>
            {badges.map((badge) => (
              <View key={badge.code} style={styles.badgeRow}>
                <View style={styles.badgeIconWrap}>
                  <Text style={styles.badgeIcon}>{BADGE_ICONS[badge.code] ?? '🏅'}</Text>
                </View>
                <View style={styles.badgeCopy}>
                  <Text style={styles.badgeName}>{badge.name}</Text>
                  <Text style={styles.badgeDescription}>{badge.description}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noBadges}>Hoàn thành bài học để nhận huy hiệu.</Text>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/battle')}
          style={styles.battleEntry}
        >
          <View style={styles.battleIconWrap}><Text style={styles.battleIcon}>⚔️</Text></View>
          <View style={styles.battleCopy}>
            <Text style={styles.battleTitle}>Word Battle</Text>
            <Text style={styles.battleDescription}>Vào khu vực đối kháng</Text>
          </View>
          <Text style={styles.battleArrow}>›</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  eyebrow: { color: Colors.primaryDark, fontSize: 10, fontWeight: '900' },
  title: { color: '#17263b', fontSize: 26, fontWeight: '900', marginTop: 3 },
  headerIcon: { fontSize: 28 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 12, borderRadius: 8, backgroundColor: '#fff0f0' },
  errorText: { flex: 1, color: '#a52e3c', fontSize: 12 },
  retryText: { color: Colors.primaryDark, fontWeight: '800' },
  currentUserPanel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 18, borderRadius: 12, backgroundColor: Colors.primaryDark },
  currentUserLabel: { color: '#d8f8ff', fontSize: 10, fontWeight: '900' },
  currentUserName: { color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 5, maxWidth: 190 },
  currentUserStats: { alignItems: 'flex-end' },
  currentUserRank: { color: '#fff', fontSize: 26, fontWeight: '900' },
  currentUserXp: { color: '#dcfaff', fontSize: 12, fontWeight: '800', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 23, marginBottom: 10 },
  sectionTitle: { color: '#203447', fontSize: 16, fontWeight: '900' },
  sectionMeta: { color: '#738290', fontSize: 11, fontWeight: '700' },
  loadingState: { minHeight: 100, alignItems: 'center', justifyContent: 'center' },
  leaderboard: { gap: 7 },
  rankingRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#e4ebef', borderRadius: 9, backgroundColor: '#fff' },
  currentRankingRow: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  rankNumber: { width: 24, color: '#637482', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  topRank: { color: Colors.primaryDark },
  avatar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: '#e5f5f8' },
  firstAvatar: { backgroundColor: '#d7f4fa' },
  avatarText: { color: Colors.primaryDark, fontSize: 13, fontWeight: '900' },
  rankingIdentity: { flex: 1, minWidth: 0 },
  rankingName: { color: '#263b4c', fontSize: 13, fontWeight: '800' },
  currentRankingName: { color: '#007b98' },
  rankingXp: { color: '#788792', fontSize: 11, marginTop: 3 },
  medal: { fontSize: 19 },
  emptyState: { paddingVertical: 28, alignItems: 'center', borderWidth: 1, borderColor: '#e4ebef', borderRadius: 9, backgroundColor: '#fff' },
  emptyText: { color: '#75838e', fontSize: 13 },
  badgeList: { gap: 7 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 10, borderWidth: 1, borderColor: '#e4ebef', borderRadius: 9, backgroundColor: '#fff' },
  badgeIconWrap: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: '#e6f9ff' },
  badgeIcon: { fontSize: 19 },
  badgeCopy: { flex: 1, minWidth: 0 },
  badgeName: { color: '#263b4c', fontSize: 13, fontWeight: '800' },
  badgeDescription: { color: '#788792', fontSize: 11, marginTop: 3 },
  noBadges: { color: '#75838e', fontSize: 12, paddingVertical: 5 },
  battleEntry: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22, padding: 12, borderRadius: 10, backgroundColor: '#173d56' },
  battleIconWrap: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)' },
  battleIcon: { color: '#fff', fontSize: 19 },
  battleCopy: { flex: 1 },
  battleTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  battleDescription: { color: '#c4e3eb', fontSize: 11, marginTop: 3 },
  battleArrow: { color: '#fff', fontSize: 25, fontWeight: '400' },
});