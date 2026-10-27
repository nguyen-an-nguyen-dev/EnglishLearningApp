import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Alert,
  Easing,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import Svg, { Path } from 'react-native-svg';
import Colors from '@/constants/Colors';
import FlagMarker, { getFlagPalette, FLAG_WIDTH } from '@/components/map/FlagMarker';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/contexts/theme-context';
import { fetchUserProgress, type Lesson, type UserProgress } from '@/services/learning';







const NODE_SIZE = 76;
const NODE_ROW_HEIGHT = 142;
const STAGE_LABEL_HEIGHT = 42;
const ROAD_CURVE_STEPS = 12;
const ROAD_SWING = 26;
const ROAD_TENSION = 4.2;
const NODE_EDGE_INSET = 10;
const ROAD_WIDTH = 88;
const CAR_SIZE = 92;
const CAR_WIDTH = 58;
const CAR_DRIVE_MS_PER_LESSON = 1500;
const CAR_DRIVE_MAX_MS = 8000;
const CARD_INK = '#102027';

const BRAND_SYMBOL = { ios: 'character.bubble.fill', android: 'translate', web: 'translate' } as const;

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/../g)?.map((channel) => parseInt(channel, 16) / 255) ?? [0, 0, 0];
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function colorWithAlpha(hex: string, alpha: number): string {
  const channels = hex.slice(1).match(/../g)?.map((channel) => parseInt(channel, 16)) ?? [0, 0, 0];
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
}

function readableInk(background: string): string {
  const whiteContrast = 1.05 / (luminance(background) + 0.05);
  const darkContrast = (luminance(background) + 0.05) / (luminance(CARD_INK) + 0.05);
  return whiteContrast >= darkContrast ? '#FFFFFF' : CARD_INK;
}

function colorStopPair(colors: string[], fallback: string): string[] {
  if (colors.length < 2) {
    const color = colors[0] ?? fallback;
    return [color, color];
  }
  return colors;
}

interface LessonNode {
  key: string;
  lesson: Lesson;
  stageIndex: number;
  isFirstOfStage: boolean;
  rowHeight: number;
  nodeTopInRow: number;
  centerY: number;
  centerX: number;
}

export default function LearningPathScreen() {
  const { user, getCurrentUser } = useAuth();
  const { theme } = useAppTheme();
  const colors = Colors[theme];
  const router = useRouter();
  const { width } = useWindowDimensions();
  const carPosition = useRef(new Animated.Value(0)).current;
  const hasPositionedCar = useRef(false);
  const lastCarTarget = useRef<number | null>(null);
  const hasCenteredMap = useRef(false);
  const stageTrackingReadyAt = useRef(0);
  const pathScrollRef = useRef<ScrollViewInstance | null>(null);
  const stageColor = useRef(new Animated.Value(0)).current;
  const lastAnimatedStage = useRef<number | null>(null);

  const [progressData, setProgressData] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const [visibleStageIndex, setVisibleStageIndex] = useState<number | null>(null);
  const [selectedFlag, setSelectedFlag] = useState<{
    lesson: Lesson;
    stageIndex: number;
  } | null>(null);
  const selectedFlagRef = useRef(selectedFlag);
  const sheetRef = useRef<never>(null);

  function dismissSheet() {
    if (selectedFlagRef.current !== null) setSheetFlag(null);
  }

  function setSheetFlag(value: {
    lesson: Lesson;
    stageIndex: number;
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
        : { lesson: node.lesson, stageIndex: node.stageIndex },
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
  const bannerStageIndex = visibleStageIndex !== null && stageProgress[visibleStageIndex]
    ? visibleStageIndex
    : currentStageIndex;
  const bannerStage = stageProgress[bannerStageIndex] ?? currentStage;
  const firstIncompleteBannerLessonIndex = bannerStage
    ? bannerStage.stage.lessons.findIndex((lesson) => lesson.state.status !== 'completed')
    : -1;
  const bannerLessonIndex = bannerStage
    ? firstIncompleteBannerLessonIndex >= 0
      ? firstIncompleteBannerLessonIndex
      : bannerStage.stage.lessons.length - 1
    : -1;
  const bannerLesson = bannerLessonIndex >= 0 ? bannerStage?.stage.lessons[bannerLessonIndex] : null;
  const stagePalette = getFlagPalette(bannerStage?.stage.lessons[0]?.code);
  const stageInk = readableInk(stagePalette.main);
  const stageTrack = colorWithAlpha(stageInk, 0.2);

  const stagePalettes = useMemo(
    () => (progressData?.stages ?? []).map((stage) => getFlagPalette(stage.lessons[0]?.code)),
    [progressData],
  );
  const stageMainColors = useMemo(
    () => colorStopPair(stagePalettes.map((palette) => palette.main), '#FF8A5B'),
    [stagePalettes],
  );
  const stageShadeColors = useMemo(
    () => colorStopPair(stagePalettes.map((palette) => palette.shade), '#D96C3F'),
    [stagePalettes],
  );
  const stageInkColors = useMemo(
    () => colorStopPair(stageMainColors.map(readableInk), CARD_INK),
    [stageMainColors],
  );
  const stageTrackColors = useMemo(
    () => colorStopPair(stageInkColors.map((ink) => colorWithAlpha(ink, 0.2)), colorWithAlpha(CARD_INK, 0.2)),
    [stageInkColors],
  );
  const colorInputRange = useMemo(
    () => stageMainColors.map((_, index) => index),
    [stageMainColors],
  );
  const animatedCardBackground = useMemo(
    () => stageColor.interpolate({ inputRange: colorInputRange, outputRange: stageMainColors, extrapolate: 'clamp' }),
    [colorInputRange, stageColor, stageMainColors],
  );
  const animatedCardBorder = useMemo(
    () => stageColor.interpolate({ inputRange: colorInputRange, outputRange: stageShadeColors, extrapolate: 'clamp' }),
    [colorInputRange, stageColor, stageShadeColors],
  );
  const animatedInk = useMemo(
    () => stageColor.interpolate({ inputRange: colorInputRange, outputRange: stageInkColors, extrapolate: 'clamp' }),
    [colorInputRange, stageColor, stageInkColors],
  );
  const animatedTrack = useMemo(
    () => stageColor.interpolate({ inputRange: colorInputRange, outputRange: stageTrackColors, extrapolate: 'clamp' }),
    [colorInputRange, stageColor, stageTrackColors],
  );

  useLayoutEffect(() => {
    if (bannerStageIndex < 0 || stagePalettes.length === 0) return;
    if (lastAnimatedStage.current === null) {
      stageColor.setValue(bannerStageIndex);
      lastAnimatedStage.current = bannerStageIndex;
      return;
    }
    if (lastAnimatedStage.current === bannerStageIndex) return;

    lastAnimatedStage.current = bannerStageIndex;
    stageColor.stopAnimation();
    Animated.timing(stageColor, {
      toValue: bannerStageIndex,
      duration: 420,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [bannerStageIndex, stageColor, stagePalettes.length]);

  const useAnimatedColors = lastAnimatedStage.current !== null;
  const cardBackground = useAnimatedColors ? animatedCardBackground : stagePalette.main;
  const cardBorder = useAnimatedColors ? animatedCardBorder : stagePalette.shade;
  const cardInk = useAnimatedColors ? animatedInk : stageInk;
  const cardTrack = useAnimatedColors ? animatedTrack : stageTrack;

  const lessonNodes: LessonNode[] = [];
  const stageStartOffsets: number[] = [];
  let mapHeight = 0;
  (progressData?.stages ?? []).forEach((stage, stageIndex) => {
    stage.lessons.forEach((lesson, indexInStage) => {
      const isFirstOfStage = indexInStage === 0;
      if (isFirstOfStage) stageStartOffsets[stageIndex] = mapHeight;
      const rowHeight = NODE_ROW_HEIGHT + (isFirstOfStage ? STAGE_LABEL_HEIGHT : 0);
      const nodeTopInRow = (isFirstOfStage ? STAGE_LABEL_HEIGHT : 0) + (NODE_ROW_HEIGHT - NODE_SIZE) / 2;
      const nodeIndex = lessonNodes.length;
      lessonNodes.push({
        key: `${stage.id}-${lesson.id}`,
        lesson,
        stageIndex,
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
    // Start the journey on the screen axis, then let the road breathe left and right.
    x: index === 0
      ? routeWidth / 2
      : routeWidth / 2 + (index % 2 === 0 ? -ROAD_SWING : ROAD_SWING),
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
  const lessonNodesRef = useRef<LessonNode[]>([]);
  lessonNodeTops.current = lessonNodes.map((node) => node.centerY - CAR_SIZE / 2);
  lessonNodesRef.current = lessonNodes;

  function centerMapOnLesson(lessonIndex: number, animated: boolean): boolean {
    const targetTop = lessonNodeTops.current[lessonIndex];
    if (targetTop === undefined || scrollViewportHeight === 0 || !pathScrollRef.current) return false;
    const maxScrollY = Math.max(0, mapHeight + 44 - scrollViewportHeight);
    const targetY = Math.min(
      maxScrollY,
      Math.max(0, pathOffset.current + targetTop + CAR_SIZE / 2 - scrollViewportHeight / 2),
    );
    pathScrollRef.current.scrollTo({
      y: targetY,
      animated,
    });
    return true;
  }

  function handleMapScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    // Ignore the initial top-of-map event; the focus pass centers the current lesson first.
    if (!hasCenteredMap.current) return;
    // Keep the banner on the learner's current stage while the initial jump into place settles.
    if (stageTrackingReadyAt.current > 0) {
      if (Date.now() < stageTrackingReadyAt.current) return;
      stageTrackingReadyAt.current = 0;
    }
    const scrollY = event.nativeEvent.contentOffset.y;
    const probeY = scrollY + 24;
    let nextStageIndex = 0;
    stageStartOffsets.forEach((startY, index) => {
      if (probeY >= startY) nextStageIndex = index;
    });
    setVisibleStageIndex((current) => (current === nextStageIndex ? current : nextStageIndex));
  }

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

    const arrivedNode = lessonNodesRef.current[currentLessonIndex];
    Animated.timing(carPosition, {
      toValue: targetPosition,
      duration: Math.min(CAR_DRIVE_MAX_MS, distance * CAR_DRIVE_MS_PER_LESSON),
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      centerMapOnLesson(currentLessonIndex, true);
      if (!arrivedNode || arrivedNode.lesson.state.status === 'completed' || selectedFlagRef.current) return;
      setSheetFlag({
        lesson: arrivedNode.lesson,
        stageIndex: arrivedNode.stageIndex,
      });
    });
    lastCarTarget.current = currentLessonIndex;
  }, [currentLessonIndex, carPosition, scrollViewportHeight, totalLessons]);

  // Re-entering this tab (from another tab or a lesson) must always reveal the car, so the map
  // scrolls back to it once the ScrollView has finished its focus layout pass.
  useFocusEffect(useCallback(() => {
    if (totalLessons === 0 || currentLessonIndex < 0) return;
    const timer = setTimeout(() => {
      const wasCentered = hasCenteredMap.current;
      const centered = centerMapOnLesson(currentLessonIndex, wasCentered);
      if (!centered) return;
      hasCenteredMap.current = true;
      if (!wasCentered) stageTrackingReadyAt.current = Date.now() + 320;
    }, 60);
    return () => clearTimeout(timer);
  }, [currentLessonIndex, scrollViewportHeight, totalLessons]));

  const carLeft = roadMotionPoints.length > 1
    ? carPosition.interpolate({
      inputRange: roadMotionIndices,
      outputRange: roadMotionPoints.map((point) => point.x - CAR_WIDTH / 2),
      extrapolate: 'clamp',
    })
    : (roadMotionPoints[0]?.x ?? routeWidth / 2) - CAR_WIDTH / 2;
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
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.brandLogoImage}
              resizeMode="contain"
            />
            <Text style={styles.brandTitle}>
              <Text style={{ color: '#00C7FF' }}>Eng</Text>
              <Text style={{ color: '#7CCB86' }}>o</Text>
              <Text style={{ color: '#F59E0B' }}>race</Text>
            </Text>
          </View>
          <View style={styles.headerActions}>
            <View style={[styles.statChip, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={styles.statChipIcon}>🔥</Text>
              <Text style={[styles.statChipText, { color: colors.text }]}>{user?.streak ?? 0}</Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={styles.statChipIcon}>💎</Text>
              <Text style={[styles.statChipText, { color: colors.text }]}>
                {(user?.xp ?? progressData?.total_xp ?? 0).toLocaleString()}
              </Text>
            </View>
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
          <Animated.View style={[styles.unitCard, { backgroundColor: cardBackground, borderColor: cardBorder }]}>
            <View style={styles.unitCardHead}>
              <View style={styles.unitCopy}>
                <Animated.Text numberOfLines={1} style={[styles.unitTitle, { color: cardInk }]}>
                  {activeLessonIndex < 0 ? 'Đã hoàn thành lộ trình' : bannerLesson?.title}
                </Animated.Text>
                <Animated.Text numberOfLines={1} style={[styles.unitMeta, { color: cardInk }]}>
                  {`Bài ${bannerLessonIndex + 1} / ${bannerStage?.totalLessons ?? 0}`}
                </Animated.Text>
              </View>
            </View>

            <View style={styles.unitSegments}>
              {bannerStage?.stage.lessons.map((lesson, index) => {
                const isCompleted = index < bannerLessonIndex;
                const isCurrent = index === bannerLessonIndex;
                return (
                  <View key={lesson.id} style={styles.unitPillWrapper}>
                    <Animated.View
                      style={[
                        styles.unitPillTrack,
                        { backgroundColor: cardTrack },
                      ]}
                    >
                      {(isCompleted || isCurrent) && (
                        <Animated.View
                          style={[
                            styles.unitPillFill,
                            { backgroundColor: cardInk },
                          ]}
                        />
                      )}
                    </Animated.View>
                    {isCurrent && (
                      <Animated.View
                        style={[
                          styles.unitPillActiveDot,
                          { backgroundColor: cardInk },
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

      </View>
      {!loading && progressData && (
        <ScrollView
          ref={pathScrollRef}
          style={styles.roadScroll}
          onLayout={(event) => setScrollViewportHeight(event.nativeEvent.layout.height)}
          onScroll={handleMapScroll}
          onScrollBeginDrag={() => { stageTrackingReadyAt.current = 0; }}
          scrollEventThrottle={16}
          decelerationRate={0.994}
          removeClippedSubviews={false}
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
                  strokeWidth={ROAD_WIDTH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d={roadPath}
                  fill="none"
                  stroke={theme === 'dark' ? '#161B22' : '#C7D1DC'}
                  strokeWidth={ROAD_WIDTH - 4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d={roadPath}
                  fill="none"
                  stroke={theme === 'dark' ? '#484F58' : '#ffffff'}
                  strokeWidth={3}
                  strokeDasharray="9 13"
                />
              </Svg>
            ) : null}
            {lessonNodes.map((node, index) => {
              const status = node.lesson.state.status;
              const isCompleted = status === 'completed';
              const isLocked = status === 'locked';
              const mirrored = node.centerX > routeWidth / 2;

              return (
                <View key={node.key} style={[styles.nodeSlot, { height: node.rowHeight }]}>
                  {node.isFirstOfStage && (
                    <Text style={[styles.stageDivider, { color: colors.textMuted }]}>
                      {`CHẶNG ${node.stageIndex + 1}`}
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
                    <FlagMarker code={node.lesson.code} mirrored={mirrored} status={status} size={NODE_SIZE} />
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
                <Image
                  source={require('../../assets/images/route-car.png')}
                  style={styles.carImage}
                  resizeMode="contain"
                  accessibilityLabel="Xe học của bạn"
                />
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
          <View style={styles.sheetHeaderRow}>
            <Text style={[styles.sheetStage, { color: colors.textMuted }]}>
              {`CHẶNG ${selectedFlag.stageIndex + 1}`}
            </Text>
            
          </View>
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
    paddingTop: 2,
    paddingBottom: 28,
  },
  journeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandLogoImage: {
    width: 34,
    height: 34,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  statChipIcon: {
    fontSize: 13,
  },
  statChipText: {
    fontSize: 13,
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
  unitCard: {
    marginTop: 10,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
  },
  unitCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unitCopy: {
    flex: 1,
  },
  unitTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  unitMeta: {
    marginTop: 3,
    fontSize: 12.5,
    fontWeight: '600',
  },
  unitSegments: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  unitPillWrapper: {
    flex: 1,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  unitPillTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  unitPillFill: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
  },
  unitPillActiveDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
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
  nodeTitle: {
    marginTop: 7,
    width: 118,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
  },
  movingCar: {
    position: 'absolute',
    width: CAR_WIDTH,
    height: CAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  carImage: {
    width: CAR_WIDTH,
    height: CAR_SIZE,
    // The artwork points up, but the journey drives down the road.
    transform: [{ rotate: '180deg' }],
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
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
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
