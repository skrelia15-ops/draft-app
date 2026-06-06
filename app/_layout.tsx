import { Redirect, Stack, useSegments, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import {
  DarkerGrotesque_500Medium,
  DarkerGrotesque_600SemiBold,
  DarkerGrotesque_700Bold,
  DarkerGrotesque_800ExtraBold,
} from '@expo-google-fonts/darker-grotesque';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { RideProvider } from '@/lib/ride';
import { ProfileProvider, useProfile } from '@/lib/profile';
import { AuthProvider, useAuth, resolveRedirect } from '@/lib/auth';
import { toastConfig } from '@/components/ui/draft/toast-config';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading: authLoading, session } = useAuth();
  const { profile, isHydrated } = useProfile();
  const segments = useSegments();

  const hasSession = !!session;
  // While signed in we wait for the profile row to load before deciding,
  // so we don't flash the wizard at a returning, fully-set-up user.
  const waiting = authLoading || (hasSession && !isHydrated);

  const redirect = waiting
    ? null
    : resolveRedirect({
        authLoading,
        hasSession,
        profileLoaded: isHydrated,
        profileComplete: isHydrated && profile.name.trim().length > 0,
        group: segments[0],
        subgroup: segments[1],
      });

  // Keep the splash up until we know where the user belongs.
  if (waiting) return null;

  return (
    <>
      {/* Cast: '/onboarding/profile/basics' is added by the profile-wizard
          screens in a later phase; until then typed-routes doesn't know it. */}
      {redirect && <Redirect href={redirect as Href} />}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="ride"
          options={{ presentation: 'fullScreenModal' }}
        />
        <Stack.Screen name="goals" />
      </Stack>
      <StatusBar style="light" />
      <Toast config={toastConfig} />
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    DarkerGrotesque_500Medium,
    DarkerGrotesque_600SemiBold,
    DarkerGrotesque_700Bold,
    DarkerGrotesque_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <AuthProvider>
      <ProfileProvider>
        <RideProvider>
          <RootNavigator />
        </RideProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
