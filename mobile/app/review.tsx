import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useAppTheme } from '@/contexts/theme-context';
import { gradeReviewItem, loadDueReview, type DueReviewItem, type ReviewVerdict } from '@/services/review';

function ReviewCard({ item, last, onAdvance }: { item: DueReviewItem; last: boolean; onAdvance: (correct: boolean) => void }) {
  const { theme } = useAppTheme();
  const colors = Colors[theme];
  const [answer, setAnswer] = useState('');
  const [verdict, setVerdict] = useState<ReviewVerdict | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(Date.now());
  const inFlight = useRef(false);
  const advanced = useRef(false);
  const options = item.question?.answers ?? [];
  const canCheck = Boolean(answer.trim()) && !checking;

  async function check() {
    if (!canCheck || inFlight.current || verdict) return;
    inFlight.current = true;
    setChecking(true);
    setError(null);
    try {
      setVerdict(await gradeReviewItem(item.id, answer.trim(), Date.now() - started.current));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không kiểm tra được câu trả lời.');
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={[styles.prompt, { color: colors.text }]}>{item.word?.translation ?? item.question?.prompt}</Text>
      <Text style={{ color: colors.textMuted }}>{item.word?.example_vi || item.question?.lesson_title || 'Nhập từ tiếng Anh'}</Text>
      {options.length ? options.map((option) => {
        const selected = answer === option.answer_text;
        const markedCorrect = verdict?.correct_answer === option.answer_text;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled: checking || Boolean(verdict) }}
            disabled={checking || Boolean(verdict)}
            onPress={() => setAnswer(option.answer_text)}
            style={[styles.control, { backgroundColor: colors.cardBackground, borderColor: selected || markedCorrect ? colors.tint : colors.border }]}
          >
            <Text style={{ color: colors.text }}>{option.answer_text}</Text>
          </Pressable>
        );
      }) : (
        <TextInput
          accessibilityLabel="Câu trả lời"
          editable={!checking && !verdict}
          value={answer}
          onChangeText={setAnswer}
          onSubmitEditing={() => void check()}
          placeholder="Nhập câu trả lời"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={1000}
          style={[styles.control, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardBackground }]}
        />
      )}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.text }}>{error}</Text> : null}
      {verdict ? (
        <View accessibilityLiveRegion="polite" style={styles.feedback}>
          <Text style={[styles.feedbackTitle, { color: colors.text }]}>
            {verdict.is_correct ? 'Đúng rồi' : `Đáp án đúng: ${verdict.correct_answer}`}
          </Text>
          {verdict.explanation ? <Text style={{ color: colors.textMuted }}>{verdict.explanation}</Text> : null}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={!verdict && !canCheck}
        onPress={() => {
          if (!verdict) {
            void check();
          } else if (!advanced.current) {
            advanced.current = true;
            onAdvance(verdict.is_correct);
          }
        }}
        style={[styles.control, { backgroundColor: colors.tint, borderColor: colors.tint, opacity: verdict || canCheck ? 1 : 0.55 }]}
      >
        <Text style={[styles.primary, { color: theme === 'dark' ? colors.background : '#071C28' }]}>
          {verdict ? last ? 'Hoàn tất' : 'Câu tiếp theo' : checking ? 'Đang kiểm tra…' : 'Kiểm tra'}
        </Text>
      </Pressable>
    </View>
  );
}

export default function ReviewScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = Colors[theme];
  const [items, setItems] = useState<DueReviewItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const item = items?.[index];

  useEffect(() => {
    let active = true;
    void loadDueReview().then((due) => {
      if (active) setItems(due);
    }, (reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Không tải được bài ôn tập.');
    });
    return () => { active = false; };
  }, [attempt]);

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.control}>
            <Text style={{ color: colors.tint }}>‹ Quay lại</Text>
          </Pressable>
          {item && items ? <Text style={{ color: colors.textMuted }}>{index + 1} / {items.length}</Text> : null}
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Ôn tập đến hạn</Text>
        {error ? (
          <>
            <Text accessibilityRole="alert" style={{ color: colors.text }}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => { setError(null); setAttempt((value) => value + 1); }} style={[styles.control, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text }}>Thử lại</Text>
            </Pressable>
          </>
        ) : items === null ? (
          <ActivityIndicator accessibilityLabel="Đang tải bài ôn tập" color={colors.tint} />
        ) : item ? (
          <ReviewCard key={item.id} item={item} last={index + 1 === items.length} onAdvance={(isCorrect) => {
            if (isCorrect) setCorrect((total) => total + 1);
            setIndex((current) => current + 1);
          }} />
        ) : (
          <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
            {items.length ? `Bạn đã trả lời đúng ${correct}/${items.length} bài. Lịch ôn tập đã được cập nhật.` : 'Hiện chưa có bài đến hạn.'}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  pageContent: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14, padding: 18, paddingBottom: 96 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 23, fontWeight: '800' },
  prompt: { fontSize: 19, lineHeight: 27, fontWeight: '700' },
  card: { gap: 12 },
  control: { minHeight: 44, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'transparent', justifyContent: 'center' },
  primary: { textAlign: 'center', fontWeight: '800' },
  feedback: { gap: 4 },
  feedbackTitle: { fontWeight: '800' },
});
