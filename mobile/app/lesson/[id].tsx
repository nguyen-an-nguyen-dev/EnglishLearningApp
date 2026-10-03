import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/auth-context';
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

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lessonId = Number(id);
  const router = useRouter();
  const { getCurrentUser } = useAuth();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quiz state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<CheckAnswerFeedback | null>(null);
  const [answersLog, setAnswersLog] = useState<SubmittedAnswer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CompleteLessonResult | null>(null);

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
  }, [lessonId]);

  useEffect(() => {
    if (!result?.stage_completed) return;
    const timeout = setTimeout(returnToLearningPath, 2400);
    return () => clearTimeout(timeout);
  }, [result?.stage_completed, router]);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const progressRatio = totalQuestions > 0 ? (currentIndex + 1) / totalQuestions : 0;

  function handleSelectOption(answerId: number) {
    if (isAnswerChecked) return;
    setSelectedAnswer(String(answerId));
  }

  async function handleCheckAnswer() {
    if (!selectedAnswer || !currentQuestion) return;
    try {
      setChecking(true);
      const feedback = await checkLessonAnswer(lessonId, currentQuestion.id, selectedAnswer);
      setAnswerFeedback(feedback);
      setIsAnswerChecked(true);
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

  function handleRestart() {
    setResult(null);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswerChecked(false);
    setAnswersLog([]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Đang chuẩn bị bài học...</Text>
      </SafeAreaView>
    );
  }

  if (errorMsg || !lesson) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Không thể mở bài học</Text>
        <Text style={styles.errorDescription}>{errorMsg || 'Không tìm thấy dữ liệu.'}</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorIcon}>📚</Text>
        <Text style={styles.errorTitle}>Chưa có câu hỏi</Text>
        <Text style={styles.errorDescription}>Bài học này hiện chưa có nội dung câu hỏi nào.</Text>
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
      <SafeAreaView style={styles.resultScreen}>
        <View style={styles.resultContent}>
          <View style={[styles.resultIconCircle, isCompleted ? styles.resultSuccessIcon : styles.resultRetryIcon]}>
            <Text style={styles.resultIcon}>{isCompleted ? '🎉' : '🔁'}</Text>
          </View>
          <Text style={styles.modalTitle}>{isCompleted ? 'Chúc mừng!' : 'Chưa qua bài học'}</Text>
          <Text style={styles.modalSubtitle}>
            {isStageCompleted
              ? 'Bạn đã hoàn thành toàn bộ stage này. Bản đồ sẽ mở chặng tiếp theo ngay sau đây.'
              : isCompleted
              ? `Bạn đã trả lời đúng tất cả câu hỏi trong bài ${lesson.title}.`
              : 'Bạn cần trả lời đúng tất cả câu hỏi để mở bài tiếp theo. Hãy thử lại bài học này nhé.'}
          </Text>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>ĐIỂM SỐ</Text>
              <Text style={styles.statValue}>{result.score}%</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>SỐ CÂU ĐÚNG</Text>
              <Text style={styles.statValue}>{result.correct_answers}/{result.total_questions}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>KINH NGHIỆM</Text>
              <Text style={styles.statValueXp}>+{result.xp_earned} XP</Text>
            </View>
          </View>

          {result.badges_awarded.length > 0 && (
            <View style={styles.badgeAwards}>
              <Text style={styles.badgeAwardsHeading}>HUY HIỆU MỚI</Text>
              {result.badges_awarded.map((badge) => (
                <View key={badge.code} style={styles.badgeAwardRow}>
                  <Text style={styles.badgeAwardIcon}>{BADGE_ICONS[badge.code] ?? '🏅'}</Text>
                  <View style={styles.badgeAwardCopy}>
                    <Text style={styles.badgeAwardName}>{badge.name}</Text>
                    <Text style={styles.badgeAwardDescription}>{badge.description}</Text>
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
            <Text style={styles.modalSecondaryBtnText}>{isCompleted ? 'Ôn tập bài này' : 'Quay lại lộ trình'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with progress */}
      <View style={styles.header}>
        <Pressable onPress={handleExit} hitSlop={12} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
        </View>
        <View style={styles.counterBadge}>
          <Text style={styles.counterText}>
            {currentIndex + 1}/{totalQuestions}
          </Text>
        </View>
      </View>

      {/* Lesson title hint */}
      <View style={styles.topicBar}>
        <Text style={styles.topicText}>
          {lesson.title} • {lesson.topic}
        </Text>
      </View>

      {/* Question Content */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.questionCard}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {currentQuestion.question_type === 'multiple_choice'
                ? 'CHỌN ĐÁP ÁN ĐÚNG'
                : 'CÂU HỎI TIẾNG ANH'}
            </Text>
          </View>
          <Text style={styles.questionPrompt}>{currentQuestion.question_text}</Text>
        </View>

        {/* Options */}
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
                      isSelected && !isAnswerChecked && styles.optionBadgeTextSelected,
                    ]}
                  >
                    {letter}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.optionText,
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

      </ScrollView>

      {/* Footer Controls */}
      {answerFeedback ? (
        <View style={[styles.feedbackFooter, answerFeedback.is_correct ? styles.feedbackFooterCorrect : styles.feedbackFooterIncorrect]}>
          <Text style={[styles.feedbackTitle, answerFeedback.is_correct ? styles.feedbackTitleCorrect : styles.feedbackTitleIncorrect]}>
            {answerFeedback.is_correct ? '✓  Xuất sắc!' : '✕  Không chính xác'}
          </Text>
          {answerFeedback.is_correct ? (
            <Text style={[styles.feedbackMeaning, styles.feedbackTitleCorrect]}>
              Nghĩa là: {answerFeedback.meaning_vi || currentQuestion.explanation || 'Chưa có bản dịch cho câu này.'}
            </Text>
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
        <View style={styles.footer}>
          <Pressable
            disabled={!selectedAnswer || checking}
            onPress={handleCheckAnswer}
            style={[styles.actionBtn, (!selectedAnswer || checking) && styles.actionBtnDisabled]}
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
