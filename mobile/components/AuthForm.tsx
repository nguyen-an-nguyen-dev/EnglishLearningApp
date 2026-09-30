import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/auth-context';

type AuthMode = 'login' | 'register';

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const isRegister = mode === 'register';
  const router = useRouter();
  const auth = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(): Promise<void> {
    setError('');
    setSubmitting(true);
    try {
      if (isRegister) await auth.register(name, email, password);
      else await auth.login(email, password);
      router.replace('/');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to authenticate.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandMark}><Text style={styles.brandLetter}>L</Text></View>
        <Text style={styles.eyebrow}>LINGUA / ENGLISH</Text>
        <Text style={styles.title}>{isRegister ? 'Start speaking.' : 'English for life'}</Text>


        {isRegister && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              autoComplete="name"
              autoCapitalize="words"
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#8ea2b8"
              style={styles.input}
              value={name}
            />
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            autoComplete="email"
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#8ea2b8"
            style={styles.input}
            textContentType="emailAddress"
            value={email}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            onChangeText={setPassword}
            placeholder={isRegister ? 'At least 6 characters' : 'Your password'}
            placeholderTextColor="#8ea2b8"
            secureTextEntry
            style={styles.input}
            textContentType={isRegister ? 'newPassword' : 'password'}
            value={password}
          />
        </View>

        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

        <Pressable
          accessibilityRole="button"
          disabled={submitting}
          onPress={() => void submit()}
          style={({ pressed }) => [styles.submit, pressed && styles.pressed, submitting && styles.disabled]}
        >
          {submitting
            ? <ActivityIndicator color="#ffffff" />
            : <Text style={styles.submitText}>{isRegister ? 'Create account' : 'Sign in'}</Text>}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{isRegister ? 'Already learning with us?' : 'New to Lingua?'}</Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.replace(isRegister ? '/login' : '/register')}
          >
            <Text style={styles.footerLink}>{isRegister ? ' Sign in' : ' Create account'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.primarySoft },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 48, maxWidth: 520, width: '100%', alignSelf: 'center' },
  brandMark: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: Colors.primary, marginBottom: 24, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 4 },
  brandLetter: { color: '#ffffff', fontSize: 28, fontWeight: '800' },
  eyebrow: { color: Colors.primaryDark, fontSize: 12, fontWeight: '700', marginBottom: 12, letterSpacing: 0.8 },
  title: { color: '#0F172A', fontSize: 34, fontWeight: '800' },
  subtitle: { color: '#64748B', fontSize: 16, lineHeight: 23, marginTop: 10, marginBottom: 32 },
  fieldGroup: { marginBottom: 18 },
  label: { color: '#1E293B', fontWeight: '700', fontSize: 14, marginBottom: 8 },
  input: { borderColor: Colors.light.border, borderWidth: 1.5, borderRadius: 12, backgroundColor: '#ffffff', color: '#0F172A', paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 16, lineHeight: 20 },
  submit: { minHeight: 52, backgroundColor: Colors.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 3 },
  submitText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  pressed: { opacity: 0.9, backgroundColor: Colors.primaryDark },
  disabled: { opacity: 0.65 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  footerText: { color: '#64748B' },
  footerLink: { color: Colors.primaryDark, fontWeight: '700' },
});