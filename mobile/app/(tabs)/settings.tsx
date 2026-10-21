import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import Colors from '@/constants/Colors';
import { useAppTheme, type AppTheme } from '@/contexts/theme-context';

type SettingsForm = 'profile' | 'password' | null;

export default function SettingsScreen() {
  const { user, logout, updateProfile, changePassword } = useAuth();
  const { theme, isDark, error: themeError, setTheme } = useAppTheme();
  const [themeSaveError, setThemeSaveError] = useState<string | null>(null);
  const colors = Colors[theme];

  const [openForm, setOpenForm] = useState<SettingsForm>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
  }, [user?.name, user?.email]);

  async function changeTheme(enabled: boolean): Promise<void> {
    const nextTheme: AppTheme = enabled ? 'dark' : 'light';
    setThemeSaveError(null);
    try {
      await setTheme(nextTheme);
    } catch (saveError) {
      setThemeSaveError(saveError instanceof Error ? saveError.message : 'Không thể lưu giao diện.');
    }
  }

  function openProfileForm() {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setProfileError(null);
    setOpenForm('profile');
  }

  function openPasswordForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setOpenForm('password');
  }

  function closeForm() {
    if (profileSaving || passwordSaving) return;
    setOpenForm(null);
  }

  const profileDirty = name.trim() !== (user?.name ?? '') || email.trim() !== (user?.email ?? '');

  async function saveProfile() {
    if (!name.trim() || !email.trim() || profileSaving) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      await updateProfile(name.trim(), email.trim());
      setProfileSaving(false);
      setOpenForm(null);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Không thể lưu thông tin.');
      setProfileSaving(false);
    }
  }

  async function savePassword() {
    if (passwordSaving) return;
    setPasswordError(null);
    if (!currentPassword) { setPasswordError('Nhập mật khẩu hiện tại.'); return; }
    if (newPassword.length < 6) { setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Mật khẩu xác nhận không khớp.'); return; }
    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSaving(false);
      setOpenForm(null);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Không thể đổi mật khẩu.');
      setPasswordSaving(false);
    }
  }

  const inputStyle = [
    styles.textInput,
    { backgroundColor: isDark ? '#0D1B24' : '#F4F8FB', borderColor: colors.border, color: colors.text },
  ];
  const cardStyle = { backgroundColor: colors.cardBackground, borderColor: colors.border };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>Cài đặt</Text>
        <Text style={[styles.email, { color: colors.textMuted }]}>{user?.email ?? ''}</Text>

        {themeSaveError || themeError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>{themeSaveError ?? themeError}</Text>
        ) : null}

        <View style={[styles.groupCard, cardStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa thông tin cá nhân"
            onPress={openProfileForm}
            style={styles.settingRow}
          >
    
            <View style={styles.rowCopy}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Thông tin cá nhân</Text>
              <Text numberOfLines={1} style={[styles.settingDescription, { color: colors.textMuted }]}>
                {user?.name ?? ''} · {user?.email ?? ''}
              </Text>
            </View>
            <Text style={[styles.rowChevron, { color: colors.textMuted }]}>›</Text>
          </Pressable>
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đổi mật khẩu"
            onPress={openPasswordForm}
            style={styles.settingRow}
          >
           
            <View style={styles.rowCopy}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Đổi mật khẩu</Text>
              <Text style={[styles.settingDescription, { color: colors.textMuted }]}>Cập nhật mật khẩu đăng nhập</Text>
            </View>
            <Text style={[styles.rowChevron, { color: colors.textMuted }]}>›</Text>
          </Pressable>
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <View style={[styles.settingRow, styles.settingCardRow]}>
        
            <View style={styles.rowCopy}>
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
        </View>

        <Pressable onPress={() => void logout()} style={[styles.logoutButton, { backgroundColor: isDark ? '#21262D' : '#E5F8FC' }]}>
          <Text style={[styles.logoutText, { color: isDark ? colors.text : '#007E9F' }]}>Đăng xuất</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={openForm !== null} transparent animationType="fade" onRequestClose={closeForm}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdropTouch} onPress={closeForm} accessibilityLabel="Đóng form" />
          <View style={[styles.modalCard, cardStyle]}>
            {openForm === 'profile' ? (
              <>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Thông tin cá nhân</Text>

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Họ tên</Text>
                <TextInput
                  accessibilityLabel="Họ tên"
                  value={name}
                  onChangeText={(value) => { setName(value); setProfileError(null); }}
                  placeholder="Nhập họ tên của bạn"
                  placeholderTextColor={colors.textMuted}
                  style={inputStyle}
                  maxLength={100}
                />

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Email</Text>
                <TextInput
                  accessibilityLabel="Email"
                  value={email}
                  onChangeText={(value) => { setEmail(value); setProfileError(null); }}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={inputStyle}
                  maxLength={254}
                />

                {profileError ? (
                  <Text accessibilityRole="alert" style={styles.errorText}>{profileError}</Text>
                ) : null}

                <View style={styles.modalActions}>
                  <Pressable accessibilityRole="button" onPress={closeForm} style={[styles.secondaryButton, { backgroundColor: isDark ? '#21262D' : '#EDF2F6' }]}>
                    <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Hủy</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!profileDirty || profileSaving}
                    onPress={() => void saveProfile()}
                    style={[styles.primaryButton, { backgroundColor: colors.tint, opacity: !profileDirty || profileSaving ? 0.55 : 1 }]}
                  >
                    {profileSaving
                      ? <ActivityIndicator color="#FFFFFF" />
                      : <Text style={styles.primaryButtonText}>Lưu</Text>}
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Đổi mật khẩu</Text>

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Mật khẩu hiện tại</Text>
                <TextInput
                  accessibilityLabel="Mật khẩu hiện tại"
                  value={currentPassword}
                  onChangeText={(value) => { setCurrentPassword(value); setPasswordError(null); }}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  style={inputStyle}
                />

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Mật khẩu mới</Text>
                <TextInput
                  accessibilityLabel="Mật khẩu mới"
                  value={newPassword}
                  onChangeText={(value) => { setNewPassword(value); setPasswordError(null); }}
                  secureTextEntry
                  placeholder="Ít nhất 6 ký tự"
                  placeholderTextColor={colors.textMuted}
                  style={inputStyle}
                />

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Nhập lại mật khẩu mới</Text>
                <TextInput
                  accessibilityLabel="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChangeText={(value) => { setConfirmPassword(value); setPasswordError(null); }}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  style={inputStyle}
                />

                {passwordError ? (
                  <Text accessibilityRole="alert" style={styles.errorText}>{passwordError}</Text>
                ) : null}

                <View style={styles.modalActions}>
                  <Pressable accessibilityRole="button" onPress={closeForm} style={[styles.secondaryButton, { backgroundColor: isDark ? '#21262D' : '#EDF2F6' }]}>
                    <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Hủy</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                    onPress={() => void savePassword()}
                    style={[styles.primaryButton, { backgroundColor: colors.tint, opacity: passwordSaving || !currentPassword || !newPassword || !confirmPassword ? 0.55 : 1 }]}
                  >
                    {passwordSaving
                      ? <ActivityIndicator color="#FFFFFF" />
                      : <Text style={styles.primaryButtonText}>Đổi mật khẩu</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F8FA',
  },
  content: {
    padding: 24,
    paddingTop: 36,
    paddingBottom: 48,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
  },
  email: {
    fontSize: 15,
    marginTop: -8,
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingCardRow: {
    minHeight: 76,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 44,
  },
  rowIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  rowCopy: { flex: 1 },
  rowChevron: {
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: 2,
  },
  settingTitle: { fontSize: 15, fontWeight: '800' },
  settingDescription: { fontSize: 12, marginTop: 5 },
  errorText: { color: '#e5484d', fontSize: 13, marginTop: 10 },
  logoutButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 20, 28, 0.55)',
    justifyContent: 'center',
  },
  modalBackdropTouch: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  modalCard: {
    alignSelf: 'center',
    width: '90%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  textInput: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 13,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  primaryButton: {
    flex: 2,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
