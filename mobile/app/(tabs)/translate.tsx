import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import Colors from '@/constants/Colors';
import { useAppTheme } from '@/contexts/theme-context';
import {
  getTranslationHistory,
  translateText,
  translateTxtFile,
  type LanguageCode,
  type Translation,
} from '@/services/translations';

type TranslateTab = 'text' | 'file' | 'history';

const MAX_FILE_BYTES = 20 * 1024;

function languageName(language: LanguageCode): string {
  return language === 'en' ? 'English' : 'Tiếng Việt';
}

function partOfSpeechName(part: string): string {
  const names: Record<string, string> = {
    noun: 'Danh từ',
    verb: 'Động từ',
    adjective: 'Tính từ',
    adverb: 'Trạng từ',
    pronoun: 'Đại từ',
    preposition: 'Giới từ',
    conjunction: 'Liên từ',
    interjection: 'Thán từ',
    other: 'Từ loại khác',
  };
  return names[part] ?? part;
}

export default function TranslateScreen() {
  const { theme } = useAppTheme();
  const colors = Colors[theme];
  const dark = theme === 'dark';
  const [tab, setTab] = useState<TranslateTab>('text');
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>('en');
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [result, setResult] = useState<Translation | null>(null);
  const [history, setHistory] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetLanguage: LanguageCode = sourceLanguage === 'en' ? 'vi' : 'en';
  const cardStyle = { backgroundColor: colors.cardBackground, borderColor: colors.border };

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistory(await getTranslationHistory());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải lịch sử dịch.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadHistory();
  }, [loadHistory]));

  function switchTab(nextTab: TranslateTab) {
    setTab(nextTab);
    setError(null);
  }

  function toggleDirection() {
    setSourceLanguage((current) => current === 'en' ? 'vi' : 'en');
    setResult(null);
    setError(null);
  }

  async function submitText() {
    if (!input.trim() || loading) return;
    Keyboard.dismiss();
    try {
      setLoading(true);
      setError(null);
      setResult(await translateText(input, sourceLanguage, targetLanguage));
      await loadHistory();
    } catch (translateError) {
      setError(translateError instanceof Error ? translateError.message : 'Đã xảy ra lỗi khi dịch.');
    } finally {
      setLoading(false);
    }
  }

  async function chooseFile() {
    try {
      setError(null);
      const selection = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (selection.canceled) return;
      const file = selection.assets[0];
      if (!file.name.toLowerCase().endsWith('.txt')) {
        throw new Error('Chỉ hỗ trợ tệp .txt.');
      }
      if (file.size !== undefined && file.size > MAX_FILE_BYTES) {
        throw new Error(`Tệp quá lớn. Giới hạn tối đa là ${MAX_FILE_BYTES / 1024} KB.`);
      }
      setSelectedFile(file);
      setResult(null);
    } catch (pickError) {
      setError(pickError instanceof Error ? pickError.message : 'Không thể mở tệp đã chọn.');
    }
  }

  async function submitFile() {
    if (!selectedFile || loading) return;
    try {
      setLoading(true);
      setError(null);
      setResult(await translateTxtFile(selectedFile, sourceLanguage, targetLanguage));
      await loadHistory();
    } catch (translateError) {
      setError(translateError instanceof Error ? translateError.message : 'Không thể dịch tệp.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Dịch thuật</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Dịch với AI, nhanh và tự nhiên</Text>
      </View>

      <View style={styles.tabs}>
        {([
          ['text', 'Văn bản'],
          ['file', 'Tệp .txt'],
          ['history', 'Lịch sử'],
        ] as const).map(([id, label]) => (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === id }}
            onPress={() => switchTab(id)}
            style={[styles.tab, tab === id && { borderBottomColor: colors.tint }]}
          >
            <Text style={[styles.tabText, { color: tab === id ? colors.tint : colors.textMuted }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'history' ? (
        <ScrollView contentContainerStyle={styles.historyList}>
          {error ? (
            <View style={[styles.errorCard, { backgroundColor: dark ? '#351C1C' : '#FFF1F0' }]}>
              <Text style={[styles.errorText, { color: dark ? '#FF9A93' : '#A52E3C' }]}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => void loadHistory()} style={styles.retryButton}>
                <Text style={[styles.retryText, { color: colors.tint }]}>Thử lại</Text>
              </Pressable>
            </View>
          ) : null}
          {historyLoading ? (
            <ActivityIndicator color={colors.tint} style={styles.loading} />
          ) : history.length ? history.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                setResult(item);
                setSourceLanguage(item.sourceLanguage);
                setTab('text');
              }}
              style={[styles.historyCard, cardStyle]}
            >
              <View style={styles.historyCardHeader}>
                <Text style={[styles.historyDirection, { color: colors.tint }]}>
                  {languageName(item.sourceLanguage)} → {languageName(item.targetLanguage)}
                </Text>
                <Text style={[styles.historyDate, { color: colors.textMuted }]}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                </Text>
              </View>
              {item.fileName ? <Text style={[styles.fileName, { color: colors.textMuted }]}>📄 {item.fileName}</Text> : null}
              <Text numberOfLines={2} style={[styles.historyOriginal, { color: colors.text }]}>{item.originalText}</Text>
              <Text numberOfLines={2} style={[styles.historyTranslated, { color: colors.textMuted }]}>{item.translatedText}</Text>
            </Pressable>
          )) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🗂️</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Chưa có lịch sử dịch</Text>
              <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>Bản dịch của bạn sẽ xuất hiện ở đây.</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.languageBar, cardStyle]}>
            <Text style={[styles.language, { color: colors.text }]}>{languageName(sourceLanguage)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đổi chiều dịch"
              onPress={toggleDirection}
              style={[styles.swapButton, { backgroundColor: dark ? '#18333C' : '#E6F9FF' }]}
            >
              <Text style={[styles.swapIcon, { color: colors.tint }]}>⇄</Text>
            </Pressable>
            <Text style={[styles.language, { color: colors.text }]}>{languageName(targetLanguage)}</Text>
          </View>

          {tab === 'text' ? (
            <>
              <TextInput
                accessibilityLabel="Văn bản cần dịch"
                multiline
                onChangeText={(text) => {
                  setInput(text);
                  setResult(null);
                }}
                placeholder={sourceLanguage === 'en' ? 'Nhập tiếng Anh cần dịch...' : 'Nhập tiếng Việt cần dịch...'}
                placeholderTextColor={colors.textMuted}
                style={[styles.textInput, cardStyle, { color: colors.text }]}
                textAlignVertical="top"
                value={input}
              />
              <Text style={[styles.characterCount, { color: colors.textMuted }]}>{input.length.toLocaleString()} / 10.000</Text>
              <Pressable
                accessibilityRole="button"
                disabled={!input.trim() || loading}
                onPress={() => void submitText()}
                style={[styles.primaryButton, { backgroundColor: colors.tint, opacity: !input.trim() || loading ? 0.55 : 1 }]}
              >
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Dịch văn bản</Text>}
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => void chooseFile()}
                style={[styles.filePicker, cardStyle]}
              >
                <Text style={styles.filePickerIcon}>📄</Text>
                <Text style={[styles.filePickerTitle, { color: colors.text }]}>
                  {selectedFile?.name ?? 'Chọn tệp văn bản'}
                </Text>
                <Text style={[styles.filePickerHint, { color: colors.textMuted }]}>Chỉ hỗ trợ .txt · tối đa {MAX_FILE_BYTES / 1024} KB</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!selectedFile || loading}
                onPress={() => void submitFile()}
                style={[styles.primaryButton, { backgroundColor: colors.tint, opacity: !selectedFile || loading ? 0.55 : 1 }]}
              >
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Tải lên và dịch</Text>}
              </Pressable>
              {selectedFile && !loading ? (
                <Text style={[styles.filePickerHint, { color: colors.textMuted }]}>Tệp dài sẽ mất khoảng 30 giây đến 2 phút để dịch xong.</Text>
              ) : null}
            </>
          )}

          {error ? (
            <View style={[styles.errorCard, { backgroundColor: dark ? '#351C1C' : '#FFF1F0' }]}>
              <Text style={[styles.errorText, { color: dark ? '#FF9A93' : '#A52E3C' }]}>{error}</Text>
            </View>
          ) : null}

          {result ? <TranslationResultView result={result} dark={dark} colors={colors} /> : null}
        </ScrollView>
      )}
    </View>
  );
}

function TranslationResultView({
  result,
  dark,
  colors,
}: {
  result: Translation;
  dark: boolean;
  colors: typeof Colors.light;
}) {
  return (
    <View style={styles.resultContainer}>
      <View style={[styles.resultCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.resultLabel, { color: colors.textMuted }]}>BẢN GỐC</Text>
        <Text style={[styles.resultText, { color: colors.text }]}>{result.originalText}</Text>
        {result.fileName ? <Text style={[styles.fileName, { color: colors.textMuted }]}>📄 {result.fileName}</Text> : null}
      </View>
      <View style={[styles.resultCard, styles.translatedCard, { backgroundColor: dark ? '#132B32' : '#E9F9FC', borderColor: dark ? '#28515D' : '#B6EAF4' }]}>
        <Text style={[styles.resultLabel, { color: colors.tint }]}>BẢN DỊCH</Text>
        <Text style={[styles.resultText, { color: colors.text }]}>{result.translatedText}</Text>
      </View>
      {result.wordDetails ? (
        <View style={[styles.wordCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.wordHeading}>
            <Text style={[styles.wordTitle, { color: colors.text }]}>{result.wordDetails.word}</Text>
            {result.wordDetails.phonetic ? (
              <Text style={[styles.phonetic, { color: colors.textMuted }]}>/{result.wordDetails.phonetic}/</Text>
            ) : null}
          </View>
          <Text style={[styles.partOfSpeech, { color: colors.tint }]}>{partOfSpeechName(result.wordDetails.partOfSpeech)}</Text>
          <Text style={[styles.wordMeaning, { color: colors.text }]}>{result.wordDetails.meaning}</Text>
          <Text style={[styles.wordExample, { color: colors.textMuted }]}>{result.wordDetails.example}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { alignItems: 'center', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 25, fontWeight: '900', textAlign: 'center' },
  subtitle: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#30363D' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 12, fontWeight: '800' },
  formContent: { padding: 18, paddingBottom: 36 },
  languageBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderWidth: 1, borderRadius: 14, marginBottom: 16 },
  language: { fontSize: 14, fontWeight: '800' },
  swapButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  swapIcon: { fontSize: 23, fontWeight: '800' },
  textInput: { minHeight: 170, borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15, lineHeight: 22 },
  characterCount: { textAlign: 'right', fontSize: 11, marginTop: 7, marginBottom: 12 },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 13, marginTop: 4 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  filePicker: { minHeight: 170, alignItems: 'center', justifyContent: 'center', padding: 18, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14 },
  filePickerIcon: { fontSize: 35, marginBottom: 10 },
  filePickerTitle: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  filePickerHint: { fontSize: 12, marginTop: 6 },
  errorCard: { padding: 12, borderRadius: 10, marginTop: 14 },
  errorText: { fontSize: 13, lineHeight: 19 },
  retryButton: { alignSelf: 'flex-start', marginTop: 7 },
  retryText: { fontSize: 12, fontWeight: '800' },
  resultContainer: { gap: 12, marginTop: 20 },
  resultCard: { padding: 15, borderWidth: 1, borderRadius: 14 },
  translatedCard: { borderWidth: 1 },
  resultLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 7 },
  resultText: { fontSize: 15, lineHeight: 23 },
  fileName: { fontSize: 11, marginTop: 8 },
  wordCard: { padding: 15, borderWidth: 1, borderRadius: 14 },
  wordHeading: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  wordTitle: { fontSize: 20, fontWeight: '900' },
  phonetic: { fontSize: 13 },
  partOfSpeech: { fontSize: 11, fontWeight: '800', marginTop: 4 },
  wordMeaning: { fontSize: 14, fontWeight: '700', marginTop: 10 },
  wordExample: { fontSize: 13, lineHeight: 19, marginTop: 7, fontStyle: 'italic' },
  historyList: { padding: 16, gap: 11, flexGrow: 1 },
  historyCard: { padding: 13, borderWidth: 1, borderRadius: 13, gap: 6 },
  historyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  historyDirection: { flex: 1, fontSize: 11, fontWeight: '900' },
  historyDate: { fontSize: 10 },
  historyOriginal: { fontSize: 13, fontWeight: '700' },
  historyTranslated: { fontSize: 12, lineHeight: 17 },
  emptyState: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyCopy: { fontSize: 13, textAlign: 'center', marginTop: 5 },
  loading: { marginTop: 40 },
});
