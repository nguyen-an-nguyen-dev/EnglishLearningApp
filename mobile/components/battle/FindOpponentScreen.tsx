import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useAppTheme } from '@/contexts/theme-context';

export function FindOpponentScreen({ error, onBack, onFind }: {
  error: string | null;
  onBack: () => void;
  onFind: () => void;
}) {
  const { theme } = useAppTheme();
  const colors = Colors[theme];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.text }]}>‹</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Word Battle</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.content}>
        <View style={styles.iconCircle}><Text style={styles.icon}>⚔️</Text></View>
        <Text style={[styles.title, { color: colors.text }]}>Word Battle</Text>
        <Text style={[styles.description, { color: colors.textMuted }]}>
          Hai người cùng đoán một từ tiếng Anh qua bản dịch, loại từ, giải thích và ví dụ.
        </Text>
        <View style={[styles.rules, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Rule colors={colors} icon="🔤" text="12 từ mỗi trận, 70% từ dễ (A1-B1), trộn ngẫu nhiên" />
          <Rule colors={colors} icon="💡" text="Chữ cái gợi ý hiện sẵn trong ô đáp án" />
          <Rule colors={colors} icon="⏱️" text="30 giây cho mỗi từ, hết giờ thì sang từ khác" />
          <Rule colors={colors} icon="🏆" text="Ai nhập đúng trước ghi 1 điểm, nhiều điểm hơn sẽ thắng" />
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" onPress={onFind} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Tìm đối thủ</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Rule({ colors, icon, text }: { colors: typeof Colors.light; icon: string; text: string }) {
  return (
    <View style={styles.rule}>
      <Text style={styles.ruleIcon}>{icon}</Text>
      <Text style={[styles.ruleText, { color: colors.textMuted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.light.background },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { color: Colors.primaryDark, fontSize: 34, lineHeight: 38 },
  headerTitle: { color: '#203447', fontSize: 16, fontWeight: '900' },
  headerSpacer: { width: 40 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 48 },
  iconCircle: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 38, backgroundColor: Colors.primaryLight },
  icon: { fontSize: 31 },
  title: { color: '#203447', fontSize: 23, fontWeight: '900', marginTop: 17 },
  description: { color: '#71818d', fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 8, maxWidth: 320 },
  rules: { width: '100%', maxWidth: 320, marginTop: 20, padding: 14, gap: 10, borderRadius: 16, borderWidth: 1 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ruleIcon: { fontSize: 15 },
  ruleText: { flex: 1, color: '#71818d', fontSize: 12.5, lineHeight: 18 },
  error: { color: '#b42318', fontSize: 13, textAlign: 'center', marginTop: 14 },
  primaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 25, paddingHorizontal: 22, borderRadius: 9, backgroundColor: Colors.primaryDark },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
