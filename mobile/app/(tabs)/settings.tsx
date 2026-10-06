import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/contexts/auth-context';

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Cài đặt</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>
        <Pressable onPress={() => void logout()} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F8FA',
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 36,
  },
  title: {
    color: '#14313D',
    fontSize: 28,
    fontWeight: '800',
  },
  email: {
    color: '#71818A',
    fontSize: 15,
    marginTop: 12,
    marginBottom: 28,
  },
  logoutButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: '#E5F8FC',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  logoutText: {
    color: '#007E9F',
    fontSize: 15,
    fontWeight: '700',
  },
});