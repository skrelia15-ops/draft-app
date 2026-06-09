import { Stack } from 'expo-router';
import { SignUpFlowProvider } from '@/lib/auth';

export default function SignUpLayout() {
  return (
    <SignUpFlowProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SignUpFlowProvider>
  );
}
