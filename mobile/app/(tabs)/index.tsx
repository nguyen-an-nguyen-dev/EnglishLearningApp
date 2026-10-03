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
import { SymbolView } from 'expo-symbols';
import Svg, { Circle, Path } from 'react-native-svg';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/auth-context';
import { fetchUserProgress, type Lesson, type StageWithLessons, type UserProgress } from '@/services/learning';

const STAGE_HEADER_HEIGHT = 146;
const STAGE_GAP = 22;
const CAR_SIZE = 46;
const STAGE_RING_SIZE = 88;
const STAGE_RING_STROKE = 4;
const STAGE_RING_RADIUS = (STAGE_RING_SIZE - STAGE_RING_STROKE) / 2;
const STAGE_NODE_TOP = 10;
const STAGE_ICONS = [
  { ios: 'graduationcap.fill', android: 'school', web: 'school' },
  { ios: 'map.fill', android: 'explore', web: 'explore' },
  { ios: 'bolt.fill', android: 'rocket_launch', web: 'rocket_launch' },
  { ios: 'briefcase.fill', android: 'work', web: 'work' },
  { ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' },
] as const;

export default function LearningPathScreen() {
  const { user, logout, getCurrentUser } = useAuth();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const carPosition = useRef(new Animated.Value(0)).current;
  const hasPositionedCar = useRef(false);
  const lastCarTarget = useRef<number | null>(null);
  const pathScrollRef = useRef<ScrollView>(null);
  const pathOffset = useRef(0);
  const scrollOffset = useRef(0);

  const [progressData, setProgressData] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);

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

  function handleStageClick(stage: StageWithLessons) {
    setSelectedStageId(stage.id);
  }

  const allLessons = progressData?.stages.flatMap((s) => s.lessons) ?? [];
  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((l) => l.state.status === 'completed').length;
  const activeLessonIndex = allLessons.findIndex((lesson) => lesson.state.status !== 'completed');
  const currentLessonIndex = activeLessonIndex >= 0 ? activeLessonIndex : allLessons.length - 1;
  const currentLesson = allLessons[currentLessonIndex];
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
  const selectedStage = progressData?.stages.find((stage) => stage.id === selectedStageId) ?? null;
  const selectedLesson = selectedStage?.lessons.find((lesson) => lesson.state.status !== 'completed')
    ?? selectedStage?.lessons[0]
    ?? null;
  const selectedLessonIndex = selectedStage && selectedLesson
    ? selectedStage.lessons.findIndex((lesson) => lesson.id === selectedLesson.id)
    : -1;
  const selectedLessonLocked = selectedLesson?.state.status === 'locked';
  const currentStageIndex = currentLesson
    ? stageProgress.findIndex((item) => item.stage.lessons.some((lesson) => lesson.id === currentLesson.id))
    : -1;
  const currentStage = currentStageIndex >= 0 ? stageProgress[currentStageIndex] : null;
  const routeWidth = width - 36;
  const stageStops: number[] = [];
  let mapHeight = 0;
  stageProgress.forEach((_, stageIndex) => {
    stageStops.push(mapHeight + STAGE_NODE_TOP + (STAGE_RING_SIZE - CAR_SIZE) / 2);
    mapHeight += STAGE_HEADER_HEIGHT;
    if (stageIndex < stageProgress.length - 1) mapHeight += STAGE_GAP;
  });
  const stageIndices = stageProgress.map((_, index) => index);

  useEffect(() => {
    if (currentStageIndex < 0) return;
    if (!hasPositionedCar.current) {
      carPosition.setValue(currentStageIndex);
      hasPositionedCar.current = true;
      lastCarTarget.current = currentStageIndex;
      return;
    }

    const previousTarget = lastCarTarget.current ?? currentStageIndex;
    const distance = Math.abs(currentStageIndex - previousTarget);
    if (distance === 0) return;

    const targetTop = stageStops[currentStageIndex] ?? 0;
    Animated.timing(carPosition, {
      toValue: currentStageIndex,
      duration: Math.min(8000, distance * 2200),
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      const destinationY = pathOffset.current + targetTop;
      const destinationScreenY = destinationY - scrollOffset.current;
      if (destinationScreenY < 110 || destinationScreenY > height - 210) {
        pathScrollRef.current?.scrollTo({
          y: Math.max(0, destinationY - height * 0.38),
          animated: true,
        });
      }
    });
    lastCarTarget.current = currentStageIndex;
  }, [currentStageIndex, carPosition, height, stageStops]);

  const carTop = stageIndices.length > 1
    ? carPosition.interpolate({ inputRange: stageIndices, outputRange: stageStops, extrapolate: 'clamp' })
    : stageStops[0] ?? 0;
  const carLeft = routeWidth / 2 - CAR_SIZE / 2;
  const currentStageLessonIndex = currentStage && currentLesson
    ? currentStage.stage.lessons.findIndex((lesson) => lesson.id === currentLesson.id)
    : -1;
  const stagePercentage = currentStage && currentStage.totalLessons > 0
    ? Math.round((currentStage.completedLessons / currentStage.totalLessons) * 100)
    : 0;

  function handleStartSelectedLesson() {
    if (!selectedLesson || selectedLessonLocked) return;
    setSelectedStageId(null);
    handleLessonClick(selectedLesson);
  }

  return (
    <SafeAreaView style={styles.journeySafeArea}>
      <View style={styles.fixedTop} onTouchStart={() => setSelectedStageId(null)}>
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

        {!loading && progressData && currentStage && currentLesson && (
          <View style={styles.lessonOverview}>
            <View style={styles.overviewTopRow}>
              <Text style={styles.overviewStageLabel}>STAGE {currentStageIndex + 1}</Text>
              <Text style={styles.overviewCount}>
                BÀI {currentStageLessonIndex + 1} / {currentStage.totalLessons}
              </Text>
            </View>
            <Text numberOfLines={2} style={styles.overviewTitle}>{currentStage.stage.title}</Text>
            <Text numberOfLines={1} style={styles.overviewSubtitle}>
              {activeLessonIndex < 0 ? 'Đã hoàn thành lộ trình' : `Đang học: ${currentLesson.title} (${currentLesson.topic})`}
            </Text>
            <View style={styles.overviewProgressTrack}>
              <View style={[styles.overviewProgressFill, { width: `${stagePercentage}%` }]} />
            </View>
          </View>
        )}

      </View>
      {!loading && progressData && (
        <ScrollView
          ref={pathScrollRef}
          style={styles.roadScroll}
          onStartShouldSetResponderCapture={() => {
            setSelectedStageId(null);
            return false;
          }}
          onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
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
        {!loading && progressData && (
          <View
            style={[styles.stageMap, { minHeight: mapHeight }]}
            onLayout={(event) => { pathOffset.current = event.nativeEvent.layout.y; }}
          >
            <View style={[styles.centerRoad, styles.nonInteractive]} />
            <View style={[styles.centerRoadLine, styles.nonInteractive]} />
            {stageProgress.map(({ stage, completedLessons, totalLessons: stageTotal, isCompleted }, stageIndex) => {
              const markerOnLeft = stageIndex % 2 === 0;
              const percentage = stageTotal > 0 ? Math.round((completedLessons / stageTotal) * 100) : 0;
              const ringCenter = STAGE_RING_SIZE / 2;
              const progressEndAngle = (percentage / 100) * Math.PI * 2 - Math.PI / 2;
              const progressEndX = ringCenter + STAGE_RING_RADIUS * Math.cos(progressEndAngle);
              const progressEndY = ringCenter + STAGE_RING_RADIUS * Math.sin(progressEndAngle);
              const progressArcPath = `M ${ringCenter} ${ringCenter - STAGE_RING_RADIUS} A ${STAGE_RING_RADIUS} ${STAGE_RING_RADIUS} 0 ${percentage > 50 ? 1 : 0} 1 ${progressEndX} ${progressEndY}`;
              const isStageLocked = stage.lessons.length > 0
                && stage.lessons.every((lesson) => lesson.state.status === 'locked');
              const isCurrentStage = stageIndex === currentStageIndex && activeLessonIndex >= 0;

              return (
                <View
                  key={stage.id}
                  style={[styles.stageSection, stageIndex < stageProgress.length - 1 && styles.stageSectionSpaced]}
                >
                  <Pressable
                    onPress={() => setSelectedStageId(null)}
                    style={styles.stageWaypoint}
                  >
                    <View
                      style={[styles.stageConnector, markerOnLeft ? styles.connectorLeft : styles.connectorRight, styles.nonInteractive]}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Stage ${stageIndex + 1}, ${stage.title}, ${completedLessons} trên ${stageTotal} bài đã hoàn thành. Nhấn để tiếp tục.`}
                      onPress={(event) => {
                        event.stopPropagation();
                        handleStageClick(stage);
                      }}
                      style={[
                        styles.stageMarker,
                        markerOnLeft ? styles.stageMarkerLeft : styles.stageMarkerRight,
                        isCompleted && styles.stageMarkerCompleted,
                        isCurrentStage && styles.stageMarkerCurrent,
                        isStageLocked && styles.stageMarkerLocked,
                      ]}
                    >
                      <View style={styles.stageRing}>
                        <Svg width={STAGE_RING_SIZE} height={STAGE_RING_SIZE} style={styles.stageRingSvg}>
                          <Circle
                            cx={STAGE_RING_SIZE / 2}
                            cy={STAGE_RING_SIZE / 2}
                            r={STAGE_RING_RADIUS}
                            fill="none"
                            stroke="#d8e3e9"
                            strokeWidth={STAGE_RING_STROKE}
                          />
                          {percentage >= 100 ? (
                            <Circle
                              cx={ringCenter}
                              cy={ringCenter}
                              r={STAGE_RING_RADIUS}
                              fill="none"
                              stroke={Colors.primaryDark}
                              strokeWidth={STAGE_RING_STROKE}
                            />
                          ) : percentage > 0 ? (
                            <Path
                              d={progressArcPath}
                              fill="none"
                              stroke={Colors.primaryDark}
                              strokeWidth={STAGE_RING_STROKE}
                              strokeLinecap="round"
                            />
                          ) : null}
                        </Svg>
                        <View style={styles.stageRingCenter}>
                          <SymbolView
                            name={STAGE_ICONS[stageIndex % STAGE_ICONS.length]}
                            tintColor="#fff"
                            size={28}
                          />
                        </View>
                      </View>
                    </Pressable>
                    <View
                      style={[
                        styles.stageInfo,
                        markerOnLeft ? styles.stageInfoLeft : styles.stageInfoRight,
                        isCompleted && styles.stageInfoCompleted,
                        isCurrentStage && styles.stageInfoCurrent,
                        isStageLocked && styles.stageInfoLocked,
                      ]}
                    >
                      <Text numberOfLines={2} style={styles.stageName}>
                        {stageIndex + 1}. {stage.title}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              );
            })}
            {currentStageIndex >= 0 && (
              <Animated.View
                style={[styles.movingCar, { left: carLeft, top: carTop }, styles.nonInteractive]}
              >
                <Text style={styles.movingCarText}>🚘</Text>
              </Animated.View>
            )}
          </View>
        )}
        </ScrollView>
      )}
      {selectedStage && (
        <Pressable
          onPress={() => setSelectedStageId(null)}
          style={styles.stageLessonPanel}
        >
          <Text numberOfLines={2} style={styles.stageLessonTitle}>
            {selectedLesson?.title ?? 'Chưa có bài học'}
          </Text>
          <Text style={styles.stageLessonCount}>
            {selectedLesson
              ? `Bài học ${selectedLessonIndex + 1}/${selectedStage.lessons.length}`
              : 'Bài học 0/0'}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={!selectedLesson || selectedLessonLocked}
            onPress={(event) => {
              event.stopPropagation();
              handleStartSelectedLesson();
            }}
            style={[styles.stageLessonButton, (!selectedLesson || selectedLessonLocked) && styles.stageLessonButtonDisabled]}
          >
            <Text style={styles.stageLessonButtonText}>Bắt đầu</Text>
          </Pressable>
        </Pressable>
      )}
      {!selectedStage && !loading && progressData && totalLessons > 0 && activeLessonIndex < 0 && (
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
    backgroundColor: '#f7f8fc',
  },
  fixedTop: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  roadScroll: {
    flex: 1,
  },
  journeyScroll: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
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
    color: '#17263b',
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
    borderColor: '#d5e6ec',
    borderRadius: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  xpChipText: {
    color: '#078fa7',
    fontSize: 13,
    fontWeight: '800',
  },
  avatarButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#11b9cf',
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
    backgroundColor: '#fff0f0',
  },
  journeyErrorText: {
    flex: 1,
    color: '#a52e3c',
    fontSize: 13,
    fontWeight: '600',
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#c84352',
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
    color: '#5c6c7d',
    fontSize: 14,
    fontWeight: '600',
  },
  stageMap: {
    position: 'relative',
    paddingBottom: 14,
  },
  stageMarker: {
    position: 'absolute',
    top: STAGE_NODE_TOP,
    width: STAGE_RING_SIZE,
    height: STAGE_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stageMarkerLeft: {
    left: '8%',
  },
  stageMarkerRight: {
    right: '8%',
  },
  stageMarkerCompleted: {
    opacity: 0.9,
  },
  stageMarkerCurrent: {
    transform: [{ scale: 1.04 }],
  },
  stageMarkerLocked: {
    opacity: 0.48,
  },
  stageInfo: {
    position: 'absolute',
    top: STAGE_NODE_TOP + STAGE_RING_SIZE + 4,
    width: '48%',
    minHeight: 32,
    justifyContent: 'center',
  },
  stageInfoLeft: {
    left: '-2%',
    alignItems: 'center',
  },
  stageInfoRight: {
    right: '-2%',
    alignItems: 'center',
  },
  stageInfoCompleted: {
    opacity: 1,
  },
  stageInfoCurrent: {
    opacity: 1,
  },
  stageInfoLocked: {
    opacity: 0.55,
  },
  stageName: {
    color: '#33485a',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 14,
    textAlign: 'center',
  },
  stageLessonPanel: {
    gap: 5,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    borderRadius: 12,
    backgroundColor: Colors.primaryDark,
    elevation: 4,
  },
  stageLessonTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  stageLessonCount: {
    color: '#d9f7ff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 5,
  },
  stageLessonButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
    borderRadius: 9,
    backgroundColor: '#fff',
  },
  stageLessonButtonDisabled: {
    opacity: 0.58,
  },
  stageLessonButtonText: {
    color: Colors.primaryDark,
    fontSize: 15,
    fontWeight: '900',
  },
  movingCar: {
    position: 'absolute',
    width: CAR_SIZE,
    height: CAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: CAR_SIZE / 2,
    backgroundColor: '#08b9d1',
    zIndex: 5,
    elevation: 7,
  },
  movingCarText: {
    fontSize: 29,
    textShadowColor: 'rgba(0,0,0,0.22)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
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
    borderTopColor: '#dce5ec',
    backgroundColor: '#fff',
  },
  completedDockText: {
    color: '#146b55',
    textAlign: 'center',
    fontWeight: '800',
  },
  lessonOverview: {
    paddingTop: 2,
    paddingBottom: 16,
  },
  overviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  overviewStageLabel: {
    color: '#079ab1',
    fontSize: 13,
    fontWeight: '900',
  },
  overviewCount: {
    color: '#536170',
    fontSize: 13,
    fontWeight: '800',
  },
  overviewTitle: {
    color: '#17263b',
    fontSize: 22,
    fontWeight: '900',
  },
  overviewSubtitle: {
    color: '#697785',
    fontSize: 13,
    marginTop: 4,
  },
  overviewProgressTrack: {
    height: 6,
    marginTop: 12,
    borderRadius: 4,
    backgroundColor: '#e5edf2',
    overflow: 'hidden',
  },
  overviewProgressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#11b9cf',
  },
  centerRoad: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 78,
    marginLeft: -39,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#d7dfe8',
    borderRadius: 39,
    backgroundColor: '#e6ebf1',
  },
  nonInteractive: {
    pointerEvents: 'none',
  },
  centerRoadLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    borderStyle: 'dashed',
    borderLeftWidth: 2,
    borderColor: '#fff',
  },
  stageSection: {
    position: 'relative',
  },
  stageSectionSpaced: {
    marginBottom: STAGE_GAP,
  },
  stageWaypoint: {
    height: STAGE_HEADER_HEIGHT,
    position: 'relative',
  },
  stageConnector: {
    position: 'absolute',
    top: STAGE_NODE_TOP + STAGE_RING_SIZE / 2,
    height: 3,
    backgroundColor: '#c8d7df',
    zIndex: 1,
  },
  connectorLeft: {
    left: '29%',
    right: '50%',
  },
  connectorRight: {
    left: '50%',
    right: '29%',
  },
  stageRing: {
    position: 'relative',
    width: STAGE_RING_SIZE,
    height: STAGE_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageRingSvg: {
    position: 'absolute',
  },
  stageRingCenter: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 31,
    backgroundColor: Colors.primaryDark,
    elevation: 2,
  },
});
