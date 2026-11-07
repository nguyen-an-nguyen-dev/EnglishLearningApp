import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ScrollViewInstance,
} from 'react-native';
import { useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { useAppDialog } from '@/contexts/app-dialog-context';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/contexts/theme-context';
import {
  createAiChat,
  deleteAiChat,
  getAiChat,
  getAiFeedback,
  getStudyPlan,
  listAiChats,
  sendAiMessage,
  type AiChat,
  type AiFeedback,
  type AiMessage,
  type ChatContext,
  type ChatIntent,
  type ChatTab,
  type StudyPlan,
  type StudyStep,
} from '@/services/ai';
import { fetchLessonDetail, fetchUserProgress, type Lesson, type UserProgress } from '@/services/learning';

type BuddyView = 'chat' | 'plan' | 'history';
type BuddyBubble = {
  id: number | string;
  role: 'USER' | 'AI';
  content: string;
  feedback?: AiFeedback[];
};
type QuickAction = {
  key: string;
  label: string;
  prompt: string;
  intent: ChatIntent;
};

const LAUNCHER_SIZE = 82;
const TAB_BAR_HEIGHT = 68;
const HINTS = ['Ê, học chút không?', 'Có 3 việc hôm nay nè', 'Mình sửa lỗi giúp nha'];

function quickActions(tab: ChatTab): QuickAction[] {
  const plan: QuickAction = {
    key: 'plan',
    label: 'Học gì trước?',
    prompt: 'Hôm nay mình nên học gì trước, học như thế nào, và mỗi việc tốn bao lâu?',
    intent: 'plan',
  };
  const how: QuickAction = {
    key: 'how',
    label: 'Học kiểu gì?',
    prompt: 'Đang ở màn hình này thì mình nên học như thế nào cho hiệu quả?',
    intent: 'how',
  };
  const explain: QuickAction = {
    key: 'explain',
    label: 'Giảng lại chủ đề',
    prompt: 'Giải thích ngắn gọn chủ đề mình đang xem, kèm vài fact thú vị và một ví dụ tiếng Anh dễ hiểu.',
    intent: 'explain',
  };
  const practice: QuickAction = {
    key: 'practice',
    label: 'Ra bài tập nha',
    prompt: 'Ra cho mình một bài tập ngắn đúng trình độ của mình, rồi giấu đáp án ở cuối.',
    intent: 'practice',
  };
  const video: QuickAction = {
    key: 'video',
    label: 'Nói về video này',
    prompt: 'Video mình đang xem nói về gì, và mình nên chú ý những từ nào khi nghe?',
    intent: 'explain',
  };
  const word: QuickAction = {
    key: 'word',
    label: 'Giải thích từ này',
    prompt: 'Giải thích từ hoặc đoạn mình đang dịch, kèm cách dùng trong câu.',
    intent: 'explain',
  };
  const recap: QuickAction = {
    key: 'recap',
    label: 'Đọc kết quả của mình',
    prompt: 'Đọc giúp mình kết quả học tập hiện tại và nói xem mình đang mạnh, yếu ở đâu.',
    intent: 'explain',
  };
  const next: QuickAction = {
    key: 'next',
    label: 'Lộ trình tiếp theo',
    prompt: 'Sau những gì đã học, lộ trình tiếp theo của mình nên đi theo hướng nào?',
    intent: 'plan',
  };

  switch (tab) {
    case 'videos':
      return [video, how, practice];
    case 'translate':
      return [word, practice, plan];
    case 'compete':
      return [how, practice, plan];
    case 'rankings':
    case 'profile':
      return [recap, next, how];
    default:
      return [plan, how, explain];
  }
}

function toBubbles(messages: AiMessage[]): BuddyBubble[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
  }));
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function feedbackLabel(type: AiFeedback['type']): string {
  return {
    GRAMMAR: 'Ngữ pháp',
    VOCABULARY: 'Từ vựng',
    TENSE: 'Thì',
    WORD_ORDER: 'Trật tự từ',
    OTHER: 'Gợi ý',
  }[type];
}

export default function FloatingStudyBuddy() {
  const { theme } = useAppTheme();
  const colors = Colors[theme];
  const dark = theme === 'dark';
  const { token, user } = useAuth();
  const { showAppDialog } = useAppDialog();
  const router = useRouter();
  const segments = useSegments();
  const params = useGlobalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [visible, setVisible] = useState(false);
  const [view, setView] = useState<BuddyView>('chat');
  const [hintIndex, setHintIndex] = useState(0);
  const [position, setPosition] = useState(() => ({
    x: Math.max(8, width - LAUNCHER_SIZE - 8),
    y: Math.max(insets.top + 8, height - insets.bottom - TAB_BAR_HEIGHT - LAUNCHER_SIZE - 8),
  }));
  const [chats, setChats] = useState<AiChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [bubbles, setBubbles] = useState<BuddyBubble[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);

  const initializedRef = useRef(false);
  const wasVisibleRef = useRef(false);
  const positionRef = useRef(position);
  const dragOriginRef = useRef(position);
  const movedRef = useRef(false);
  const threadRef = useRef<ScrollViewInstance | null>(null);
  const breathe = useRef(new Animated.Value(0)).current;

  const route = segments.map(String).join('/');
  const routeTab: ChatTab = route.includes('battle')
    ? 'compete'
    : route.includes('translate')
      ? 'translate'
      : route.includes('ranking')
        ? 'rankings'
        : route.includes('settings')
          ? 'profile'
          : 'study';
  const inTabs = segments.some((segment) => String(segment) === '(tabs)');

  const nextLesson = useMemo(
    () => progress?.stages.flatMap((stage) => stage.lessons)
      .find((item) => item.state.status !== 'completed'),
    [progress],
  );
  const focusLabel = route.includes('lesson')
    ? lesson?.title ?? nextLesson?.title ?? 'Bài học'
    : routeTab === 'translate'
      ? 'Dịch tài liệu'
      : routeTab === 'compete'
        ? 'Đấu trường từ vựng'
        : routeTab === 'rankings'
          ? 'Bảng xếp hạng'
          : routeTab === 'profile'
            ? 'Hồ sơ cá nhân'
            : nextLesson?.title ?? 'Lộ trình học';
  const actions = useMemo(() => quickActions(routeTab), [routeTab]);
  const panelBackground = { backgroundColor: colors.cardBackground, borderColor: colors.border };
  const softBackground = { backgroundColor: dark ? '#13212B' : '#F3FAFC' };
  const panelHeight = Math.max(360, Math.min(640, height - insets.top - insets.bottom - 28));
  const launcherBounds = useRef({ width, height, top: insets.top, bottom: insets.bottom, inTabs });
  launcherBounds.current = { width, height, top: insets.top, bottom: insets.bottom, inTabs };

  useEffect(() => {
    const minY = insets.top + 8;
    const maxY = Math.max(minY, height - insets.bottom - (inTabs ? TAB_BAR_HEIGHT : 8) - LAUNCHER_SIZE);
    setPosition((current) => {
      const next = {
        x: Math.min(Math.max(0, current.x), Math.max(0, width - LAUNCHER_SIZE)),
        y: Math.min(Math.max(minY, current.y), maxY),
      };
      positionRef.current = next;
      return next;
    });
  }, [height, inTabs, insets.bottom, insets.top, width]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2100, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2100, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [breathe]);

  useEffect(() => {
    const timer = setInterval(() => setHintIndex((current) => (current + 1) % HINTS.length), 7000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void fetchUserProgress()
      .then((data) => {
        if (active) setProgress(data);
      })
      .catch((loadError: unknown) => {
        console.warn('Could not load learning context for En Buddy:', loadError);
      });
    return () => { active = false; };
  }, [token]);

  const rawLessonId = Array.isArray(params.id) ? params.id[0] : params.id;
  const lessonId = route.includes('lesson') ? Number(rawLessonId) : NaN;
  useEffect(() => {
    if (!Number.isInteger(lessonId) || lessonId < 1) {
      setLesson(null);
      return;
    }
    let active = true;
    void fetchLessonDetail(lessonId)
      .then((data) => {
        if (active) setLesson(data);
      })
      .catch((loadError: unknown) => {
        console.warn('Could not load current lesson context for En Buddy:', loadError);
      });
    return () => { active = false; };
  }, [lessonId]);

  const chatContext: ChatContext = useMemo(() => {
    if (route.includes('lesson')) {
      return {
        tab: 'study',
        focus: lesson ? `Bài học: ${lesson.title}` : `Bài học: ${focusLabel}`,
        detail: [
          'Người dùng đang làm bài học tương tác trên ứng dụng di động.',
          lesson ? `Tên bài học: "${lesson.title}"` : '',
          lesson ? `Chủ đề: ${lesson.topic}` : '',
          lesson ? `Số câu hỏi: ${lesson.total_questions}` : '',
        ].filter(Boolean).join(' | '),
      };
    }
    const tabDetails: Record<ChatTab, string> = {
      study: `Người dùng đang ở lộ trình học tiếng Anh.${nextLesson ? ` Bài tiếp theo: "${nextLesson.title}".` : ''}`,
      videos: 'Ứng dụng di động hiện không có màn học video.',
      translate: 'Người dùng đang ở công cụ dịch Anh - Việt trên ứng dụng di động.',
      compete: 'Người dùng đang ở khu vực đấu trường từ vựng 1v1 trên ứng dụng di động.',
      rankings: 'Người dùng đang xem bảng xếp hạng trên ứng dụng di động.',
      profile: 'Người dùng đang ở khu vực hồ sơ và cài đặt trên ứng dụng di động.',
    };
    return {
      tab: routeTab,
      focus: focusLabel,
      detail: [
        tabDetails[routeTab],
        user?.name ? `Tên học viên: ${user.name}` : '',
        routeTab === 'study' && progress
          ? `Tiến độ: ${progress.completed_lesson_ids.length}/${progress.stages.reduce((sum, stage) => sum + stage.lessons.length, 0)} bài học.`
          : '',
      ].filter(Boolean).join(' | '),
    };
  }, [focusLabel, lesson, nextLesson, progress, route, routeTab, user?.name]);

  const loadPlan = useCallback(async () => {
    setPlanLoading(true);
    setPlanError(null);
    try {
      setPlan(await getStudyPlan());
    } catch (loadError) {
      setPlanError(loadError instanceof Error ? loadError.message : 'Không tải được kế hoạch học.');
    } finally {
      setPlanLoading(false);
    }
  }, []);

  const loadChats = useCallback(async () => {
    setHistoryError(null);
    try {
      const list = (await listAiChats()).filter((chat) => chat.topic === 'STUDY_COACH');
      setChats(list);
      const latest = list[0];
      if (latest) {
        setActiveChatId(latest.id);
        const data = await getAiChat(latest.id);
        setBubbles(toBubbles(data.messages));
      } else {
        setActiveChatId(null);
        setBubbles([]);
      }
    } catch (loadError) {
      setHistoryError(loadError instanceof Error ? loadError.message : 'Không thể tải lịch sử hội thoại.');
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    const reopened = !wasVisibleRef.current;
    wasVisibleRef.current = true;
    if (!initializedRef.current) {
      initializedRef.current = true;
      void loadChats();
    }
    if (reopened) void loadPlan();
  }, [loadChats, loadPlan, visible]);

  useEffect(() => {
    if (view === 'chat') threadRef.current?.scrollToEnd({ animated: true });
  }, [bubbles, sending, view]);

  const openBuddy = useCallback(() => {
    setView('chat');
    setVisible(true);
  }, []);

  const closeBuddy = useCallback(() => {
    Keyboard.dismiss();
    setVisible(false);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_event, gesture) =>
        Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
      onPanResponderGrant: () => {
        dragOriginRef.current = positionRef.current;
        movedRef.current = false;
      },
      onPanResponderMove: (_event, gesture) => {
        if (Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5) movedRef.current = true;
        const bounds = launcherBounds.current;
        const minY = bounds.top + 8;
        const maxY = Math.max(
          minY,
          bounds.height - bounds.bottom - (bounds.inTabs ? TAB_BAR_HEIGHT : 8) - LAUNCHER_SIZE,
        );
        const next = {
          x: Math.min(Math.max(0, dragOriginRef.current.x + gesture.dx), Math.max(0, bounds.width - LAUNCHER_SIZE)),
          y: Math.min(Math.max(minY, dragOriginRef.current.y + gesture.dy), maxY),
        };
        positionRef.current = next;
        setPosition(next);
      },
      onPanResponderRelease: (_event, gesture) => {
        if (Math.abs(gesture.dx) <= 5 && Math.abs(gesture.dy) <= 5 && !movedRef.current) openBuddy();
        movedRef.current = false;
      },
      onPanResponderTerminate: () => { movedRef.current = false; },
    }),
  ).current;

  async function send(text: string, intent: ChatIntent = 'chat') {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    const optimisticId = `local-${Date.now()}`;
    setBubbles((current) => [...current, { id: optimisticId, role: 'USER', content: trimmed }]);
    setInput('');
    try {
      let chatId = activeChatId;
      if (!chatId) {
        const chat = await createAiChat('STUDY_COACH');
        chatId = chat.id;
        setActiveChatId(chat.id);
        setChats((current) => [chat, ...current]);
      }
      const result = await sendAiMessage(chatId, trimmed, intent, chatContext);
      setBubbles((current) => [
        ...current.filter((bubble) => bubble.id !== optimisticId),
        { id: result.userMessage.id, role: 'USER', content: result.userMessage.content },
        {
          id: result.aiMessage.id,
          role: 'AI',
          content: result.aiMessage.content,
          feedback: result.feedback,
        },
      ]);
      void refreshChats();
    } catch (sendError) {
      setBubbles((current) => current.filter((bubble) => bubble.id !== optimisticId));
      setInput(trimmed);
      setError(sendError instanceof Error ? sendError.message : 'Tin nhắn chưa gửi được. Thử lại nhé.');
    } finally {
      setSending(false);
    }
  }

  async function refreshChats() {
    try {
      setChats((await listAiChats()).filter((chat) => chat.topic === 'STUDY_COACH'));
    } catch (loadError) {
      setHistoryError(loadError instanceof Error ? loadError.message : 'Không thể tải lịch sử hội thoại.');
    }
  }

  async function openChat(chat: AiChat) {
    setHistoryError(null);
    try {
      const [data, feedback] = await Promise.all([getAiChat(chat.id), getAiFeedback(chat.id)]);
      setActiveChatId(chat.id);
      setBubbles(data.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        feedback: message.role === 'AI'
          ? feedback.filter((item) => item.message_id === data.messages.find((entry) => entry.role === 'USER' && entry.id < message.id)?.id)
          : [],
      })));
      setView('chat');
    } catch (loadError) {
      setHistoryError(loadError instanceof Error ? loadError.message : 'Không thể mở hội thoại này.');
    }
  }

  async function removeChat(chatId: number) {
    setHistoryError(null);
    try {
      await deleteAiChat(chatId);
      setChats((current) => current.filter((chat) => chat.id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
        setBubbles([]);
      }
    } catch (deleteError) {
      setHistoryError(deleteError instanceof Error ? deleteError.message : 'Không thể xóa hội thoại.');
    }
  }

  function newChat() {
    setActiveChatId(null);
    setBubbles([]);
    setInput('');
    setError(null);
    setView('chat');
  }

  function performPlanAction(step: StudyStep) {
    if (step.kind === 'video' || step.target.tab === 'videos') {
      showAppDialog({
        title: 'Tính năng video chưa có trên mobile',
        message: 'Video học hiện chỉ dùng được trên web. Bạn vẫn có thể xem kế hoạch và tiếp tục các hoạt động khác trong mobile.',
        buttons: [{ text: 'Đã hiểu' }],
      });
      return;
    }
    const navigate = () => {
      setVisible(false);
      if (step.target.lessonId) {
        router.push({ pathname: '/lesson/[id]', params: { id: String(step.target.lessonId) } });
        return;
      }
      switch (step.target.tab) {
        case 'study':
          router.replace('/(tabs)');
          break;
        case 'translate':
          router.replace('/(tabs)/translate');
          break;
        case 'compete':
          router.replace('/battle');
          break;
        case 'rankings':
          router.replace('/(tabs)/ranking');
          break;
        case 'profile':
          router.replace('/(tabs)/settings');
          break;
      }
    };

    if (route.includes('battle')) {
      showAppDialog({
        title: 'Rời khỏi trận đấu?',
        message: 'Chuyển sang hoạt động khác sẽ rời khỏi trận đấu hiện tại.',
        buttons: [
          { text: 'Ở lại', style: 'cancel' },
          { text: 'Rời trận', style: 'destructive', onPress: navigate },
        ],
      });
      return;
    }
    navigate();
  }

  const isLeftSide = position.x < width / 2;
  const breatheStyle = {
    transform: [{
      translateY: breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }),
    }],
  };

  if (!token) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {!visible ? (
        <View
          {...panResponder.panHandlers}
          style={[styles.launcher, { left: position.x, top: position.y }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gọi En Buddy"
            onPress={openBuddy}
            style={styles.launcherHitArea}
          >
            <Animated.View style={[styles.launcherCarWrap, breatheStyle]}>
              <Image
                accessible={false}
                source={require('../assets/images/logo.png')}
                style={styles.launcherCar}
                resizeMode="contain"
              />
            </Animated.View>
            <View pointerEvents="none" style={[styles.hintBubble, isLeftSide ? styles.hintOnRight : styles.hintOnLeft]}>
              <Text numberOfLines={1} style={styles.hintText}>{HINTS[hintIndex]}</Text>
            </View>
            <View pointerEvents="none" style={styles.launcherShadow} />
          </Pressable>
        </View>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={closeBuddy}
        statusBarTranslucent
        transparent
        visible={visible}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalRoot, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
        >
          <Pressable accessibilityLabel="Đóng En Buddy" onPress={closeBuddy} style={styles.scrim} />
          <View style={[styles.panel, panelBackground, { height: panelHeight, maxHeight: panelHeight }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Image source={require('../assets/images/logo.png')} style={styles.headerCar} resizeMode="contain" />
              <View style={styles.headerCopy}>
                <Text style={[styles.title, { color: colors.text }]}>En Buddy</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>Đang ngồi cạnh bạn đây</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={closeBuddy} style={styles.closeButton}>
                <Text style={[styles.closeText, { color: colors.textMuted }]}>×</Text>
              </Pressable>
            </View>

            <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
              {([
                ['chat', 'Tán gẫu', '◉'],
                ['plan', 'Kế hoạch', '☷'],
                ['history', 'Chuyện cũ', '◷'],
              ] as const).map(([id, label, icon]) => (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: view === id }}
                  key={id}
                  onPress={() => setView(id)}
                  style={[styles.tab, view === id && { backgroundColor: dark ? '#233542' : '#E5F5F9' }]}
                >
                  <Text style={[styles.tabText, { color: view === id ? colors.tint : colors.textMuted }]}>
                    {icon}  {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {view === 'chat' ? (
              <View style={styles.body}>
                <ScrollView
                  ref={threadRef}
                  contentContainerStyle={styles.thread}
                  keyboardShouldPersistTaps="handled"
                  onContentSizeChange={() => threadRef.current?.scrollToEnd({ animated: true })}
                >
                  {bubbles.length === 0 && !sending ? (
                    <View style={styles.empty}>
                      <Image source={require('../assets/images/logo.png')} style={styles.emptyCar} resizeMode="contain" />
                      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                        Ê! Mình là chú xe chở sách đây. Hỏi mình học gì trước, học kiểu gì, hay nhờ giảng lại chủ đề bạn đang bí nha.
                      </Text>
                    </View>
                  ) : null}
                  {bubbles.map((bubble) => (
                    <View
                      key={bubble.id}
                      style={[styles.turn, bubble.role === 'USER' ? styles.userTurn : styles.aiTurn]}
                    >
                      {bubble.role === 'AI' ? (
                        <Image source={require('../assets/images/logo.png')} style={styles.turnCar} resizeMode="contain" />
                      ) : null}
                      <View style={[
                        styles.messageBubble,
                        bubble.role === 'USER'
                          ? { backgroundColor: colors.tint, borderColor: colors.tint }
                          : [panelBackground, styles.aiMessage],
                      ]}>
                        <Text style={[styles.messageText, { color: bubble.role === 'USER' ? '#FFFFFF' : colors.text }]}>
                          {bubble.content}
                        </Text>
                        {bubble.feedback?.length ? (
                          <View style={[styles.feedback, { borderTopColor: colors.border }]}>
                            <Text style={[styles.feedbackTitle, { color: colors.tint }]}>Mình sửa giúp nè</Text>
                            {bubble.feedback.map((item, index) => (
                              <View key={`${bubble.id}-feedback-${index}`} style={styles.feedbackItem}>
                                <Text style={[styles.feedbackLine, { color: colors.textMuted }]}>
                                  {item.original_text} → <Text style={{ color: colors.text, fontWeight: '800' }}>{item.corrected_text}</Text>
                                </Text>
                                <Text style={[styles.feedbackLine, { color: colors.textMuted }]}>
                                  {feedbackLabel(item.type)} · {item.explanation}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ))}
                  {sending ? (
                    <View style={[styles.typing, panelBackground]}>
                      <ActivityIndicator size="small" color={colors.tint} />
                      <Text style={[styles.typingText, { color: colors.textMuted }]}>Đang lật sổ tay…</Text>
                    </View>
                  ) : null}
                </ScrollView>

                {error ? (
                  <View style={[styles.errorBox, { backgroundColor: dark ? '#351C1C' : '#FFF1F0' }]}>
                    <Text accessibilityRole="alert" style={[styles.errorText, { color: dark ? '#FF9A93' : '#A52E3C' }]}>{error}</Text>
                    <Pressable accessibilityLabel="Đóng thông báo lỗi" onPress={() => setError(null)}>
                      <Text style={[styles.dismissError, { color: colors.textMuted }]}>×</Text>
                    </Pressable>
                  </View>
                ) : null}

                <ScrollView
                  horizontal
                  contentContainerStyle={styles.quickActions}
                  showsHorizontalScrollIndicator={false}
                >
                  {actions.map((action) => (
                    <Pressable
                      accessibilityRole="button"
                      disabled={sending}
                      key={action.key}
                      onPress={() => void send(action.prompt, action.intent)}
                      style={[styles.quickChip, { backgroundColor: dark ? '#162B36' : '#E9F8FC', borderColor: colors.border }]}
                    >
                      <Text style={[styles.quickText, { color: colors.tint }]}>{action.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <View style={[styles.composerWrap, { borderTopColor: colors.border }]}>
                  <View style={[styles.composer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <TextInput
                      accessibilityLabel="Kể mình nghe bạn đang thắc mắc gì"
                      editable={!sending}
                      maxLength={2000}
                      onChangeText={setInput}
                      onSubmitEditing={() => void send(input)}
                      placeholder="Kể mình nghe bạn đang thắc mắc gì…"
                      placeholderTextColor={colors.textMuted}
                      returnKeyType="send"
                      style={[styles.input, { color: colors.text }]}
                      value={input}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Gửi tin nhắn"
                      disabled={!input.trim() || sending}
                      onPress={() => void send(input)}
                      style={[styles.sendButton, { backgroundColor: colors.tint, opacity: !input.trim() || sending ? 0.45 : 1 }]}
                    >
                      <Text style={styles.sendText}>➤</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : null}

            {view === 'plan' ? (
              <ScrollView contentContainerStyle={styles.planBody}>
                <Text style={[styles.planTitle, { color: colors.text }]}>3 việc nho nhỏ thôi!</Text>
                {plan ? (
                  <>
                    <Text style={[styles.planLead, { color: colors.textMuted }]}>
                      Bạn đã hoàn thành {plan.snapshot.completedLessons}/{plan.snapshot.totalLessons} bài học.
                    </Text>
                    <View style={[styles.planNote, softBackground]}>
                      <Image source={require('../assets/images/logo.png')} style={styles.planCar} resizeMode="contain" />
                      <Text style={[styles.planNoteText, { color: colors.text }]}>
                        <Text style={{ color: colors.tint, fontWeight: '900' }}>
                          {plan.aiNote ? 'En Buddy gợi ý:' : 'Kế hoạch theo tiến độ của bạn:'}
                        </Text>
                        {plan.aiNote ? ` ${plan.aiNote}` : ''}
                      </Text>
                    </View>
                  </>
                ) : null}
                {planLoading && !plan ? (
                  <View style={styles.planLoading}>
                    <ActivityIndicator color={colors.tint} />
                    <Text style={[styles.planLead, { color: colors.textMuted }]}>Đang lật sổ…</Text>
                  </View>
                ) : null}
                {planError ? (
                  <View style={[styles.errorBox, { backgroundColor: dark ? '#351C1C' : '#FFF1F0' }]}>
                    <Text accessibilityRole="alert" style={[styles.errorText, { color: dark ? '#FF9A93' : '#A52E3C' }]}>{planError}</Text>
                    <Pressable accessibilityRole="button" onPress={() => void loadPlan()}>
                      <Text style={[styles.retryText, { color: colors.tint }]}>Thử lại nha</Text>
                    </Pressable>
                  </View>
                ) : null}
                {plan?.steps.map((step, index) => (
                  <View key={step.id} style={[styles.planStep, { borderBottomColor: colors.border }]}>
                    <View style={[styles.stepIndex, { backgroundColor: dark ? '#1A3B47' : '#E1F7FC' }]}>
                      <Text style={[styles.stepIndexText, { color: colors.tint }]}>{String(index + 1).padStart(2, '0')}</Text>
                    </View>
                    <View style={styles.stepCopy}>
                      <Text style={[styles.stepTitle, { color: colors.text }]}>{step.title}</Text>
                      <Text style={[styles.stepReason, { color: colors.textMuted }]}>{step.reason}</Text>
                      <Text style={[styles.stepMinutes, { color: colors.tint }]}>{step.minutes} phút</Text>
                      <Pressable accessibilityRole="button" onPress={() => performPlanAction(step)} style={styles.stepAction}>
                        <Text style={[styles.stepActionText, { color: colors.tint }]}>Làm ngay  ›</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
                <View style={styles.planFooter}>
                  <Pressable accessibilityRole="button" disabled={planLoading} onPress={() => void loadPlan()}>
                    <Text style={[styles.footerAction, { color: colors.tint }]}>
                      {planLoading ? 'Đang lật sổ…' : '↻  Lật lại sổ'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setView('chat');
                      void send('Hôm nay mình nên học gì trước, học như thế nào, và mỗi việc tốn bao lâu?', 'plan');
                    }}
                  >
                    <Text style={[styles.footerAction, { color: colors.tint }]}>Hỏi mình thêm</Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : null}

            {view === 'history' ? (
              <View style={styles.historyBody}>
                {historyError ? (
                  <Text accessibilityRole="alert" style={[styles.errorText, { color: dark ? '#FF9A93' : '#A52E3C' }]}>{historyError}</Text>
                ) : null}
                <ScrollView style={styles.historyList}>
                  {chats.map((chat) => (
                    <View key={chat.id} style={[styles.historyItem, { borderBottomColor: colors.border }]}>
                      <Pressable accessibilityRole="button" onPress={() => void openChat(chat)} style={styles.historyOpen}>
                        <Text style={[styles.historyDate, { color: colors.textMuted }]}>{formatDate(chat.updated_at)}</Text>
                        <Text numberOfLines={1} style={[styles.historyTitle, { color: chat.id === activeChatId ? colors.tint : colors.text }]}>
                          {chat.title || 'En Buddy'}
                        </Text>
                        <Text numberOfLines={1} style={[styles.historyPreview, { color: colors.textMuted }]}>
                          {chat.last_message || 'Chưa tán câu nào, bắt đầu nha?'}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Xóa câu chuyện này"
                        onPress={() => void removeChat(chat.id)}
                        style={styles.deleteButton}
                      >
                        <Text style={[styles.deleteText, { color: dark ? '#FF9A93' : '#A52E3C' }]}>Xóa</Text>
                      </Pressable>
                    </View>
                  ))}
                  {chats.length === 0 ? (
                    <Text style={[styles.planLead, { color: colors.textMuted }]}>Chưa tán câu nào, bắt đầu nha?</Text>
                  ) : null}
                </ScrollView>
                <Pressable accessibilityRole="button" onPress={newChat} style={styles.newChat}>
                  <Text style={[styles.footerAction, { color: colors.tint }]}>◷  Chuyện mới</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  launcher: {
    position: 'absolute',
    width: LAUNCHER_SIZE,
    height: LAUNCHER_SIZE,
    zIndex: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launcherHitArea: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  launcherCarWrap: { width: 76, height: 76 },
  launcherCar: { width: '100%', height: '100%' },
  launcherShadow: {
    position: 'absolute',
    bottom: 1,
    left: 18,
    width: 46,
    height: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  hintBubble: {
    position: 'absolute',
    top: 3,
    maxWidth: 190,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 17,
    backgroundColor: '#10232E',
    elevation: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 7,
  },
  hintOnLeft: { right: 62 },
  hintOnRight: { left: 62 },
  hintText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  modalRoot: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 10 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5, 18, 27, 0.42)' },
  panel: {
    width: '100%',
    maxWidth: 480,
    minHeight: 420,
    alignSelf: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 24,
    shadowColor: '#00131C',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 16,
  },
  header: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  headerCar: { width: 54, height: 54 },
  headerCopy: { flex: 1, gap: 3 },
  title: { fontSize: 21, fontStyle: 'italic', fontWeight: '800' },
  subtitle: { fontSize: 11 },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  closeText: { fontSize: 28, lineHeight: 32, fontWeight: '400' },
  tabs: { flexDirection: 'row', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 20, paddingHorizontal: 3 },
  tabText: { fontSize: 11, fontWeight: '800' },
  body: { flex: 1, minHeight: 0 },
  thread: { flexGrow: 1, gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  empty: { gap: 8, paddingVertical: 8 },
  emptyCar: { width: 62, height: 62 },
  emptyText: { maxWidth: '92%', fontSize: 12, lineHeight: 19 },
  turn: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, maxWidth: '100%' },
  aiTurn: { alignSelf: 'flex-start' },
  userTurn: { alignSelf: 'flex-end' },
  turnCar: { width: 30, height: 30, marginBottom: 2 },
  messageBubble: { maxWidth: '88%', paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderRadius: 17 },
  aiMessage: { borderBottomLeftRadius: 4 },
  messageText: { fontSize: 12.5, lineHeight: 19 },
  feedback: { gap: 6, marginTop: 10, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth },
  feedbackTitle: { fontSize: 10, fontWeight: '900' },
  feedbackItem: { gap: 2 },
  feedbackLine: { fontSize: 10.5, lineHeight: 16 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginHorizontal: 14, marginBottom: 8, padding: 9, borderWidth: 1, borderRadius: 14 },
  typingText: { fontSize: 11 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  errorText: { flex: 1, fontSize: 11, lineHeight: 16 },
  dismissError: { fontSize: 20, paddingHorizontal: 3 },
  quickActions: { gap: 7, paddingHorizontal: 12, paddingVertical: 9 },
  quickChip: { paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderRadius: 20 },
  quickText: { fontSize: 10.5, fontWeight: '800' },
  composerWrap: { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  composer: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 13, paddingRight: 5, borderWidth: 1, borderRadius: 24 },
  input: { flex: 1, maxHeight: 78, paddingVertical: 8, fontSize: 13 },
  sendButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  sendText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  planBody: { paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 20 },
  planTitle: { fontSize: 21, fontStyle: 'italic', fontWeight: '800' },
  planLead: { marginTop: 5, fontSize: 11.5, lineHeight: 18 },
  planLoading: { alignItems: 'center', gap: 9, paddingVertical: 24 },
  planNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, padding: 11, borderRadius: 15 },
  planCar: { width: 42, height: 42 },
  planNoteText: { flex: 1, fontSize: 11, lineHeight: 17 },
  planStep: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  stepIndex: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  stepIndexText: { fontSize: 12, fontWeight: '900' },
  stepCopy: { flex: 1, gap: 4 },
  stepTitle: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  stepReason: { fontSize: 10.5, lineHeight: 16 },
  stepMinutes: { fontSize: 10, fontWeight: '800' },
  stepAction: { alignSelf: 'flex-start', paddingTop: 4 },
  stepActionText: { fontSize: 11, fontWeight: '900' },
  planFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingTop: 14 },
  footerAction: { fontSize: 11, fontWeight: '800' },
  retryText: { fontSize: 11, fontWeight: '900' },
  historyBody: { flex: 1, paddingHorizontal: 15, paddingVertical: 12 },
  historyList: { flex: 1 },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  historyOpen: { flex: 1, minWidth: 0, gap: 3, paddingVertical: 10 },
  historyDate: { fontSize: 9.5, fontWeight: '700' },
  historyTitle: { fontSize: 12, fontWeight: '800' },
  historyPreview: { fontSize: 10.5 },
  deleteButton: { paddingHorizontal: 6, paddingVertical: 8 },
  deleteText: { fontSize: 10.5, fontWeight: '800' },
  newChat: { alignSelf: 'flex-start', paddingTop: 12 },
});
