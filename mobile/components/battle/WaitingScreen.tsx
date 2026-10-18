import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useAppTheme } from '@/contexts/theme-context';
import type { WaitingScreenProps } from './types';

export function WaitingScreen({ error, onBack, onCancel, opponentName }: WaitingScreenProps) {
  const { theme } = useAppTheme();
  const colors = Colors[theme];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.text }]}>‹</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Đang tìm đối thủ</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.content}>
        <ActivityIndicator color={Colors.primaryDark} size="large" />
        <Text style={[styles.title, { color: colors.text }]}>{opponentName ? `Đã tìm thấy ${opponentName}` : 'Đang ghép trận...'}</Text>
        <Text style={[styles.description, { color: colors.textMuted }]}>Giữ kết nối để bắt đầu trận đấu.</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Hủy tìm kiếm</Text>
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
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  title: { color: '#203447', fontSize: 20, fontWeight: '900', marginTop: 20 },
  description: { color: '#71818d', fontSize: 14, textAlign: 'center', marginTop: 8 },
  error: { color: '#b42318', fontSize: 13, textAlign: 'center', marginTop: 14 },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 22, paddingHorizontal: 20 },
  cancelText: { color: Colors.primaryDark, fontSize: 14, fontWeight: '800' },
});
