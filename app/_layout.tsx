import { Stack } from 'expo-router';
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
import { ProfileProvider } from '@/lib/profile';
import { toastConfig } from '@/components/ui/draft/toast-config';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'onboarding',
};

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
    <ProfileProvider>
      <RideProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="ride"
            options={{ presentation: 'fullScreenModal' }}
          />
          <Stack.Screen name="goals" />
        </Stack>
        <StatusBar style="light" />
        <Toast config={toastConfig} />
      </RideProvider>
    </ProfileProvider>
  );
}
