import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Alert,
  Easing,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/auth-context';
import { fetchUserProgress, Lesson, StageWithLessons, UserProgress } from '@/services/learning';

const STAGE_ROW_HEIGHT = 190;
const CAR_SIZE = 46;

export default function LearningPathScreen() {
  const { user, logout, getCurrentUser } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const carPosition = useRef(new Animated.Value(0)).current;
  const hasPositionedCar = useRef(false);

  const [progressData, setProgressData] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setErrorMsg(null);
      const [prog] = await Promise.all([
        fetchUserProgress(),
        getCurrentUser().catch(() => null),
      ]);
      setProgressData(prog);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải lộ trình học.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getCurrentUser]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  function handleLessonClick(lesson: Lesson) {
    const status = lesson.state.status;
    const isLocked = status === 'locked';

    if (isLocked) {
      Alert.alert(
        'Bài học bị khóa',
        'Hoàn thành bài học trước đó để mở khóa bài học này.',
        [{ text: 'Đã hiểu', style: 'default' }],
      );
      return;
    }

    router.push({
      pathname: '/lesson/[id]',
      params: { id: String(lesson.id) },
    });
  }

  function handleStageClick(stage: StageWithLessons, isLocked: boolean) {
    if (isLocked) {
      Alert.alert('Stage đang khóa', 'Hoàn thành stage trước để mở chặng đường tiếp theo.');
      return;
    }

    const nextLesson = stage.lessons.find((lesson) => lesson.state.status === 'unlocked' || lesson.state.status === 'available')
      ?? stage.lessons.find((lesson) => lesson.state.status !== 'completed')
      ?? stage.lessons[0];

    if (nextLesson) handleLessonClick(nextLesson);
  }

  const allLessons = progressData?.stages.flatMap((s) => s.lessons) ?? [];
  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((l) => l.state.status === 'completed').length;
  const overallPercentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const stageProgress = (progressData?.stages ?? []).map((stage) => {
    const completedLessons = stage.lessons.filter((lesson) => lesson.state.status === 'completed').length;
    const totalLessonsInStage = stage.lessons.length;
    return {
      stage,
      completedLessons,
      totalLessons: totalLessonsInStage,
      isCompleted: totalLessonsInStage > 0 && completedLessons === totalLessonsInStage,
    };
  });
  const activeStageIndex = stageProgress.findIndex((item) => item.totalLessons > 0 && !item.isCompleted);
  const currentStage = activeStageIndex >= 0 ? stageProgress[activeStageIndex] : null;
  const currentLesson = currentStage?.stage.lessons.find(
    (lesson) => lesson.state.status === 'unlocked' || lesson.state.status === 'available',
  );
  const routeWidth = Math.max(width - 36, 280);
  const stageIndices = stageProgress.map((_, index) => index);
  const carLeftPositions = stageProgress.map((_, index) =>
    routeWidth * (index % 2 === 0 ? 0.22 : 0.78) - CAR_SIZE / 2,
  );

  useEffect(() => {
    if (activeStageIndex < 0) return;
    if (!hasPositionedCar.current) {
      carPosition.setValue(activeStageIndex);
      hasPositionedCar.current = true;
      return;
    }
    Animated.timing(carPosition, {
      toValue: activeStageIndex,
      duration: 4000,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [activeStageIndex, carPosition]);

  const carLeft = stageIndices.length > 1
    ? carPosition.interpolate({ inputRange: stageIndices, outputRange: carLeftPositions, extrapolate: 'clamp' })
    : carLeftPositions[0] ?? 0;
  const carTop = stageIndices.length > 1
    ? carPosition.interpolate({
        inputRange: stageIndices,
        outputRange: stageIndices.map((index) => index * STAGE_ROW_HEIGHT + 29),
        extrapolate: 'clamp',
      })
    : 29;

  return (
    <SafeAreaView style={styles.journeySafeArea}>
      <ScrollView
        contentContainerStyle={styles.journeyScroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#f2b544"
            colors={['#f2b544']}
          />
        }
      >
        <View style={styles.journeyHeader}>
          <View style={styles.brandGroup}>
            <Text style={styles.brandCar}>🚘</Text>
            <Text style={styles.brandTitle}>DriveEnglish</Text>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.xpChip}>
              <Text style={styles.xpChipText}>💎 {user?.xp ?? progressData?.total_xp ?? 0}</Text>
            </View>
            <Pressable onPress={() => void logout()} style={styles.avatarButton} accessibilityLabel="Đăng xuất">
              <Text style={styles.avatarText}>{user?.email?.[0]?.toUpperCase() ?? '☺'}</Text>
            </Pressable>
          </View>
        </View>

        {errorMsg && (
          <View style={styles.journeyError}>
            <Text style={styles.journeyErrorText}>⚠️ {errorMsg}</Text>
            <Pressable onPress={onRefresh} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </Pressable>
          </View>
        )}

        {loading && !refreshing && (
          <View style={styles.journeyLoading}>
            <ActivityIndicator size="large" color="#f2b544" />
            <Text style={styles.journeyLoadingText}>Đang mở bản đồ hành trình...</Text>
          </View>
        )}

        {!loading && progressData && (
          <View style={styles.stageMap}>
            {stageProgress.map(({ stage, completedLessons: stageCompleted, totalLessons: stageTotal, isCompleted }, stageIndex) => {
              const isCurrent = stageIndex === activeStageIndex;
              const isLocked = activeStageIndex >= 0 && stageIndex > activeStageIndex;
              const markerOnLeft = stageIndex % 2 === 0;
              const percentage = stageTotal > 0 ? Math.round((stageCompleted / stageTotal) * 100) : 0;

              return (
                <View key={stage.id} style={styles.stageMapRow}>
                  {stageIndex < stageProgress.length - 1 && (
                    <View style={[styles.roadSegment, markerOnLeft ? styles.roadSlopeRight : styles.roadSlopeLeft]} />
                  )}
                  <View style={[
                    styles.stageMarker,
                    markerOnLeft ? styles.stageMarkerLeft : styles.stageMarkerRight,
                    isCompleted && styles.stageMarkerCompleted,
                    isCurrent && styles.stageMarkerCurrent,
                    isLocked && styles.stageMarkerLocked,
                  ]}>
                    <Text style={styles.stageMarkerText}>{isCompleted ? '✓' : isLocked ? '🔒' : String(stageIndex + 1)}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleStageClick(stage, isLocked)}
                    accessibilityRole="button"
                    accessibilityLabel={`${stage.title}, ${stageCompleted} trên ${stageTotal} bài hoàn thành`}
                    style={[
                      styles.stageInfo,
                      markerOnLeft ? styles.stageInfoRight : styles.stageInfoLeft,
                      isCompleted && styles.stageInfoCompleted,
                      isCurrent && styles.stageInfoCurrent,
                      isLocked && styles.stageInfoLocked,
                    ]}
                  >
                    <Text style={styles.stageEyebrow}>STAGE {String(stageIndex + 1).padStart(2, '0')}</Text>
                    <Text numberOfLines={1} style={styles.stageName}>{stage.title}</Text>
                    <Text numberOfLines={1} style={styles.stageDescription}>{stage.description || 'Chặng học tiếng Anh'}</Text>
                    <View style={styles.stageProgressRow}>
                      <View style={styles.stageProgressTrack}>
                        <View style={[styles.stageProgressFill, { width: `${percentage}%` }, isCompleted && styles.stageProgressFillDone]} />
                      </View>
                      <Text style={styles.stageProgressText}>{stageCompleted}/{stageTotal}</Text>
                    </View>
                    {isCurrent && <Text style={styles.currentStageHint}>ĐANG HỌC</Text>}
                    {isCompleted && <Text style={styles.replayStageHint}>↻ ÔN TẬP</Text>}
                  </Pressable>
                </View>
              );
            })}
            {activeStageIndex >= 0 && (
              <Animated.View
                pointerEvents="none"
                style={[styles.movingCar, { left: carLeft, top: carTop }]}
              >
                <Text style={styles.movingCarText}>🚙</Text>
              </Animated.View>
            )}
          </View>
        )}
      </ScrollView>
      {!loading && currentStage && (
        <View style={styles.bottomDock}>
          <View style={styles.dockInfo}>
            <Text style={styles.dockEyebrow}>ĐANG HỌC · STAGE {activeStageIndex + 1}</Text>
            <Text numberOfLines={1} style={styles.dockTitle}>{currentStage.stage.title}</Text>
            <Text style={styles.dockProgress}>{currentStage.completedLessons}/{currentStage.totalLessons} bài đã xong</Text>
          </View>
          <Pressable
            disabled={!currentLesson}
            onPress={() => currentLesson && handleLessonClick(currentLesson)}
            style={[styles.dockButton, !currentLesson && styles.dockButtonDisabled]}
          >
            <Text style={styles.dockButtonText}>▶ Học</Text>
          </Pressable>
        </View>
      )}
      {!loading && progressData && !currentStage && totalLessons > 0 && (
        <View style={styles.completedDock}>
          <Text style={styles.completedDockText}>🏁 Bạn đã hoàn thành tất cả stage!</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#dfeefb',
  },
  scrollContainer: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1f9dff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 4,
  },
  iconButtonText: {
    fontSize: 26,
    color: '#fff',
  },
  userPanel: {
    backgroundColor: '#dfeefa',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  sectionLabel: {
    color: '#1ea7ff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  userText: {
    flex: 1,
    fontSize: 30,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 38,
  },
  logoutBtn: {
    backgroundColor: '#edf2f7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logoutBtnText: {
    color: '#1f2a37',
    fontWeight: '700',
    fontSize: 14,
  },
  statsCard: {
    backgroundColor: '#3cb7ff',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    marginBottom: 18,
    shadowColor: '#2BB3FF',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 30,
  },
  statLabel: {
    fontSize: 12,
    color: '#eafaff',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  progressText: {
    color: '#effcff',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#ffe7e7',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
  },
  retryBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  pathContainer: {
    marginTop: 8,
    paddingBottom: 20,
  },
  stageBlock: {
    marginBottom: 16,
  },
  stageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  stageNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#33b2ff',
    color: '#fff',
    textAlign: 'center',
    fontWeight: '800',
    lineHeight: 30,
  },
  stageTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  pathColumn: {
    marginLeft: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#8bd2ff',
    paddingLeft: 16,
    gap: 10,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nodeArea: {
    width: 42,
    alignItems: 'center',
  },
  node: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  nodeCompleted: {
    backgroundColor: '#22c55e',
  },
  nodeUnlocked: {
    backgroundColor: '#2cb7ff',
  },
  nodeLocked: {
    backgroundColor: '#8da1b8',
    opacity: 0.8,
  },
  nodeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 17,
  },
  verticalLine: {
    width: 2,
    height: 22,
    backgroundColor: '#8bd2ff',
    marginTop: 4,
  },
  lessonCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#dfeaf5',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
  },
  lessonCardCompleted: {
    backgroundColor: '#ecfdf5',
    borderColor: '#8ef0ad',
  },
  lessonCardUnlocked: {
    backgroundColor: '#edfaff',
    borderColor: '#69c8ff',
  },
  lessonCardLocked: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    opacity: 0.8,
  },
  lessonTopic: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  lessonTitleText: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  lessonTitleLocked: {
    color: '#94a3b8',
  },
  lessonMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  lessonXp: {
    marginTop: 6,
    color: '#f59e0b',
    fontWeight: '800',
    fontSize: 12,
  },
  ctaBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: '#1aa7ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  journeySafeArea: {
    flex: 1,
    backgroundColor: '#17142f',
  },
  journeyScroll: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 30,
  },
  journeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandCar: {
    fontSize: 22,
  },
  brandTitle: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '900',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  xpChip: {
    borderWidth: 1,
    borderColor: '#4d5e92',
    borderRadius: 18,
    backgroundColor: '#242748',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  xpChipText: {
    color: '#90c7ff',
    fontSize: 13,
    fontWeight: '800',
  },
  avatarButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f28b45',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  journeyError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#4a2539',
  },
  journeyErrorText: {
    flex: 1,
    color: '#ffd5dd',
    fontSize: 13,
    fontWeight: '600',
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#be5363',
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  journeyLoading: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyLoadingText: {
    marginTop: 12,
    color: '#d4cee9',
    fontSize: 14,
    fontWeight: '600',
  },
  stageMap: {
    position: 'relative',
    paddingBottom: 14,
  },
  stageMapRow: {
    height: STAGE_ROW_HEIGHT,
    position: 'relative',
    overflow: 'visible',
  },
  roadSegment: {
    position: 'absolute',
    left: '9%',
    top: 138,
    width: '82%',
    height: 18,
    borderRadius: 9,
    backgroundColor: '#77738e',
    borderWidth: 1,
    borderColor: '#a09cb4',
    zIndex: 0,
  },
  roadSlopeRight: {
    transform: [{ rotate: '43deg' }],
  },
  roadSlopeLeft: {
    transform: [{ rotate: '-43deg' }],
  },
  stageMarker: {
    position: 'absolute',
    top: 20,
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#5f5b79',
    backgroundColor: '#34304f',
    zIndex: 2,
  },
  stageMarkerLeft: {
    left: '13%',
  },
  stageMarkerRight: {
    left: '69%',
  },
  stageMarkerCompleted: {
    backgroundColor: '#20b878',
    borderColor: '#53e0a0',
  },
  stageMarkerCurrent: {
    backgroundColor: '#ef8b28',
    borderColor: '#ffb245',
  },
  stageMarkerLocked: {
    backgroundColor: '#252243',
    borderColor: '#343052',
  },
  stageMarkerText: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '900',
  },
  stageInfo: {
    position: 'absolute',
    top: 21,
    width: '58%',
    minHeight: 104,
    padding: 11,
    borderWidth: 1,
    borderColor: '#484363',
    borderRadius: 12,
    backgroundColor: '#35314f',
    zIndex: 1,
  },
  stageInfoRight: {
    left: '38%',
  },
  stageInfoLeft: {
    left: '4%',
  },
  stageInfoCompleted: {
    borderColor: '#347b68',
    backgroundColor: '#2e3b53',
  },
  stageInfoCurrent: {
    borderColor: '#a96a44',
    backgroundColor: '#40344f',
  },
  stageInfoLocked: {
    opacity: 0.55,
  },
  stageEyebrow: {
    color: '#a49dbd',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 3,
  },
  stageName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  stageDescription: {
    color: '#c1bad6',
    fontSize: 10,
    marginTop: 2,
  },
  stageProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 9,
  },
  stageProgressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#5b5675',
    overflow: 'hidden',
  },
  stageProgressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#f09a48',
  },
  stageProgressFillDone: {
    backgroundColor: '#35d293',
  },
  stageProgressText: {
    color: '#d0c9df',
    fontSize: 10,
    fontWeight: '800',
  },
  currentStageHint: {
    position: 'absolute',
    right: 10,
    top: 9,
    color: '#ffc15f',
    fontSize: 8,
    fontWeight: '900',
  },
  replayStageHint: {
    position: 'absolute',
    right: 10,
    top: 9,
    color: '#7ce2b0',
    fontSize: 8,
    fontWeight: '900',
  },
  movingCar: {
    position: 'absolute',
    width: CAR_SIZE,
    height: CAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  movingCarText: {
    fontSize: 34,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 4,
  },
  bottomDock: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#413b5f',
    backgroundColor: '#211d3b',
  },
  dockInfo: {
    flex: 1,
    minWidth: 0,
  },
  dockEyebrow: {
    color: '#aaa2c4',
    fontSize: 9,
    fontWeight: '900',
  },
  dockTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  dockProgress: {
    color: '#c2bad7',
    fontSize: 10,
    marginTop: 2,
  },
  dockButton: {
    minWidth: 88,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderRadius: 14,
    backgroundColor: '#f2a12f',
  },
  dockButtonDisabled: {
    opacity: 0.5,
  },
  dockButtonText: {
    color: '#24172a',
    fontSize: 14,
    fontWeight: '900',
  },
  completedDock: {
    paddingHorizontal: 18,
    paddingVertical: 22,
    borderTopWidth: 1,
    borderTopColor: '#413b5f',
    backgroundColor: '#211d3b',
  },
  completedDockText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '800',
  },
});
