import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Keyboard,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Colors from '@/constants/Colors';
import { useAppTheme, type AppTheme } from '@/contexts/theme-context';
import type { WordBattleScreenProps } from './types';

const NEON = '#00C7FF';
const VIOLET = '#8B5CF6';
const AMBER = '#FFB020';
const GREEN = '#1FC98A';
const RED = '#FF6B6B';

// Tile sizing: the row measures itself and every letter shrinks to fit on one line, so a long
// word can never wrap behind the keyboard or lose a tile. Tune these to restyle the grid.
const TILE_GAP = 5;
const TILE_TIGHT_GAP = 3;
const TILE_MAX_WIDTH = 31;
const TILE_MIN_WIDTH = 16;
const TILE_FALLBACK_WIDTH = Math.min(Dimensions.get('window').width, 480) - 56;

type TileSource = 'answer' | 'hint' | 'typed' | 'empty';

function tilePalette(source: TileSource, theme: AppTheme, colors: typeof Colors.light) {
  if (source === 'answer') {
    return { background: theme === 'dark' ? '#132F22' : '#E7FAF1', border: GREEN, text: GREEN };
  }
  if (source === 'hint') {
    return { background: theme === 'dark' ? '#2B2312' : '#FFF6E3', border: AMBER, text: AMBER };
  }
  const neutral = { background: theme === 'dark' ? '#0F1F2B' : Colors.primaryLight };
  return source === 'typed'
    ? { ...neutral, border: NEON, text: colors.text }
    : { ...neutral, border: colors.border, text: colors.textMuted };
}

const PART_OF_SPEECH_VI: Record<string, string> = {
  noun: 'Danh từ',
  verb: 'Động từ',
  adjective: 'Tính từ',
  adverb: 'Trạng từ',
  pronoun: 'Đại từ',
  preposition: 'Giới từ',
  conjunction: 'Liên từ',
  interjection: 'Thán từ',
};

export function WordBattleScreen({
  currentUserId,
  error,
  question,
  roundEnd,
  wrongAnswer,
  scores,
  onBack,
  onSubmit,
}: WordBattleScreenProps) {
  const { theme } = useAppTheme();
  const colors = Colors[theme];
  const [answer, setAnswer] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [tilesRowWidth, setTilesRowWidth] = useState(TILE_FALLBACK_WIDTH);
  const progress = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const revealed = roundEnd !== null;
  const won = revealed && roundEnd.winnerUserId === currentUserId;
  const lost = revealed && roundEnd.winnerUserId !== null && !won;
  const opponent = scores.find((player) => player.userId !== currentUserId);
  const me = scores.find((player) => player.userId === currentUserId);

  useEffect(() => {
    setAnswer('');
    setLocalError(null);
  }, [question?.round]);

  useEffect(() => {
    if (!question || roundEnd) return;
    progress.setValue(0);
    const timer = Animated.timing(progress, {
      toValue: 1,
      duration: question.durationMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    timer.start();
    // Revealing the answer stops the countdown where it is, so the bar freezes with the result.
    return () => timer.stop();
  }, [progress, question, roundEnd]);

  // On a phone the open keyboard covers the lower part of the tile row, so the reveal closes it
  // and scrolls back to the top instead of leaving the tail of the word off screen.
  useEffect(() => {
    if (!roundEnd) return;
    Keyboard.dismiss();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [roundEnd]);

  const submit = () => {
    if (revealed) return;
    if (!answer.trim()) {
      setLocalError('Hãy nhập câu trả lời trước khi gửi.');
      return;
    }
    setLocalError(null);
    onSubmit(answer.trim());
  };

  const typed = answer.replace(/\s+/g, '').toUpperCase();
  const revealTiles = roundEnd ? roundEnd.answer.toUpperCase().split('') : [];

  const hintLetters = new Map<number, string>();
  for (const hint of question?.letterHints ?? []) hintLetters.set(hint.position, hint.letter.toUpperCase());

  const cells: Array<{ letter: string; source: TileSource }> = Array.from(
    { length: revealed ? revealTiles.length : question?.letterCount ?? 0 },
    (_, index) => {
      if (revealed) return { letter: revealTiles[index], source: 'answer' };
      const typedLetter = typed[index];
      if (typedLetter) return { letter: typedLetter, source: 'typed' };
      const hint = hintLetters.get(index);
      return { letter: hint ?? '', source: hint ? 'hint' : 'empty' };
    },
  );

  const tileGap = cells.length >= 11 ? TILE_TIGHT_GAP : TILE_GAP;
  const tileWidth = cells.length === 0
    ? TILE_MAX_WIDTH
    : Math.max(
        TILE_MIN_WIDTH,
        Math.min(TILE_MAX_WIDTH, Math.floor((tilesRowWidth - (cells.length - 1) * tileGap) / cells.length)),
      );
  const tileHeight = Math.round(tileWidth * 1.22);
  const tileFont = Math.max(11, Math.round(tileWidth * 0.6));

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.text }]}>‹</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>WORD BATTLE</Text>
          <Text style={styles.headerSub}>
            {question ? `Vòng ${question.round} / ${question.totalRounds}` : `Đang tìm từ tiếp theo...`}
          </Text>
        </View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelBadgeText}>{question?.cefrLevel ?? '--'}</Text>
        </View>
      </View>

      <View style={styles.scoreRow}>
        <ScoreCard colors={colors} player={me} label="Bạn" accent={NEON} />
        <Text style={[styles.vs, { color: colors.textMuted }]}>VS</Text>
        <ScoreCard colors={colors} player={opponent} accent={VIOLET} />
      </View>

      <View style={[styles.timerTrack, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Animated.View style={[styles.timerFill, { width: barWidth, backgroundColor: revealed ? GREEN : NEON }]} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {question?.imageUrl ? (
          <Image
            accessibilityLabel="Hình ảnh minh họa cho từ cần đoán"
            source={{ uri: question.imageUrl }}
            style={[styles.illustration, { borderColor: colors.border }]}
            resizeMode="cover"
          />
        ) : null}

        <View style={[styles.tilesCard, { backgroundColor: colors.cardBackground, borderColor: revealed ? GREEN : colors.border }]}>
          <Text style={[styles.tilesLabel, { color: colors.textMuted }]}>
            {revealed ? 'ĐÁP ÁN' : `ĐOÁN TỪ TIẾNG ANH · ${cells.length} CHỮ CÁI`}
          </Text>
          <View
            onLayout={(event) => {
              const width = event.nativeEvent.layout.width;
              if (width > 0 && Math.abs(width - tilesRowWidth) > 0.5) setTilesRowWidth(width);
            }}
            style={[styles.tiles, { gap: tileGap }]}
          >
            {cells.map((cell, index) => {
              const palette = tilePalette(cell.source, theme, colors);
              return (
                <View
                  key={`${roundEnd?.wordId ?? question?.wordId ?? 0}-${index}`}
                  style={[styles.tile, { width: tileWidth, height: tileHeight, backgroundColor: palette.background, borderColor: palette.border }]}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.tileText, { fontSize: tileFont, color: palette.text }]}
                  >
                    {cell.letter}
                  </Text>
                </View>
              );
            })}
          </View>
          {revealed ? (
            <Text
              accessibilityRole="alert"
              style={[
                styles.revealNote,
                { color: won ? GREEN : lost ? RED : AMBER },
              ]}
            >
              {won
                ? 'Bạn đoán đúng và ghi điểm vòng này!'
                : lost
                  ? 'Đối thủ đã đoán đúng trước bạn.'
                  : 'Hết giờ! Không ai đoán được từ này.'}
            </Text>
          ) : null}
        </View>

        {question ? (
          <View style={[styles.hints, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Hint label="Bản dịch" accent={NEON} colors={colors}>
              <Text style={[styles.hintValue, { color: colors.text }]}>{question.translation}</Text>
            </Hint>
            <View style={[styles.hintDivider, { backgroundColor: colors.border }]} />
            <Hint label="Giải thích" accent={VIOLET} colors={colors}>
              <Text style={[styles.hintBody, { color: colors.textMuted }]}>{question.explanation}</Text>
            </Hint>
            <View style={[styles.hintDivider, { backgroundColor: colors.border }]} />
            <Hint label="Ví dụ" accent={AMBER} colors={colors}>
              <Text style={[styles.hintExample, { color: colors.text }]}>
                {revealed ? roundEnd.example : question.example}
              </Text>
              <Text style={[styles.hintExampleVi, { color: colors.textMuted }]}>{question.exampleVi}</Text>
            </Hint>
            <View style={[styles.hintDivider, { backgroundColor: colors.border }]} />
            <Hint label="Loại từ" accent={GREEN} colors={colors}>
              <View style={[styles.posChip, { borderColor: GREEN }]}>
                <Text style={[styles.posChipText, { color: GREEN }]}>
                  {PART_OF_SPEECH_VI[question.partOfSpeech] ?? question.partOfSpeech}
                </Text>
              </View>
            </Hint>
          </View>
        ) : (
          <Text style={[styles.waiting, { color: colors.textMuted }]}>Đang chuẩn bị từ tiếp theo...</Text>
        )}

        {!revealed && question ? (
          <>
            <View style={styles.inputRow}>
              <TextInput
                accessibilityLabel="Câu trả lời tiếng Anh"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(value) => {
                  setAnswer(value);
                  if (localError) setLocalError(null);
                }}
                onSubmitEditing={submit}
                placeholder="Nhập từ tiếng Anh..."
                returnKeyType="send"
                style={[styles.input, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text }]}
                value={answer}
              />
              <Pressable
                accessibilityRole="button"
                onPress={submit}
                style={({ pressed }) => [styles.sendButton, pressed && styles.sendButtonPressed]}
              >
                <Text style={styles.sendButtonText}>Gửi</Text>
              </Pressable>
            </View>
            {localError || wrongAnswer || error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {localError ?? (wrongAnswer ? 'Chưa đúng, hãy thử lại.' : error)}
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type Palette = typeof Colors.light;

function ScoreCard({
  accent,
  colors,
  label,
  player,
}: {
  accent: string;
  colors: Palette;
  label?: string;
  player?: { userId: number; name: string; score: number };
}) {
  if (!player) return <View style={styles.scoreCard} />;
  return (
    <View style={[styles.scoreCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
      <View style={[styles.avatar, { backgroundColor: accent }]}>
        <Text style={styles.avatarText}>{player.name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <Text numberOfLines={1} style={[styles.scoreName, { color: colors.textMuted }]}>
        {label ?? player.name}
      </Text>
      <Text style={[styles.scoreValue, { color: accent }]}>{player.score}</Text>
    </View>
  );
}

function Hint({
  accent,
  children,
  colors,
  label,
}: {
  accent: string;
  children: ReactNode;
  colors: Palette;
  label: string;
}) {
  return (
    <View style={styles.hint}>
      <View style={styles.hintHead}>
        <View style={[styles.hintDot, { backgroundColor: accent }]} />
        <Text style={[styles.hintLabel, { color: colors.textMuted }]}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  backButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 30, lineHeight: 34, fontWeight: '700' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1.4 },
  headerSub: { color: NEON, fontSize: 11, fontWeight: '800', marginTop: 2, letterSpacing: 0.4 },
  levelBadge: { minWidth: 38, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: VIOLET, paddingHorizontal: 8 },
  levelBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 14 },
  scoreCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 54, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  scoreName: { flex: 1, fontSize: 12, fontWeight: '800' },
  scoreValue: { fontSize: 20, fontWeight: '900' },
  vs: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  timerTrack: { height: 8, marginHorizontal: 14, marginTop: 10, borderRadius: 4, borderWidth: 1, overflow: 'hidden' },
  timerFill: { height: '100%', borderRadius: 4 },
  scroll: { padding: 14, paddingBottom: 28, gap: 12 },
  illustration: { width: '100%', height: 150, borderRadius: 16, borderWidth: 1 },
  tilesCard: { padding: 14, borderRadius: 18, borderWidth: 1 },
  tilesLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 10 },
  // nowrap keeps every letter of the word on one line; the measured tile width already fits,
  // and flexShrink is the safety valve so a long word shrinks instead of dropping a tile.
  tiles: { flexDirection: 'row', flexWrap: 'nowrap', gap: TILE_GAP, justifyContent: 'center' },
  tile: { borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 1 },
  tileText: { fontWeight: '900' },
  revealNote: { marginTop: 12, fontSize: 13, fontWeight: '900', textAlign: 'center' },
  hints: { padding: 4, borderRadius: 18, borderWidth: 1 },
  hint: { paddingHorizontal: 12, paddingVertical: 11, gap: 6 },
  hintHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  hintDot: { width: 7, height: 7, borderRadius: 4 },
  hintLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  hintValue: { fontSize: 19, fontWeight: '900', paddingLeft: 14 },
  hintBody: { fontSize: 13.5, lineHeight: 20, paddingLeft: 14 },
  hintExample: { fontSize: 14, fontWeight: '700', lineHeight: 21, paddingLeft: 14 },
  hintExampleVi: { fontSize: 12.5, fontStyle: 'italic', lineHeight: 19, paddingLeft: 14, marginTop: 3 },
  hintDivider: { height: 1, marginHorizontal: 12 },
  posChip: { alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 5, marginLeft: 14, borderRadius: 12, borderWidth: 1 },
  posChipText: { fontSize: 12.5, fontWeight: '900' },
  waiting: { fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minHeight: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, fontSize: 15, fontWeight: '600' },
  sendButton: { minWidth: 68, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: NEON },
  sendButtonPressed: { opacity: 0.8 },
  sendButtonText: { color: '#04252b', fontSize: 14, fontWeight: '900' },
  error: { color: RED, fontSize: 13, textAlign: 'center' },
});
