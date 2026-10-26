import { useEffect, useRef, useState } from 'react';
import { AudioModule, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import {
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { findDropTarget, reorderWordIds, TileLayout } from '@/utils/wordOrder';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/contexts/theme-context';
import {
  checkLessonAnswer,
  CheckAnswerFeedback,
  CompleteLessonResult,
  fetchLessonDetail,
  fetchLessonQuestions,
  Lesson,
  Question,
  SubmittedAnswer,
  submitLessonCompletion,
} from '@/services/learning';

const BADGE_ICONS: Record<string, string> = {
  first_lesson: '🎓',
  lessons_10: '🏅',
  xp_100: '💯',
  xp_500: '🏆',
};

function DraggableWordTile({
  word,
  disabled,
  onPress,
  onDrop,
  onMeasure,
  tileStyle,
  textStyle,
}: {
  word: string;
  disabled: boolean;
  onPress: () => void;
  onDrop: (dx: number, dy: number) => void;
  onMeasure: (layout: TileLayout) => void;
  tileStyle: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [dragging, setDragging] = useState(false);
  const latest = useRef({ disabled, onDrop });
  latest.current = { disabled, onDrop };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event, gesture) =>
        !latest.current.disabled && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) >= Math.abs(gesture.dy),
      onPanResponderGrant: () => setDragging(true),
      onPanResponderMove: (_event, gesture) => {
        translateX.setValue(gesture.dx);
        translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_event, gesture) => {
        setDragging(false);
        Animated.parallel([
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
        ]).start();
        latest.current.onDrop(gesture.dx, gesture.dy);
      },
      onPanResponderTerminate: () => {
        setDragging(false);
        translateX.setValue(0);
        translateY.setValue(0);
      },
    }),
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      onLayout={(event) => onMeasure(event.nativeEvent.layout)}
      style={[
        dragging && styles.draggableTileActive,
        { transform: [{ translateX }, { translateY }] },
      ]}
    >
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={tileStyle}>
        <Text style={textStyle}>{word}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lessonId = Number(id);
  const router = useRouter();
  const { getCurrentUser } = useAuth();
  const { theme } = useAppTheme();
  const colors = Colors[theme];

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quiz state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [selectedWordIds, setSelectedWordIds] = useState<number[]>([]);
  const [wordTileOrder, setWordTileOrder] = useState<number[]>([]);
  const slotLayoutsRef = useRef<Array<TileLayout | undefined>>([]);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<CheckAnswerFeedback | null>(null);
  const [answersLog, setAnswersLog] = useState<SubmittedAnswer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CompleteLessonResult | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  function returnToLearningPath() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  }

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      if (!Number.isInteger(lessonId) || lessonId < 1) {
        setErrorMsg('Mã bài học không hợp lệ.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setErrorMsg(null);
        const [lData, qData] = await Promise.all([
          fetchLessonDetail(lessonId),
          fetchLessonQuestions(lessonId),
        ]);
        if (mounted) {
          setLesson(lData);
          setQuestions(qData);
        }
      } catch (err: unknown) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : 'Không thể tải câu hỏi bài học.';
          setErrorMsg(msg);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [lessonId, reloadToken]);

  useEffect(() => {
    if (!result?.stage_completed) return;
    const timeout = setTimeout(returnToLearningPath, 2400);
    return () => clearTimeout(timeout);
  }, [result?.stage_completed, router]);

  const currentQuestion = questions[currentIndex];
  const isListeningQuestion = currentQuestion?.question_type === 'listening';
  const isListenChoiceQuestion = currentQuestion?.question_type === 'listen_choice';
  const isFillChoiceQuestion = currentQuestion?.question_type === 'fill_choice';
  const selectedOptionText = currentQuestion?.answers.find(
    (opt) => String(opt.id) === selectedAnswer,
  )?.answer_text ?? null;
  const totalQuestions = questions.length;
  const progressRatio = totalQuestions > 0 ? (currentIndex + 1) / totalQuestions : 0;
  const audioPlayer = useAudioPlayer(currentQuestion?.audio_url ?? null, { downloadFirst: true });
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const correctAnswerPlayer = useAudioPlayer(require('../../assets/sounds/correct-answer.wav'));
  const incorrectAnswerPlayer = useAudioPlayer(require('../../assets/sounds/wrong-answer.wav'));

  useEffect(() => {
    void AudioModule.setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  useEffect(() => {
    slotLayoutsRef.current = [];
    const usesWordTiles = currentQuestion?.question_type === 'word_order'
      || currentQuestion?.question_type === 'listening';
    if (!usesWordTiles) {
      setSelectedWordIds([]);
      setWordTileOrder([]);
      return;
    }
    setSelectedWordIds([]);
    const shuffledIds = currentQuestion.word_bank.map((_, index) => index);
    for (let index = shuffledIds.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffledIds[index], shuffledIds[swapIndex]] = [shuffledIds[swapIndex], shuffledIds[index]];
    }
    setWordTileOrder(shuffledIds);
  }, [currentQuestion?.id]);

  function handleSelectOption(answerId: number) {
    if (isAnswerChecked) return;
    setSelectedAnswer(String(answerId));
  }

  async function playQuestionAudio() {
    if (!currentQuestion?.audio_url) return;
    try {
      if (audioStatus.playing) {
        audioPlayer.pause();
        return;
      }
      await audioPlayer.seekTo(0);
      audioPlayer.play();
    } catch {
      audioPlayer.play();
    }
  }

  function renderOptions() {
    if (!currentQuestion) return null;
    return (
      <View style={styles.optionsList}>
        {currentQuestion.answers.map((opt, idx) => {
          const isSelected = selectedAnswer === String(opt.id);
          const isCorrectOption = answerFeedback?.correct_answer === opt.answer_text;
          const letter = String.fromCharCode(65 + idx);

          return (
            <Pressable
              key={opt.id}
              onPress={() => handleSelectOption(opt.id)}
              disabled={isAnswerChecked || checking}
              style={[
                styles.optionItem,
                { backgroundColor: colors.cardBackground, borderColor: colors.border },
                isSelected && !isAnswerChecked && styles.optionItemSelected,
                isSelected && answerFeedback?.is_correct && styles.optionItemCorrect,
                isSelected && answerFeedback && !answerFeedback.is_correct && styles.optionItemIncorrect,
                !answerFeedback?.is_correct && isCorrectOption && styles.optionItemCorrect,
              ]}
            >
              <View
                style={[
                  styles.optionBadge,
                  isSelected && !isAnswerChecked && styles.optionBadgeSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionBadgeText,
                    { color: colors.textMuted },
                    isSelected && !isAnswerChecked && styles.optionBadgeTextSelected,
                  ]}
                >
                  {letter}
                </Text>
              </View>
              <Text
                style={[
                  styles.optionText,
                  { color: colors.text },
                  isSelected && !isAnswerChecked && styles.optionTextSelected,
                  isSelected && answerFeedback?.is_correct && styles.optionTextCorrect,
                  isSelected && answerFeedback && !answerFeedback.is_correct && styles.optionTextIncorrect,
                  !answerFeedback?.is_correct && isCorrectOption && styles.optionTextCorrect,
                ]}
              >
                {opt.answer_text}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  function renderBlankedSentence(text: string) {
    return (
      <Text style={[styles.questionPrompt, { color: colors.text }]}>
        {text.split('___').map((segment, segmentIndex, segments) => (
          <Text key={`blank-segment-${segmentIndex}`}>
            {segment}
            {segmentIndex < segments.length - 1 ? (
              selectedOptionText ? (
                <Text style={[styles.fillBlankFilled, { color: colors.text }]}> {selectedOptionText} </Text>
              ) : (
                <Text style={{ color: colors.textMuted }}> ____ </Text>
              )
            ) : null}
          </Text>
        ))}
      </Text>
    );
  }

  function renderAudioButton() {
    if (!currentQuestion?.audio_url) {
      return (
        <Text style={[styles.audioUnavailable, { color: colors.textMuted }]}>
          Âm thanh chưa được cấu hình cho câu hỏi này.
        </Text>
      );
    }
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={audioStatus.playing ? 'Tạm dừng đoạn âm thanh' : 'Phát đoạn âm thanh tiếng Anh'}
        style={[styles.listeningAudioButton, audioStatus.playing && styles.listeningAudioButtonPlaying]}
        onPress={() => {
          void playQuestionAudio();
        }}
      >
        <Text style={styles.listeningAudioIcon}>{audioStatus.playing ? '⏸️' : '🔊'}</Text>
      </Pressable>
    );
  }

  function renderWordEditor() {
    if (!currentQuestion) return null;
    return (
      <>
        <View style={styles.answerSlots}>
          {selectedWordIds.map((wordId, position) => (
            <DraggableWordTile
              key={`selected-${wordId}`}
              word={currentQuestion.word_bank[wordId]}
              disabled={isAnswerChecked || checking}
              onPress={() => handleSelectWord(wordId)}
              onMeasure={(layout) => {
                slotLayoutsRef.current[position] = layout;
              }}
              onDrop={(dx, dy) => handleWordDrop(position, dx, dy)}
              tileStyle={[styles.selectedWordTile, theme === 'dark' && { backgroundColor: '#18333C' }]}
              textStyle={[styles.selectedWordText, { color: colors.text }]}
            />
          ))}
        </View>
        {selectedWordIds.length > 1 ? (
          <Text style={[styles.dragHint, { color: colors.textMuted }]}>
            Kéo một từ đã chọn để đổi vị trí trong câu, chạm để gỡ ra.
          </Text>
        ) : null}
        <View style={styles.wordBank}>
          {wordTileOrder.filter((wordId) => !selectedWordIds.includes(wordId)).map((wordId) => (
            <Pressable
              key={`bank-${wordId}`}
              disabled={isAnswerChecked || checking}
              onPress={() => handleSelectWord(wordId)}
              style={[styles.wordTile, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            >
              <Text style={[styles.wordTileText, { color: colors.text }]}>{currentQuestion.word_bank[wordId]}</Text>
            </Pressable>
          ))}
        </View>
      </>
    );
  }

  function handleSelectWord(wordId: number) {
    if (isAnswerChecked || checking) return;
    const next = selectedWordIds.includes(wordId)
      ? selectedWordIds.filter((id) => id !== wordId)
      : [...selectedWordIds, wordId];
    setSelectedWordIds(next);
    setSelectedAnswer(next.map((id) => currentQuestion.word_bank[id]).join(' '));
  }

  function handleWordDrop(position: number, dx: number, dy: number) {
    if (!currentQuestion || isAnswerChecked || checking) return;
    const base = slotLayoutsRef.current[position];
    if (!base) return;
    const target = findDropTarget(
      slotLayoutsRef.current,
      position,
      base.x + base.width / 2 + dx,
      base.y + base.height / 2 + dy,
    );
    const next = reorderWordIds(selectedWordIds, position, target);
    if (next === selectedWordIds) return;
    setSelectedWordIds(next);
    setSelectedAnswer(next.map((id) => currentQuestion.word_bank[id]).join(' '));
  }

  async function handleCheckAnswer() {
    if (!selectedAnswer?.trim() || !currentQuestion) return;
    try {
      setChecking(true);
      if (audioStatus.playing) {
        audioPlayer.pause();
      }
      const feedback = await checkLessonAnswer(lessonId, currentQuestion.id, selectedAnswer);
      setAnswerFeedback(feedback);
      setIsAnswerChecked(true);
      const chime = feedback.is_correct ? correctAnswerPlayer : incorrectAnswerPlayer;
      const otherChime = feedback.is_correct ? incorrectAnswerPlayer : correctAnswerPlayer;
      if (otherChime.playing) otherChime.pause();
      void chime.seekTo(0).then(() => chime.play()).catch(() => undefined);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể kiểm tra đáp án.';
      Alert.alert('Lỗi kiểm tra đáp án', msg);
    } finally {
      setChecking(false);
    }
  }

  async function handleNextQuestion() {
    if (!currentQuestion || !selectedAnswer) return;

    const newLog = [
      ...answersLog.filter((a) => a.questionId !== currentQuestion.id),
      { questionId: currentQuestion.id, answer: selectedAnswer },
    ];
    setAnswersLog(newLog);

    if (currentIndex + 1 < totalQuestions) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setIsAnswerChecked(false);
      setAnswerFeedback(null);
    } else {
      // Finished all questions, submit
      try {
        setSubmitting(true);
        const res = await submitLessonCompletion(lessonId, newLog);
        setResult(res);
        if (res.lesson_status === 'completed') {
          void getCurrentUser();
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Lỗi khi nộp bài học.';
        Alert.alert('Lỗi nộp bài', msg);
      } finally {
        setSubmitting(false);
      }
    }
  }

  function handleExit() {
    if (result) {
      router.back();
      return;
    }
    Alert.alert(
      'Thoát bài học?',
      'Bạn có chắc chắn muốn rời khỏi bài học này? Tiến độ làm bài hiện tại sẽ không được lưu.',
      [
        { text: 'Ở lại', style: 'cancel' },
        { text: 'Thoát', style: 'destructive', onPress: () => router.back() },
      ],
    );
  }

  // Restarting replays the exact first-entry flow: fresh questions, fresh shuffle, no leftovers.
  function handleRestart() {
    setResult(null);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setSelectedWordIds([]);
    setWordTileOrder([]);
    setIsAnswerChecked(false);
    setAnswerFeedback(null);
    setAnswersLog([]);
    setChecking(false);
    setSubmitting(false);
    setReloadToken((token) => token + 1);
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Đang chuẩn bị bài học...</Text>
      </SafeAreaView>
    );
  }

  if (errorMsg || !lesson) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={[styles.errorTitle, { color: colors.text }]}>Không thể mở bài học</Text>
        <Text style={[styles.errorDescription, { color: colors.textMuted }]}>{errorMsg || 'Không tìm thấy dữ liệu.'}</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={styles.errorIcon}>📚</Text>
        <Text style={[styles.errorTitle, { color: colors.text }]}>Chưa có câu hỏi</Text>
        <Text style={[styles.errorDescription, { color: colors.textMuted }]}>Bài học này hiện chưa có nội dung câu hỏi nào.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Quay lại lộ trình</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (result) {
    const isCompleted = result.lesson_status === 'completed';
    const isStageCompleted = isCompleted && result.stage_completed;

    return (
      <SafeAreaView style={[styles.resultScreen, { backgroundColor: colors.background }]}>
        <View style={[styles.resultContent, { backgroundColor: colors.cardBackground }]}>
          <View style={[styles.resultIconCircle, isCompleted ? styles.resultSuccessIcon : styles.resultRetryIcon]}>
            <Text style={styles.resultIcon}>{isCompleted ? '🎉' : '🔁'}</Text>
          </View>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{isCompleted ? 'Chúc mừng!' : 'Chưa qua bài học'}</Text>
          <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
            {isStageCompleted
              ? 'Bạn đã hoàn thành toàn bộ stage này. Bản đồ sẽ mở chặng tiếp theo ngay sau đây.'
              : isCompleted
              ? `Bạn đã trả lời đúng tất cả câu hỏi trong bài ${lesson.title}.`
              : 'Bạn cần trả lời đúng tất cả câu hỏi để mở bài tiếp theo. Hãy thử lại bài học này nhé.'}
          </Text>

          <View style={[styles.statsGrid, { backgroundColor: theme === 'dark' ? '#0D1117' : '#F8FAFC', borderColor: colors.border }]}>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>ĐIỂM SỐ</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{result.score}%</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>SỐ CÂU ĐÚNG</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{result.correct_answers}/{result.total_questions}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>KINH NGHIỆM</Text>
              <Text style={styles.statValueXp}>+{result.xp_earned} XP</Text>
            </View>
          </View>

          {result.badges_awarded.length > 0 && (
            <View style={styles.badgeAwards}>
              <Text style={styles.badgeAwardsHeading}>HUY HIỆU MỚI</Text>
              {result.badges_awarded.map((badge) => (
                <View key={badge.code} style={[styles.badgeAwardRow, { backgroundColor: theme === 'dark' ? '#0D1117' : '#FFFFFF' }]}>
                  <Text style={styles.badgeAwardIcon}>{BADGE_ICONS[badge.code] ?? '🏅'}</Text>
                  <View style={styles.badgeAwardCopy}>
                    <Text style={[styles.badgeAwardName, { color: colors.text }]}>{badge.name}</Text>
                    <Text style={[styles.badgeAwardDescription, { color: colors.textMuted }]}>{badge.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Pressable
            style={styles.modalPrimaryBtn}
            onPress={() => isCompleted ? returnToLearningPath() : handleRestart()}
          >
            <Text style={styles.modalPrimaryBtnText}>
              {isStageCompleted ? 'Về bản đồ ngay' : isCompleted ? 'Tiếp tục lộ trình' : 'Làm lại bài học'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.modalSecondaryBtn}
            onPress={() => isCompleted ? handleRestart() : router.back()}
          >
            <Text style={[styles.modalSecondaryBtnText, { color: colors.textMuted }]}>{isCompleted ? 'Ôn tập bài này' : 'Quay lại lộ trình'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with progress */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Pressable onPress={handleExit} hitSlop={12} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
        </View>
        <View style={styles.counterBadge}>
          <Text style={[styles.counterText, { color: colors.text }]}>
            {currentIndex + 1}/{totalQuestions}
          </Text>
        </View>
      </View>

      {/* Lesson title hint */}
      <View style={styles.topicBar}>
        <Text style={[styles.topicText, { color: colors.textMuted }]}>
          {lesson.title} • {lesson.topic}
        </Text>
      </View>

      {/* Question Content */}
      <ScrollView contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
        {isListeningQuestion ? (
          <View style={styles.wordOrderQuestion}>
            <View style={styles.listeningHero}>
              {renderAudioButton()}
              <Text style={[styles.listeningHint, { color: colors.textMuted }]}>
                Nhấn vào loa để nghe, sau đó chạm từng từ theo đúng thứ tự câu bạn nghe được.
              </Text>
            </View>
            {renderWordEditor()}
          </View>
        ) : isListenChoiceQuestion ? (
          <>
            <View style={styles.listeningQuestion}>
              {renderAudioButton()}
              <Text style={[styles.listeningHint, { color: colors.textMuted }]}>
                Nhấn vào loa để nghe, sau đó chọn từ còn thiếu.
              </Text>
              <View style={[styles.questionCard, styles.listenChoiceCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>NGHE VÀ ĐIỀN TỪ</Text>
                </View>
                {renderBlankedSentence(currentQuestion.question_text)}
              </View>
            </View>
            {renderOptions()}
          </>
        ) : currentQuestion.question_type === 'word_order' ? (
          <View style={styles.wordOrderQuestion}>
            <Text style={[styles.wordOrderPrompt, { color: colors.textMuted }]}>Dịch câu này</Text>
            <View style={[styles.englishSentenceRow, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={[styles.englishSentence, { color: colors.text }]}>{currentQuestion.question_text}</Text>
              {currentQuestion.audio_url ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Nghe phát âm câu tiếng Anh"
                  style={styles.audioButton}
                  onPress={() => {
                    void playQuestionAudio();
                  }}
                >
                  <Text style={styles.audioButtonIcon}>🔊</Text>
                </Pressable>
              ) : null}
            </View>
            {renderWordEditor()}
          </View>
        ) : (
        <>
        <View style={[styles.questionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {currentQuestion.question_type === 'multiple_choice'
                ? 'CHỌN ĐÁP ÁN ĐÚNG'
                : isFillChoiceQuestion
                  ? 'ĐIỀN TỪ CÒN THIẾU'
                  : 'CÂU HỎI TIẾNG ANH'}
            </Text>
          </View>
          {renderBlankedSentence(currentQuestion.question_text)}
        </View>

        {/* Options */}
        {renderOptions()}
        </>
        )}

      </ScrollView>

      {/* Footer Controls */}
      {answerFeedback ? (
        <View style={[styles.feedbackFooter, { backgroundColor: colors.cardBackground, borderTopColor: colors.border }, answerFeedback.is_correct ? styles.feedbackFooterCorrect : styles.feedbackFooterIncorrect]}>
          <Text style={[styles.feedbackTitle, answerFeedback.is_correct ? styles.feedbackTitleCorrect : styles.feedbackTitleIncorrect]}>
            {answerFeedback.is_correct ? '✓  Xuất sắc!' : '✕  Không chính xác'}
          </Text>
          {answerFeedback.is_correct ? (
            answerFeedback.meaning_vi || currentQuestion.explanation ? (
              <Text style={[styles.feedbackMeaning, styles.feedbackTitleCorrect]}>
                Nghĩa là: {answerFeedback.meaning_vi || currentQuestion.explanation}
              </Text>
            ) : (
              <Text style={[styles.feedbackMeaning, styles.feedbackTitleCorrect]}>
                Tốt lắm! Tiếng Anh của bạn đang tiến bộ đấy.
              </Text>
            )
          ) : (
            <Text style={[styles.feedbackMeaning, styles.feedbackTitleIncorrect]}>
              Đáp án: {answerFeedback.correct_answer}
            </Text>
          )}
          <Pressable
            disabled={submitting}
            onPress={handleNextQuestion}
            style={[styles.feedbackButton, answerFeedback.is_correct ? styles.feedbackButtonCorrect : styles.feedbackButtonIncorrect]}
          >
            {submitting ? (
              <ActivityIndicator color="#102c24" size="small" />
            ) : (
              <Text style={styles.feedbackButtonText}>
                {answerFeedback.is_correct ? 'TIẾP TỤC' : 'ĐÃ HIỂU'}
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <Pressable
            disabled={!selectedAnswer?.trim() || checking || (isListeningQuestion && !currentQuestion.audio_url)}
            onPress={handleCheckAnswer}
            style={[
              styles.actionBtn,
              (!selectedAnswer?.trim() || checking || (isListeningQuestion && !currentQuestion.audio_url))
                && styles.actionBtnDisabled,
            ]}
          >
            {checking ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.actionBtnText}>Kiểm tra đáp án</Text>
            )}
          </Pressable>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 14,
    color: '#64748B',
    fontSize: 15,
    fontWeight: '500',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  progressBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 999,
  },
  counterBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  topicBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topicText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 250,
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  wordOrderQuestion: {
    minHeight: 420,
    paddingTop: 18,
  },
  listeningQuestion: {
    minHeight: 420,
    alignItems: 'center',
    paddingTop: 48,
  },
  listenChoiceCard: {
    alignSelf: 'stretch',
    marginTop: 6,
  },
  listeningAudioButton: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: 8,
  },
  listeningAudioButtonPlaying: {
    backgroundColor: Colors.primary,
  },
  listeningAudioIcon: {
    fontSize: 46,
  },
  audioUnavailable: {
    textAlign: 'center',
    padding: 20,
  },
  listeningHint: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 18,
    marginBottom: 16,
  },
  listeningHero: {
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  wordOrderPrompt: {
    color: '#17232b',
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 28,
  },
  englishSentenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 78,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#33454e',
    borderRadius: 18,
    backgroundColor: '#fff',
  },
  englishSentence: {
    flex: 1,
    color: '#17232b',
    fontSize: 19,
    lineHeight: 27,
    fontWeight: '600',
  },
  audioButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dff5fa',
  },
  audioButtonIcon: {
    fontSize: 23,
  },
  answerSlots: {
    minHeight: 104,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    gap: 8,
    marginTop: 36,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderColor: '#aab6bc',
  },
  wordBank: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 42,
  },
  wordTile: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderWidth: 2,
    borderColor: '#aab6bc',
    borderBottomWidth: 5,
    borderRadius: 13,
    backgroundColor: '#fff',
  },
  selectedWordTile: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderBottomWidth: 4,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
  },
  draggableTileActive: {
    zIndex: 10,
    elevation: 6,
    opacity: 0.95,
  },
  dragHint: {
    fontSize: 13,
    textAlign: 'center',
  },
  wordTileText: {
    color: '#23323a',
    fontSize: 17,
    fontWeight: '600',
  },
  selectedWordText: {
    color: Colors.primaryDark,
    fontSize: 17,
    fontWeight: '700',
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  typeBadgeText: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  questionPrompt: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 28,
  },
  fillBlankFilled: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 6,
    fontWeight: '800',
  },
  optionsList: {
    gap: 12,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  optionItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  optionItemChecked: {
    borderColor: Colors.primaryDark,
    backgroundColor: '#EBF8FF',
  },
  optionItemCorrect: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  optionItemIncorrect: {
    borderColor: '#e65c5b',
    backgroundColor: '#fff0ef',
  },
  optionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBadgeSelected: {
    backgroundColor: Colors.primary,
  },
  optionBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  optionBadgeTextSelected: {
    color: '#FFFFFF',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
  },
  optionTextSelected: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  optionTextChecked: {
    color: '#0F172A',
    fontWeight: '700',
  },
  optionTextCorrect: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  optionTextIncorrect: {
    color: '#b7353b',
    fontWeight: '800',
  },
  explanationBox: {
    marginTop: 18,
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  explanationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#854D0E',
    marginBottom: 4,
  },
  explanationBody: {
    fontSize: 14,
    color: '#713F12',
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  actionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  feedbackFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    borderTopWidth: 1,
    backgroundColor: '#203038',
  },
  feedbackFooterCorrect: {
    borderTopColor: Colors.primary,
  },
  feedbackFooterIncorrect: {
    borderTopColor: '#ee5a59',
  },
  feedbackTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    marginBottom: 8,
  },
  feedbackTitleCorrect: {
    color: Colors.primary,
  },
  feedbackTitleIncorrect: {
    color: '#f0605e',
  },
  feedbackMeaning: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    marginBottom: 16,
  },
  feedbackButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  feedbackButtonCorrect: {
    backgroundColor: Colors.primary,
  },
  feedbackButtonIncorrect: {
    backgroundColor: '#f05c5b',
  },
  feedbackButtonText: {
    color: '#14252a',
    fontSize: 16,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 26,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 8,
  },
  resultIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  resultIcon: {
    fontSize: 42,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  statValueXp: {
    fontSize: 20,
    fontWeight: '800',
    color: '#D97706',
  },
  badgeAwards: {
    width: '100%',
    gap: 8,
    marginTop: -8,
    marginBottom: 18,
  },
  badgeAwardsHeading: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
  },
  badgeAwardRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  badgeAwardIcon: {
    fontSize: 21,
  },
  badgeAwardCopy: {
    flex: 1,
    minWidth: 0,
  },
  badgeAwardName: {
    color: '#203447',
    fontSize: 12,
    fontWeight: '900',
  },
  badgeAwardDescription: {
    color: '#71818d',
    fontSize: 10,
    marginTop: 2,
  },
  modalPrimaryBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSecondaryBtn: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryBtnText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
  resultScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#eef3f4',
  },
  resultContent: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    padding: 26,
    borderRadius: 24,
    backgroundColor: '#fff',
    shadowColor: '#16232d',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 5,
  },
  resultSuccessIcon: {
    backgroundColor: '#dcfce7',
  },
  resultRetryIcon: {
    backgroundColor: '#e0f2fe',
  },
});
