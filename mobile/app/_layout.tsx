import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { AppThemeProvider, useAppTheme } from '@/contexts/theme-context';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AppThemeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </AppThemeProvider>
  );
}

function RootLayoutNav() {
  const { theme, isLoading: themeLoading } = useAppTheme();
  const { isLoading, token } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!token && !inAuthGroup) router.replace('/login');
    if (token && inAuthGroup) router.replace('/');
  }, [isLoading, router, segments, token]);

  if (isLoading || themeLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors[theme].background }}>
        <StatusBar style={theme} />
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={{
      ...(theme === 'dark' ? DarkTheme : DefaultTheme),
      colors: {
        ...(theme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
        primary: Colors[theme].tint,
        background: Colors[theme].background,
        card: Colors[theme].cardBackground,
        text: Colors[theme].text,
        border: Colors[theme].border,
      },
    }}>
      <StatusBar style={theme} />
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="lesson/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="battle" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
