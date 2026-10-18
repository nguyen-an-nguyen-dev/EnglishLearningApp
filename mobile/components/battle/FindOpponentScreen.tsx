import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';

export function FindOpponentScreen({ error, onBack, onFind }: {
  error: string | null;
  onBack: () => void;
  onFind: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Word Battle</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.content}>
        <View style={styles.iconCircle}><Text style={styles.icon}>⚔️</Text></View>
        <Text style={styles.title}>Word Battle</Text>
        <Text style={styles.description}>Thi đấu dịch 20 từ vựng tiếng Việt sang tiếng Anh. Mỗi từ đúng nhanh hơn sẽ ghi điểm.</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" onPress={onFind} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Tìm đối thủ</Text>
        </Pressable>
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
  headerSpacer: { width: 40 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 48 },
  iconCircle: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 38, backgroundColor: Colors.primaryLight },
  icon: { fontSize: 31 },
  title: { color: '#203447', fontSize: 23, fontWeight: '900', marginTop: 17 },
  description: { color: '#71818d', fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  error: { color: '#b42318', fontSize: 13, textAlign: 'center', marginTop: 14 },
  primaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 25, paddingHorizontal: 22, borderRadius: 9, backgroundColor: Colors.primaryDark },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
