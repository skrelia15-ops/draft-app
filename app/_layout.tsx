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
import { RideProvider } from '@/lib/ride';

// #region agent log
fetch('http://127.0.0.1:7579/ingest/50ab54ea-04ae-4695-90b6-ffc8b34d4312',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1ed8cb'},body:JSON.stringify({sessionId:'1ed8cb',location:'app/_layout.tsx:module',message:'root layout module loaded',data:{ok:true},timestamp:Date.now(),hypothesisId:'B',runId:'pre-fix'})}).catch(()=>{});
// #endregion

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
    // #region agent log
    fetch('http://127.0.0.1:7579/ingest/50ab54ea-04ae-4695-90b6-ffc8b34d4312',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1ed8cb'},body:JSON.stringify({sessionId:'1ed8cb',location:'app/_layout.tsx:fonts',message:'font load state',data:{loaded,hasError:!!error,errorMsg:error?String(error):null},timestamp:Date.now(),hypothesisId:'C',runId:'pre-fix'})}).catch(()=>{});
    // #endregion
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7579/ingest/50ab54ea-04ae-4695-90b6-ffc8b34d4312',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1ed8cb'},body:JSON.stringify({sessionId:'1ed8cb',location:'app/_layout.tsx:mount',message:'RootLayout rendered',data:{loaded,hasError:!!error,hasRideProvider:true},timestamp:Date.now(),hypothesisId:'A',runId:'post-fix'})}).catch(()=>{});
    // #endregion
  }, []);

  if (!loaded && !error) {
    return null;
  }

  return (
    <RideProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="ride"
          options={{ presentation: 'fullScreenModal' }}
        />
      </Stack>
      <StatusBar style="light" />
    </RideProvider>
  );
}
