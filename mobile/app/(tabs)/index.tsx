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
  type ScrollViewInstance,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/contexts/theme-context';
import { fetchUserProgress, type Lesson, type UserProgress } from '@/services/learning';

const NODE_SIZE = 64;
const NODE_ROW_HEIGHT = 128;
const STAGE_LABEL_HEIGHT = 42;
const ROAD_CURVE_STEPS = 12;
const ROAD_SWING = 24;
const ROAD_TENSION = 4.2;
const NODE_EDGE_INSET = 16;
const CAR_SIZE = 62;

interface LessonNode {
  key: string;
  lesson: Lesson;
  stageIndex: number;
  indexInStage: number;
  stageTitle: string;
  isFirstOfStage: boolean;
  rowHeight: number;
  nodeTopInRow: number;
  centerY: number;
  centerX: number;
}

export default function LearningPathScreen() {
  const { user, logout, getCurrentUser } = useAuth();
  const { theme } = useAppTheme();
  const colors = Colors[theme];
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const carPosition = useRef(new Animated.Value(0)).current;
  const hasPositionedCar = useRef(false);
  const lastCarTarget = useRef<number | null>(null);
  const pathScrollRef = useRef<ScrollViewInstance | null>(null);
  const scrollOffset = useRef(0);

  const [progressData, setProgressData] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedFlag, setSelectedFlag] = useState<{
    lesson: Lesson;
    stageIndex: number;
    stageTitle: string;
  } | null>(null);
  const selectedFlagRef = useRef(selectedFlag);
  const sheetRef = useRef<never>(null);

  function dismissSheet() {
    if (selectedFlagRef.current !== null) setSheetFlag(null);
  }

  function setSheetFlag(value: {
    lesson: Lesson;
    stageIndex: number;
    stageTitle: string;
  } | null) {
    selectedFlagRef.current = value;
    setSelectedFlag(value);
  }

  function touchIsInsideSheet(event: { target?: unknown }): boolean {
    const sheetNode = sheetRef.current as unknown as HTMLElement | null;
    if (!sheetNode) return false;
    let node = event.target as HTMLElement | null;
    while (node) {
      if (node === sheetNode) return true;
      node = node.parentElement;
    }
    return false;
  }

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

  function handleFlagPress(node: LessonNode) {
    if (node.lesson.state.status === 'locked') {
      Alert.alert(
        'Bài học bị khóa',
        'Hoàn thành bài học trước đó để mở khóa bài học này.',
        [{ text: 'Đã hiểu', style: 'default' }],
      );
      return;
    }

    const current = selectedFlagRef.current;
    setSheetFlag(
      current?.lesson.id === node.lesson.id
        ? null
        : { lesson: node.lesson, stageIndex: node.stageIndex, stageTitle: node.stageTitle },
    );
  }

  function startSelectedLesson() {
    const lessonId = selectedFlagRef.current?.lesson.id;
    if (lessonId === undefined || lessonId === null) return;
    setSheetFlag(null);
    router.push({
      pathname: '/lesson/[id]',
      params: { id: String(lessonId) },
    });
  }

  const allLessons = progressData?.stages.flatMap((stage) => stage.lessons) ?? [];
  const totalLessons = allLessons.length;
  const activeLessonIndex = allLessons.findIndex((lesson) => lesson.state.status !== 'completed');
  const currentLessonIndex = activeLessonIndex >= 0 ? activeLessonIndex : allLessons.length - 1;
  const currentLesson = allLessons[currentLessonIndex];
  const routeWidth = Math.max(width - 36, 200);

  const stageProgress = (progressData?.stages ?? []).map((stage) => {
    const completedLessons = stage.lessons.filter((lesson) => lesson.state.status === 'completed').length;
    return {
      stage,
      completedLessons,
      totalLessons: stage.lessons.length,
    };
  });
  const currentStageIndex = currentLesson
    ? stageProgress.findIndex((item) => item.stage.lessons.some((lesson) => lesson.id === currentLesson.id))
    : -1;
  const currentStage = currentStageIndex >= 0 ? stageProgress[currentStageIndex] : null;
  const currentStageLessonIndex = currentStage && currentLesson
    ? currentStage.stage.lessons.findIndex((lesson) => lesson.id === currentLesson.id)
    : -1;
  const stagePercentage = currentStage && currentStage.totalLessons > 0
    ? Math.round((currentStage.completedLessons / currentStage.totalLessons) * 100)
    : 0;

  const lessonNodes: LessonNode[] = [];
  let mapHeight = 0;
  (progressData?.stages ?? []).forEach((stage, stageIndex) => {
    stage.lessons.forEach((lesson, indexInStage) => {
      const isFirstOfStage = indexInStage === 0;
      const rowHeight = NODE_ROW_HEIGHT + (isFirstOfStage ? STAGE_LABEL_HEIGHT : 0);
      const nodeTopInRow = (isFirstOfStage ? STAGE_LABEL_HEIGHT : 0) + (NODE_ROW_HEIGHT - NODE_SIZE) / 2;
      const nodeIndex = lessonNodes.length;
      lessonNodes.push({
        key: `${stage.id}-${lesson.id}`,
        lesson,
        stageIndex,
        indexInStage,
        stageTitle: stage.title,
        isFirstOfStage,
        rowHeight,
        nodeTopInRow,
        centerY: mapHeight + nodeTopInRow + NODE_SIZE / 2,
        centerX: nodeIndex % 2 === 0
          ? NODE_EDGE_INSET + NODE_SIZE / 2
          : routeWidth - NODE_EDGE_INSET - NODE_SIZE / 2,
      });
      mapHeight += rowHeight;
    });
  });

  const roadWaypoints = lessonNodes.map((node, index) => ({
    x: routeWidth / 2 + (index % 2 === 0 ? -ROAD_SWING : ROAD_SWING),
    y: node.centerY,
  }));
  const getRoadCurveControls = (index: number) => {
    const start = roadWaypoints[index];
    const end = roadWaypoints[index + 1];
    const previous = roadWaypoints[index - 1] ?? {
      x: 2 * start.x - end.x,
      y: 2 * start.y - end.y,
    };
    const next = roadWaypoints[index + 2] ?? {
      x: 2 * end.x - start.x,
      y: 2 * end.y - start.y,
    };
    return {
      first: {
        x: start.x + (end.x - previous.x) / ROAD_TENSION,
        y: start.y + (end.y - previous.y) / ROAD_TENSION,
      },
      second: {
        x: end.x - (next.x - start.x) / ROAD_TENSION,
        y: end.y - (next.y - start.y) / ROAD_TENSION,
      },
    };
  };
  const roadPath = roadWaypoints.length > 0
    ? roadWaypoints.slice(1).reduce((path, point, index) => {
      const previous = roadWaypoints[index];
      const { first, second } = getRoadCurveControls(index);
      return `${path} C ${first.x} ${first.y}, ${second.x} ${second.y}, ${point.x} ${point.y}`;
    }, `M ${roadWaypoints[0].x} 0 C ${roadWaypoints[0].x} ${roadWaypoints[0].y * 0.65}, ${roadWaypoints[0].x} ${roadWaypoints[0].y * 0.85}, ${roadWaypoints[0].x} ${roadWaypoints[0].y}`)
    : '';
  const roadMotionPoints = roadWaypoints.length > 1
    ? roadWaypoints.slice(1).reduce((points, point, index) => {
      const start = roadWaypoints[index];
      const { first, second } = getRoadCurveControls(index);
      for (let step = 1; step <= ROAD_CURVE_STEPS; step += 1) {
        const t = step / ROAD_CURVE_STEPS;
        const inverseT = 1 - t;
        points.push({
          x: inverseT ** 3 * start.x + 3 * inverseT ** 2 * t * first.x
            + 3 * inverseT * t ** 2 * second.x + t ** 3 * point.x,
          y: inverseT ** 3 * start.y + 3 * inverseT ** 2 * t * first.y
            + 3 * inverseT * t ** 2 * second.y + t ** 3 * point.y,
        });
      }
      return points;
    }, [roadWaypoints[0]])
    : roadWaypoints;
  const roadMotionIndices = roadMotionPoints.map((_, index) => index);
  const pathOffset = useRef(0);
  const lessonNodeTops = useRef<number[]>([]);
  lessonNodeTops.current = lessonNodes.map((node) => node.centerY - CAR_SIZE / 2);

  useEffect(() => {
    if (totalLessons === 0 || currentLessonIndex < 0) return;
    const targetPosition = currentLessonIndex * ROAD_CURVE_STEPS;
    if (!hasPositionedCar.current) {
      carPosition.setValue(targetPosition);
      hasPositionedCar.current = true;
      lastCarTarget.current = currentLessonIndex;
      return;
    }

    const previousTarget = lastCarTarget.current ?? currentLessonIndex;
    const distance = Math.abs(currentLessonIndex - previousTarget);
    if (distance === 0) return;

    const targetTop = lessonNodeTops.current[currentLessonIndex] ?? 0;
    Animated.timing(carPosition, {
      toValue: targetPosition,
      duration: Math.min(8000, distance * 900),
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
    lastCarTarget.current = currentLessonIndex;
  }, [currentLessonIndex, carPosition, height, totalLessons]);

  const carLeft = roadMotionPoints.length > 1
    ? carPosition.interpolate({
      inputRange: roadMotionIndices,
      outputRange: roadMotionPoints.map((point) => point.x - 25),
      extrapolate: 'clamp',
    })
    : (roadMotionPoints[0]?.x ?? routeWidth / 2) - 25;
  const carTop = roadMotionPoints.length > 1
    ? carPosition.interpolate({
      inputRange: roadMotionIndices,
      outputRange: roadMotionPoints.map((point) => point.y - CAR_SIZE / 2),
      extrapolate: 'clamp',
    })
    : (roadMotionPoints[0]?.y ?? 0) - CAR_SIZE / 2;

  return (
    <SafeAreaView
      style={[styles.journeySafeArea, { backgroundColor: colors.background }]}
      onStartShouldSetResponderCapture={(event) => {
        if (touchIsInsideSheet(event)) return false;
        dismissSheet();
        return false;
      }}
    >
      <View style={[styles.fixedTop, { backgroundColor: colors.background }]}>
        <View style={styles.journeyHeader}>
          <View style={styles.brandGroup}>
            <Text style={[styles.brandTitle, { color: '#079ab1' }]}>Lingua</Text>
          </View>
          <View style={styles.headerActions}>
            <View style={[styles.xpChip, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
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
              <Text style={styles.overviewStageLabel}>STAGE {currentStageIndex + 1} {currentStage.stage.title}</Text>
              <Text style={[styles.overviewCount, { color: colors.textMuted }]}>
                BÀI {currentStageLessonIndex + 1} / {currentStage.totalLessons}
              </Text>
            </View>

            <Text numberOfLines={1} style={[styles.overviewSubtitle, { color: colors.textMuted }]}>
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
          onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.journeyScroll, { backgroundColor: colors.background }]}
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
          <View
            style={[styles.stageMap, { minHeight: mapHeight }]}
            onLayout={(event) => { pathOffset.current = event.nativeEvent.layout.y; }}
          >
            {roadPath ? (
              <Svg
                height={Math.max(mapHeight, 1)}
                width={routeWidth}
                viewBox={`0 0 ${routeWidth} ${Math.max(mapHeight, 1)}`}
                style={[styles.curvedRoad, styles.nonInteractive]}
              >
                <Path
                  d={roadPath}
                  fill="none"
                  stroke={theme === 'dark' ? '#30363D' : '#AAB7C4'}
                  strokeWidth={76}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d={roadPath}
                  fill="none"
                  stroke={theme === 'dark' ? '#161B22' : '#C7D1DC'}
                  strokeWidth={72}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d={roadPath}
                  fill="none"
                  stroke={theme === 'dark' ? '#484F58' : '#ffffff'}
                  strokeWidth={2}
                  strokeDasharray="8 12"
                />
              </Svg>
            ) : null}
            {lessonNodes.map((node, index) => {
              const status = node.lesson.state.status;
              const isCompleted = status === 'completed';
              const isLocked = status === 'locked';
              const bannerColor = isCompleted ? '#11b9cf' : isLocked ? '#AEBFD0' : '#f2b544';
              const bannerShade = isCompleted ? '#0c8d9e' : isLocked ? '#8ba0b6' : '#cf9326';
              const mirrored = node.centerX > routeWidth / 2;

              return (
                <View key={node.key} style={[styles.nodeSlot, { height: node.rowHeight }]}>
                  {node.isFirstOfStage && (
                    <Text style={[styles.stageDivider, { color: colors.textMuted }]}>
                      {`STAGE ${node.stageIndex + 1} · ${node.stageTitle.toUpperCase()}`}
                    </Text>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Bài ${index + 1}, ${node.lesson.title}. ${
                      isCompleted ? 'Đã hoàn thành' : isLocked ? 'Bị khóa' : 'Nhấn để học'
                    }`}
                    onPress={() => handleFlagPress(node)}
                    style={[
                      styles.lessonNode,
                      { top: node.nodeTopInRow, left: Math.max(4, Math.min(node.centerX - NODE_SIZE / 2, routeWidth - NODE_SIZE - 4)) },
                    ]}
                  >
                    <Svg width={64} height={68} viewBox="0 0 64 68" style={styles.flagSvg}>
                      {mirrored ? (
                        <>
                          <Rect x="32" y="6" width="5" height="56" rx="2.5" fill="#42586B" />
                          <Circle cx="34.5" cy="62" r="6" fill="#42586B" />
                          <Path
                            d="M32 8 L3 8 L9.5 18.5 L3 29 L32 29 Z"
                            fill={bannerColor}
                            opacity={isLocked ? 0.85 : 1}
                          />
                          <Path d="M28 8 L32 8 L32 29 L28 29 Z" fill={bannerShade} />
                        </>
                      ) : (
                        <>
                          <Rect x="27" y="6" width="5" height="56" rx="2.5" fill="#42586B" />
                          <Circle cx="29.5" cy="62" r="6" fill="#42586B" />
                          <Path
                            d="M32 8 L61 8 L54.5 18.5 L61 29 L32 29 Z"
                            fill={bannerColor}
                            opacity={isLocked ? 0.85 : 1}
                          />
                          <Path d="M32 8 L36 8 L36 29 L32 29 Z" fill={bannerShade} />
                        </>
                      )}
                    </Svg>
                    <Text
                      style={[
                        styles.flagGlyph,
                        { left: mirrored ? 6 : 34 },
                        isLocked ? { fontSize: 13 } : null,
                      ]}
                      pointerEvents="none"
                    >
                      {isCompleted ? '✓' : isLocked ? '🔒' : String(node.indexInStage + 1)}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.nodeTitle,
                        { color: isLocked ? colors.textMuted : colors.text },
                      ]}
                    >
                      {node.lesson.title}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
            {roadMotionPoints.length > 0 && (
              <Animated.View
                pointerEvents="none"
                style={[styles.movingCar, { left: carLeft, top: carTop }]}
              >
                <Svg width={50} height={62} viewBox="0 0 50 62">
                  <Path d="M13 8 Q14 3 20 2 L30 2 Q36 3 37 8 L43 20 L45 48 Q45 56 38 59 L12 59 Q5 56 5 48 L7 20 Z" fill="#0B7285" />
                  <Path d="M14 10 Q15 6 20 5 L30 5 Q35 6 36 10 L39 18 L11 18 Z" fill="#8DE5F2" />
                  <Path d="M11 22 L39 22 L40 37 L10 37 Z" fill="#D8F8FC" />
                  <Path d="M10 41 L40 41 L39 49 Q38 53 33 54 L17 54 Q12 53 11 49 Z" fill="#57C7D8" />
                  <Path d="M7 23 L11 23 L10 34 L6 34 Z M39 23 L43 23 L44 34 L40 34 Z" fill="#17212B" />
                  <Path d="M6 43 L10 43 L11 52 L8 53 Q5 51 5 48 Z M40 43 L44 43 L45 48 Q45 51 42 53 L39 52 Z" fill="#17212B" />
                  <Rect x="10" y="7" width="5" height="10" rx="2" fill="#17212B" />
                  <Rect x="35" y="7" width="5" height="10" rx="2" fill="#17212B" />
                  <Rect x="8" y="4" width="7" height="3" rx="1.5" fill="#FFF4B8" />
                  <Rect x="35" y="4" width="7" height="3" rx="1.5" fill="#FFF4B8" />
                  <Rect x="11" y="56" width="8" height="3" rx="1" fill="#FF6B6B" />
                  <Rect x="31" y="56" width="8" height="3" rx="1" fill="#FF6B6B" />
                </Svg>
              </Animated.View>
            )}
          </View>
        </ScrollView>
      )}
      {selectedFlag && (
        <View
          ref={sheetRef}
          onStartShouldSetResponder={() => true}
          style={[styles.lessonSheet, { backgroundColor: colors.cardBackground, borderTopColor: colors.border }]}
        >
          <Text style={[styles.sheetStage, { color: colors.textMuted }]}>
            {`STAGE ${selectedFlag.stageIndex + 1} · ${selectedFlag.stageTitle.toUpperCase()}`}
          </Text>
          <Text numberOfLines={2} style={[styles.sheetTitle, { color: colors.text }]}>
            {selectedFlag.lesson.title}
          </Text>
          <Text style={[styles.sheetMeta, { color: colors.textMuted }]}>
            {`Chủ đề: ${selectedFlag.lesson.topic} · ${selectedFlag.lesson.total_questions} câu hỏi${
              selectedFlag.lesson.state.status === 'completed' && selectedFlag.lesson.state.score !== null
                ? ` · Điểm: ${selectedFlag.lesson.state.score}`
                : ''
            }`}
          </Text>
          <View style={styles.sheetActions}>
            <Pressable
              accessibilityRole="button"
              onPress={startSelectedLesson}
              style={styles.sheetStartButton}
            >
              <Text style={styles.sheetStartText}>
                {selectedFlag.lesson.state.status === 'completed' ? 'Làm lại' : 'Bắt đầu'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={dismissSheet}
              style={[styles.sheetCloseButton, { backgroundColor: colors.background }]}
            >
              <Text style={[styles.sheetCloseText, { color: colors.textMuted }]}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      )}
      {!loading && progressData && totalLessons > 0 && activeLessonIndex < 0 && !selectedFlag && (
        <View style={[styles.completedDock, { backgroundColor: colors.cardBackground, borderTopColor: colors.border }]}>
          <Text style={styles.completedDockText}>🏁 Bạn đã hoàn thành tất cả bài học!</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  brandTitle: {
    color: '#17263b',
    fontSize: 30,
    fontWeight: '900',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  xpChip: {
    borderWidth: 1,
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
  stageMap: {
    position: 'relative',
    paddingBottom: 14,
  },
  curvedRoad: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  nonInteractive: {
    pointerEvents: 'none',
  },
  nodeSlot: {
    position: 'relative',
  },
  stageDivider: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    paddingTop: 12,
  },
  lessonNode: {
    position: 'absolute',
    width: NODE_SIZE,
    alignItems: 'center',
    zIndex: 2,
  },
  flagSvg: {
    marginTop: -2,
  },
  flagGlyph: {
    position: 'absolute',
    top: 10,
    width: 26,
    textAlign: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  nodeTitle: {
    marginTop: 7,
    width: 118,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
  },
  movingCar: {
    position: 'absolute',
    width: 50,
    height: CAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  completedDock: {
    paddingHorizontal: 18,
    paddingVertical: 22,
    borderTopWidth: 1,
    backgroundColor: '#fff',
  },
  completedDockText: {
    color: '#146b55',
    textAlign: 'center',
    fontWeight: '800',
  },
  lessonSheet: {
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 4,
  },
  sheetStage: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '900',
  },
  sheetMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  sheetStartButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: Colors.primaryDark,
  },
  sheetStartText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  sheetCloseButton: {
    minWidth: 84,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  sheetCloseText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
