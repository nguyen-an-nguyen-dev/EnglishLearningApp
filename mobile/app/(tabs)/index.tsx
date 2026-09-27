import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/contexts/auth-context';

export default function TabOneScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>YOUR LEARNING SPACE</Text>
          <Text style={styles.title}>Hello, {user?.name || 'learner'}.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.logout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </View>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>CURRENT STREAK</Text>
        <Text style={styles.summaryValue}>{user?.streak ?? 0} days</Text>
        <Text style={styles.summaryHint}>A little practice each day adds up.</Text>
      </View>
      <View style={styles.xpRow}>
        <View style={styles.xpBlock}>
          <Text style={styles.xpLabel}>TOTAL XP</Text>
          <Text style={styles.xpValue}>{user?.xp ?? 0}</Text>
        </View>
        <View style={styles.xpRule} />
        <View style={styles.xpBlock}>
          <Text style={styles.xpLabel}>ACCOUNT</Text>
          <Text numberOfLines={1} style={styles.email}>{user?.email}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7faf8', paddingHorizontal: 24, paddingTop: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: '#137b64', fontSize: 11, fontWeight: '700', marginBottom: 8 },
  title: { color: '#172820', fontSize: 28, fontWeight: '800' },
  logout: { paddingVertical: 10, paddingHorizontal: 13, borderColor: '#d8e2dc', borderWidth: 1, borderRadius: 9, backgroundColor: '#ffffff' },
  logoutText: { color: '#31483c', fontWeight: '700' },
  summary: { marginTop: 38, borderRadius: 14, backgroundColor: '#137b64', padding: 22, minHeight: 160, justifyContent: 'center' },
  summaryLabel: { color: '#c8e8dc', fontSize: 11, fontWeight: '700' },
  summaryValue: { color: '#ffffff', fontSize: 34, fontWeight: '800', marginTop: 8 },
  summaryHint: { color: '#e3f2ec', fontSize: 14, marginTop: 5 },
  xpRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: '#ffffff', borderColor: '#e2e9e4', borderWidth: 1, borderRadius: 12, paddingVertical: 20 },
  xpBlock: { flex: 1, paddingHorizontal: 18 },
  xpRule: { height: 42, width: 1, backgroundColor: '#e2e9e4' },
  xpLabel: { color: '#75847c', fontSize: 10, fontWeight: '700' },
  xpValue: { color: '#172820', fontSize: 23, fontWeight: '800', marginTop: 6 },
  email: { color: '#172820', fontSize: 14, fontWeight: '600', marginTop: 9 },
});
