import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
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
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Colors from '@/constants/Colors';
import CheckpointMarker, { getCheckpointPalette } from '@/components/map/CheckpointMarker';
import StageScenery from '@/components/map/StageScenery';
import { getStageWorldTheme, mixHex, TRACK_CURB_COOL, TRACK_CURB_HOT, TRACK_LINE } from '@/components/map/stageThemes';
import { useAppDialog } from '@/contexts/app-dialog-context';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/contexts/theme-context';
import { fetchUserProgress, type Lesson, type UserProgress } from '@/services/learning';







const NODE_ROW_HEIGHT = 142;
const STAGE_LABEL_HEIGHT = 54;
const ROAD_CURVE_STEPS = 12;
const ROAD_SWING = 26;
const ROAD_TENSION = 4.2;
const NODE_EDGE_INSET = 10;
const ROAD_WIDTH_MAX = 76;
const NODE_SIZE_MAX = 76;
const ROAD_CURB_DASH = 22;
const ROAD_LANE_DASH = '18 26';
const CAR_SIZE_MAX = 92;
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
  const { showAppDialog } = useAppDialog();
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
      showAppDialog({
        title: 'Bài học đang khóa',
        message: 'Hoàn thành bài học trước đó để mở khóa chặng tiếp theo nhé.',
        buttons: [{ text: 'Đã hiểu' }],
      });
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
  // Track, checkpoints and car scale together so the road never crowds the markers on small phones.
  const roadWidth = Math.max(58, Math.min(ROAD_WIDTH_MAX, Math.round(routeWidth * 0.22)));
  const nodeSize = Math.max(64, Math.min(NODE_SIZE_MAX, Math.round(routeWidth * 0.21)));
  const carSize = Math.round(nodeSize * 1.2);
  const carWidth = Math.round(carSize * 0.63);
  const nodeTitleWidth = Math.round(Math.min(110, routeWidth * 0.34));
  const selectedFlagPalette = getCheckpointPalette(selectedFlag?.lesson.code);
  const sheetSurface = theme === 'dark'
    ? colors.cardBackground
    : mixHex(selectedFlagPalette.main, '#FFFFFF', 0.92);
  const sheetAccentInk = theme === 'dark' ? selectedFlagPalette.main : selectedFlagPalette.shade;
  const surfaceLift = (color: string) => ({
    shadowColor: color,
    shadowOpacity: theme === 'dark' ? 0.5 : 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  });

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
  const stagePalette = getCheckpointPalette(bannerStage?.stage.lessons[0]?.code);
  const stageInk = readableInk(stagePalette.main);
  const stageTrack = colorWithAlpha(stageInk, 0.2);

  const stagePalettes = useMemo(
    () => (progressData?.stages ?? []).map((stage) => getCheckpointPalette(stage.lessons[0]?.code)),
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
      const nodeTopInRow = (isFirstOfStage ? STAGE_LABEL_HEIGHT : 0) + (NODE_ROW_HEIGHT - nodeSize) / 2;
      const nodeIndex = lessonNodes.length;
      lessonNodes.push({
        key: `${stage.id}-${lesson.id}`,
        lesson,
        stageIndex,
        isFirstOfStage,
        rowHeight,
        nodeTopInRow,
        centerY: mapHeight + nodeTopInRow + nodeSize / 2,
        // The road swings toward the even-index side, so checkpoints take the free side.
        centerX: nodeIndex % 2 === 0
          ? routeWidth - NODE_EDGE_INSET - nodeSize / 2
          : NODE_EDGE_INSET + nodeSize / 2,
      });
      mapHeight += rowHeight;
    });
  });
  const roadStageStops = stageProgress
    .map((_, stageIndex) => {
      const start = stageStartOffsets[stageIndex];
      return start === undefined
        ? null
        : {
          key: `stage-road-${stageIndex}`,
          offset: mapHeight > 0 ? (start / mapHeight) * 100 : 0,
          world: getStageWorldTheme(stageIndex),
        };
    })
    .filter((stop): stop is { key: string; offset: number; world: ReturnType<typeof getStageWorldTheme> } => stop !== null);
  const lastRoadStop = roadStageStops[roadStageStops.length - 1];
  if (lastRoadStop) {
    roadStageStops.push({ ...lastRoadStop, key: 'stage-road-end', offset: 100 });
  }

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
  lessonNodeTops.current = lessonNodes.map((node) => node.centerY - carSize / 2);
  lessonNodesRef.current = lessonNodes;

  function centerMapOnLesson(lessonIndex: number, animated: boolean): boolean {
    const targetTop = lessonNodeTops.current[lessonIndex];
    if (targetTop === undefined || scrollViewportHeight === 0 || !pathScrollRef.current) return false;
    const maxScrollY = Math.max(0, mapHeight + 44 - scrollViewportHeight);
    const targetY = Math.min(
      maxScrollY,
      Math.max(0, pathOffset.current + targetTop + carSize / 2 - scrollViewportHeight / 2),
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
      outputRange: roadMotionPoints.map((point) => point.x - carWidth / 2),
      extrapolate: 'clamp',
    })
    : (roadMotionPoints[0]?.x ?? routeWidth / 2) - carWidth / 2;
  const carTop = roadMotionPoints.length > 1
    ? carPosition.interpolate({
      inputRange: roadMotionIndices,
      outputRange: roadMotionPoints.map((point) => point.y - carSize / 2),
      extrapolate: 'clamp',
    })
    : (roadMotionPoints[0]?.y ?? 0) - carSize / 2;

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
            {roadPath ? stageProgress.map(({ stage }, stageIndex) => {
              const stageLessons = lessonNodes.filter((node) => node.stageIndex === stageIndex);
              if (stageLessons.length === 0) return null;
              const stageHeight = stageLessons.reduce((total, node) => total + node.rowHeight, 0);
              return (
                <StageScenery
                  height={stageHeight}
                  key={stage.id}
                  screenWidth={width}
                  stageIndex={stageIndex}
                  theme={theme}
                  top={stageStartOffsets[stageIndex] ?? 0}
                />
              );
            }) : null}
            {roadPath ? (
              <Svg
                height={Math.max(mapHeight, 1)}
                width={routeWidth}
                viewBox={`0 0 ${routeWidth} ${Math.max(mapHeight, 1)}`}
                style={[styles.curvedRoad, styles.nonInteractive]}
              >
                <Defs>
                  <LinearGradient
                    id="learning-road-fill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2={Math.max(mapHeight, 1)}
                    gradientUnits="userSpaceOnUse"
                  >
                    {roadStageStops.map((stop) => (
                      <Stop
                        key={stop.key}
                        offset={`${stop.offset}%`}
                        stopColor={theme === 'dark' ? mixHex(stop.world.asphalt, stop.world.nightSky, 0.35) : stop.world.asphalt}
                      />
                    ))}
                  </LinearGradient>
                  <LinearGradient
                    id="learning-road-rim"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2={Math.max(mapHeight, 1)}
                    gradientUnits="userSpaceOnUse"
                  >
                    {roadStageStops.map((stop) => (
                      <Stop
                        key={stop.key}
                        offset={`${stop.offset}%`}
                        stopColor={theme === 'dark' ? mixHex(stop.world.asphaltEdge, stop.world.nightSky, 0.3) : stop.world.asphaltEdge}
                      />
                    ))}
                  </LinearGradient>
                  <LinearGradient
                    id="learning-road-shoulder"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2={Math.max(mapHeight, 1)}
                    gradientUnits="userSpaceOnUse"
                  >
                    {roadStageStops.map((stop) => (
                      <Stop
                        key={stop.key}
                        offset={`${stop.offset}%`}
                        stopColor={theme === 'dark' ? mixHex(stop.world.shoulder, stop.world.nightHorizon, 0.55) : stop.world.shoulder}
                      />
                    ))}
                  </LinearGradient>
                </Defs>

                <G transform="translate(3 9)">
                  <Path
                    d={roadPath}
                    fill="none"
                    stroke={theme === 'dark' ? '#05100F' : '#1E3436'}
                    strokeOpacity={theme === 'dark' ? 0.4 : 0.16}
                    strokeWidth={roadWidth + 22}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </G>
                <Path
                  d={roadPath}
                  fill="none"
                  stroke="url(#learning-road-shoulder)"
                  strokeOpacity={theme === 'dark' ? 0.42 : 0.62}
                  strokeWidth={roadWidth + 20}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d={roadPath}
                  fill="none"
                  stroke={TRACK_CURB_HOT}
                  strokeWidth={roadWidth + 12}
                  strokeDasharray={`${ROAD_CURB_DASH} ${ROAD_CURB_DASH}`}
                  strokeLinecap="butt"
                />
                <Path
                  d={roadPath}
                  fill="none"
                  stroke={TRACK_CURB_COOL}
                  strokeWidth={roadWidth + 12}
                  strokeDasharray={`${ROAD_CURB_DASH} ${ROAD_CURB_DASH}`}
                  strokeDashoffset={ROAD_CURB_DASH}
                  strokeLinecap="butt"
                />
                <Path
                  d={roadPath}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeOpacity={theme === 'dark' ? 0.72 : 0.95}
                  strokeWidth={roadWidth + 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d={roadPath}
                  fill="none"
                  stroke="url(#learning-road-rim)"
                  strokeWidth={roadWidth - 3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d={roadPath}
                  fill="none"
                  stroke="url(#learning-road-fill)"
                  strokeWidth={roadWidth - 11}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d={roadPath}
                  fill="none"
                  stroke={TRACK_LINE}
                  strokeOpacity={theme === 'dark' ? 0.5 : 0.8}
                  strokeWidth={3}
                  strokeDasharray={ROAD_LANE_DASH}
                  strokeLinecap="round"
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
                    <View style={styles.stageHeading}>
                      <View
                        style={[
                          styles.stageHeadingPill,
                          {
                            backgroundColor: theme === 'dark' ? 'rgba(12, 22, 28, 0.78)' : 'rgba(255, 255, 255, 0.82)',
                            borderColor: colorWithAlpha(getStageWorldTheme(node.stageIndex).shade, 0.22),
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.stageIndexChip,
                            { backgroundColor: colorWithAlpha(getStageWorldTheme(node.stageIndex).accent, theme === 'dark' ? 0.24 : 0.16) },
                          ]}
                        >
                          <Text
                            style={[
                              styles.stageIndexText,
                              { color: theme === 'dark' ? getStageWorldTheme(node.stageIndex).accent : getStageWorldTheme(node.stageIndex).shade },
                            ]}
                          >
                            {String(node.stageIndex + 1).padStart(2, '0')}
                          </Text>
                        </View>
                        <View>
                          <Text style={[styles.stageEyebrow, { color: colors.textMuted }]}>
                            {`CHẶNG ${node.stageIndex + 1}`}
                          </Text>
                          <Text style={[styles.stageName, { color: colors.text }]}>
                            {getStageWorldTheme(node.stageIndex).name}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                  

                  

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Bài ${index + 1}, ${node.lesson.title}. ${
                      isCompleted ? 'Đã hoàn thành' : isLocked ? 'Bị khóa' : 'Nhấn để học'
                    }`}
                    onPress={() => handleFlagPress(node)}
                    android_ripple={{ color: colorWithAlpha(getStageWorldTheme(node.stageIndex).accent, 0.18), borderless: true }}
                    style={({ pressed }) => [
                      styles.lessonNode,
                      pressed && styles.lessonNodePressed,
                      { top: node.nodeTopInRow, width: nodeSize, left: Math.max(4, Math.min(node.centerX - nodeSize / 2, routeWidth - nodeSize - 4)) },
                    ]}
                  >
                    <CheckpointMarker
                      code={node.lesson.code}
                      mirrored={mirrored}
                      status={status}
                      size={nodeSize}
                      theme={theme}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.nodeTitle,
                        { width: nodeTitleWidth, color: isLocked ? colors.textMuted : colors.text },
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
                style={[styles.movingCar, { left: carLeft, top: carTop, width: carWidth, height: carSize }]}
              >
                <View
                  style={[styles.carShadow, { width: carWidth - 8, backgroundColor: theme === 'dark' ? '#040C0C' : '#1E3436' }]}
                />
                <Image
                  source={require('../../assets/images/route-car.png')}
                  style={[styles.carImage, { width: carWidth, height: carSize }]}
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
          style={[
            styles.lessonSheet,
            {
              backgroundColor: sheetSurface,
              borderTopColor: colorWithAlpha(selectedFlagPalette.shade, 0.26),
              shadowColor: theme === 'dark' ? '#000000' : selectedFlagPalette.shade,
              shadowOpacity: theme === 'dark' ? 0.55 : 0.16,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: -8 },
              elevation: 14,
            },
          ]}
        >
          <Svg style={styles.sheetAccentBar} preserveAspectRatio="none" viewBox="0 0 100 6">
            <Defs>
              <LinearGradient id="lesson-sheet-accent" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={selectedFlagPalette.main} />
                <Stop offset="1" stopColor={selectedFlagPalette.shade} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="6" fill="url(#lesson-sheet-accent)" />
          </Svg>
          <View style={styles.sheetHeaderRow}>
            <View
              style={[
                styles.sheetStageChip,
                {
                  backgroundColor: colorWithAlpha(selectedFlagPalette.main, theme === 'dark' ? 0.18 : 0.12),
                  borderColor: colorWithAlpha(selectedFlagPalette.main, 0.3),
                },
              ]}
            >
              <Text style={[styles.sheetStage, { color: sheetAccentInk }]}>
                {`CHẶNG ${selectedFlag.stageIndex + 1}`}
              </Text>
              <Text style={[styles.sheetStageName, { color: sheetAccentInk }]}>
                {getStageWorldTheme(selectedFlag.stageIndex).name}
              </Text>
            </View>
            <View
              style={[
                styles.sheetStateChip,
                {
                  backgroundColor: colorWithAlpha(selectedFlagPalette.main, theme === 'dark' ? 0.16 : 0.1),
                  borderColor: colorWithAlpha(selectedFlagPalette.main, 0.24),
                },
              ]}
            >
              <Text style={[styles.sheetStateText, { color: sheetAccentInk }]}>
                {selectedFlag.lesson.state.status === 'completed'
                  ? `Điểm ${selectedFlag.lesson.state.score ?? 0}`
                  : 'Sẵn sàng'}
              </Text>
            </View>
          </View>
          <Text numberOfLines={2} style={[styles.sheetTitle, { color: colors.text }]}>
            {selectedFlag.lesson.title}
          </Text>
          <Text style={[styles.sheetMeta, { color: colors.textMuted }]}>
            {`Chủ đề: ${selectedFlag.lesson.topic} · ${selectedFlag.lesson.total_questions} câu hỏi`}
          </Text>
          <View style={styles.sheetActions}>
            <Pressable
              accessibilityRole="button"
              onPress={startSelectedLesson}
              style={[
                styles.sheetStartButton,
                {
                  backgroundColor: selectedFlagPalette.shade,
                  borderBottomColor: mixHex(selectedFlagPalette.shade, '#05080B', 0.35),
                },
                surfaceLift(selectedFlagPalette.shade),
              ]}
            >
              <Text style={styles.sheetStartText}>
                {selectedFlag.lesson.state.status === 'completed' ? 'Làm lại' : 'Bắt đầu'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={dismissSheet}
              style={[
                styles.sheetCloseButton,
                {
                  backgroundColor: colorWithAlpha(colors.textMuted, theme === 'dark' ? 0.1 : 0.07),
                  borderColor: colorWithAlpha(colors.textMuted, 0.3),
                },
              ]}
            >
              <Text style={[styles.sheetCloseText, { color: sheetAccentInk }]}>Đóng</Text>
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
  stageHeading: {
    height: STAGE_LABEL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  stageHeadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 5,
    borderRadius: 18,
    borderWidth: 1,
  },
  stageIndexChip: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  stageIndexText: {
    fontSize: 11,
    fontWeight: '900',
  },
  stageEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  stageName: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  lessonNode: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 2,
  },
  lessonNodePressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  nodeTitle: {
    marginTop: 7,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
  },
  movingCar: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  carShadow: {
    position: 'absolute',
    bottom: 9,
    height: 17,
    borderRadius: 9,
    opacity: 0.24,
  },
  carImage: {
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
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 22,
    gap: 5,
    overflow: 'hidden',
  },
  sheetAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 5,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sheetStageChip: {
    flexDirection: 'column',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 1,
  },
  sheetStage: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sheetStageName: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sheetStateChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 13,
    borderWidth: 1,
  },
  sheetStateText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  sheetMeta: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  sheetStartButton: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderBottomWidth: 4,
  },
  sheetStartText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  sheetCloseButton: {
    minWidth: 88,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
  },
  sheetCloseText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
