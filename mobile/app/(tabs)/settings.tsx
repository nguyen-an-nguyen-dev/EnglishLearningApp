import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import Colors from '@/constants/Colors';
import { useAppTheme, type AppTheme } from '@/contexts/theme-context';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { theme, isDark, error: themeError, setTheme } = useAppTheme();
  const [themeSaveError, setThemeSaveError] = useState<string | null>(null);
  const colors = Colors[theme];

  async function changeTheme(enabled: boolean): Promise<void> {
    const nextTheme: AppTheme = enabled ? 'dark' : 'light';
    setThemeSaveError(null);
    try {
      await setTheme(nextTheme);
    } catch (saveError) {
      setThemeSaveError(saveError instanceof Error ? saveError.message : 'Không thể lưu giao diện.');
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Cài đặt</Text>
        <Text style={[styles.email, { color: colors.textMuted }]}>{user?.email ?? ''}</Text>
        <View style={[styles.settingCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.settingCopy}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Giao diện tối</Text>
            <Text style={[styles.settingDescription, { color: colors.textMuted }]}>
              {isDark ? 'Đang bật giao diện tối' : 'Đang bật giao diện sáng'}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Bật giao diện tối"
            accessibilityRole="switch"
            onValueChange={(enabled) => void changeTheme(enabled)}
            trackColor={{ false: '#CBD5E1', true: Colors.primaryDark }}
            thumbColor="#FFFFFF"
            value={isDark}
          />
        </View>
        {themeSaveError || themeError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>{themeSaveError ?? themeError}</Text>
        ) : null}
        <Pressable onPress={() => void logout()} style={[styles.logoutButton, { backgroundColor: isDark ? '#21262D' : '#E5F8FC' }]}>
          <Text style={[styles.logoutText, { color: isDark ? colors.text : '#007E9F' }]}>Đăng xuất</Text>
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
    fontSize: 15,
    marginTop: 12,
    marginBottom: 28,
  },
  settingCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  settingCopy: { flex: 1 },
  settingTitle: { fontSize: 15, fontWeight: '800' },
  settingDescription: { fontSize: 12, marginTop: 5 },
  errorText: { color: '#ff7b72', fontSize: 13, marginTop: 12 },
  logoutButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 24,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
  },
});