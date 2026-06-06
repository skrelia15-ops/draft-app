import { WizardProvider } from '@/lib/onboarding/WizardProvider';
import { Stack } from 'expo-router';

export default function ProfileWizardLayout() {
  return (
    <WizardProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="basics" />
        <Stack.Screen name="bike" />
      </Stack>
    </WizardProvider>
  );
}
