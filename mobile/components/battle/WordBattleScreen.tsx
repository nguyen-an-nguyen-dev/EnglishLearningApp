import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useAppTheme } from '@/contexts/theme-context';
import type { WordBattleScreenProps } from './types';

export function WordBattleScreen({
  currentUserId,
  error,
  game,
  question,
  answerResult,
  scores,
  submitted,
  onBack,
  onSubmit,
}: WordBattleScreenProps) {
  const { theme } = useAppTheme();
  const colors = Colors[theme];
  const [answer, setAnswer] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setAnswer('');
    setLocalError(null);
  }, [question?.round]);

  const submit = () => {
    if (!answer.trim()) {
      setLocalError('Hãy nhập câu trả lời trước khi gửi.');
      return;
    }
    setLocalError(null);
    onSubmit(answer.trim());
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.text }]}>‹</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Word Battle</Text>
        <Text style={styles.roundLabel}>{question ? `${question.round}/${game.totalRounds}` : '...'}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.scoreRow}>
          {game.players.map((player) => (
            <View key={player.userId} style={[styles.scoreCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text numberOfLines={1} style={[styles.playerName, { color: colors.textMuted }]}>
                {player.userId === currentUserId ? 'Bạn' : player.name}
              </Text>
              <Text style={[styles.score, { color: colors.text }]}>{scores.find((item) => item.userId === player.userId)?.score ?? 0}</Text>
            </View>
          ))}
        </View>
        {question ? (
          <>
            <View style={styles.promptCard}>
              <Text style={styles.eyebrow}>DỊCH TỪ NÀY SANG TIẾNG ANH</Text>
              <Text style={styles.prompt}>{question.prompt}</Text>
            </View>
            <TextInput
              accessibilityLabel="Câu trả lời tiếng Anh"
              editable={!submitted && answerResult?.correct !== true}
              onChangeText={setAnswer}
              onSubmitEditing={submit}
              placeholder="Nhập câu trả lời..."
              returnKeyType="send"
              style={[styles.input, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text }]}
              value={answer}
            />
            {localError || error ? <Text accessibilityRole="alert" style={styles.error}>{localError ?? error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={submitted || answerResult?.correct === true}
              onPress={submit}
              style={[styles.primaryButton, (submitted || answerResult?.correct === true) && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>
                {submitted ? 'Đang chuyển câu...' : answerResult && !answerResult.correct ? 'Trả lời lại' : 'Gửi câu trả lời'}
              </Text>
            </Pressable>
            {submitted ? <Text style={[styles.waiting, { color: colors.textMuted }]}>Đang chuyển sang câu tiếp theo...</Text> : null}
            {answerResult ? (
              <Text style={[styles.feedback, answerResult.correct ? styles.correct : styles.incorrect]}>
                {answerResult.correct ? 'Chính xác!' : 'Chưa chính xác'}
                {answerResult.roundWinnerUserId === currentUserId ? ' Bạn thắng vòng này.' : ''}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={[styles.waiting, { color: colors.textMuted }]}>Đang tải câu tiếp theo...</Text>
        )}
        {error && !question ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.light.background },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { color: Colors.primaryDark, fontSize: 34, lineHeight: 38 },
  headerTitle: { color: '#203447', fontSize: 16, fontWeight: '900' },
  roundLabel: { color: Colors.primaryDark, fontSize: 13, fontWeight: '900', width: 40, textAlign: 'right' },
  content: { flex: 1, padding: 20 },
  scoreRow: { flexDirection: 'row', gap: 12 },
  scoreCard: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.light.border },
  playerName: { maxWidth: '90%', color: '#A1AAB5', fontSize: 12, fontWeight: '700' },
  score: { fontSize: 23, fontWeight: '900', marginTop: 2 },
  promptCard: { alignItems: 'center', justifyContent: 'center', minHeight: 180, marginTop: 28, padding: 22, borderRadius: 16, backgroundColor: '#173d56' },
  eyebrow: { color: '#a9eafa', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  prompt: { color: '#fff', fontSize: 21, fontWeight: '800', textAlign: 'center', lineHeight: 30, marginTop: 16 },
  input: { minHeight: 52, marginTop: 20, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: '#fff', color: '#203447', fontSize: 15 },
  error: { color: '#b42318', fontSize: 13, textAlign: 'center', marginTop: 12 },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 14, borderRadius: 10, backgroundColor: Colors.primaryDark },
  disabledButton: { opacity: 0.55 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  waiting: { color: '#71818d', fontSize: 13, textAlign: 'center', marginTop: 18 },
  feedback: { fontSize: 15, fontWeight: '900', textAlign: 'center', marginTop: 18 },
  correct: { color: '#14804a' },
  incorrect: { color: '#b42318' },
});
