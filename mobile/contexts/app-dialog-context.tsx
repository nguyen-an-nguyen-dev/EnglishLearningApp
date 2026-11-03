import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useAppTheme } from '@/contexts/theme-context';

export interface AppDialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AppDialogOptions {
  title: string;
  message: string;
  buttons?: AppDialogButton[];
}

interface AppDialogContextValue {
  showAppDialog: (options: AppDialogOptions) => void;
}

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  const colors = Colors[theme];
  const [dialog, setDialog] = useState<AppDialogOptions | null>(null);
  const showAppDialog = useCallback((options: AppDialogOptions) => setDialog(options), []);
  const buttons: AppDialogButton[] = dialog?.buttons?.length
    ? dialog.buttons
    : [{ text: 'Đóng' }];

  const value = useMemo(() => ({ showAppDialog }), [showAppDialog]);

  return (
    <AppDialogContext.Provider value={value}>
      {children}
      <Modal
        animationType="fade"
        onRequestClose={() => setDialog(null)}
        transparent
        visible={dialog !== null}
      >
        <View style={styles.backdrop}>
          <View
            accessibilityViewIsModal
            style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme === 'dark' ? '#123747' : Colors.primaryLight }]}>
              <Text style={[styles.icon, { color: colors.tint }]}>i</Text>
            </View>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
              {dialog?.title}
            </Text>
            <Text style={[styles.message, { color: colors.textMuted }]}>
              {dialog?.message}
            </Text>
            <View style={[styles.actions, buttons.length === 1 && styles.singleAction]}>
              {buttons.map((button, index) => {
                const isCancel = button.style === 'cancel';
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={`${button.text}-${index}`}
                    onPress={() => {
                      setDialog(null);
                      button.onPress?.();
                    }}
                    style={({ pressed }) => [
                      styles.button,
                      isCancel
                        ? { backgroundColor: theme === 'dark' ? '#1B2A34' : '#E8F8FD' }
                        : { backgroundColor: colors.tint },
                      buttons.length === 1 && styles.singleButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={[
                      styles.buttonText,
                      { color: isCancel ? colors.tint : theme === 'dark' ? '#07151B' : '#FFFFFF' },
                    ]}>
                      {button.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </AppDialogContext.Provider>
  );
}

export function useAppDialog(): AppDialogContextValue {
  const context = useContext(AppDialogContext);
  if (!context) throw new Error('useAppDialog must be used inside AppDialogProvider.');
  return context;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(5, 18, 27, 0.58)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    borderWidth: 1,
    borderRadius: 24,
    shadowColor: '#00131C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderRadius: 24,
  },
  icon: {
    fontSize: 24,
    fontWeight: '900',
  },
  title: {
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  message: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  singleAction: {
    justifyContent: 'center',
  },
  button: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  singleButton: {
    flex: 0,
    width: '100%',
  },
  buttonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
