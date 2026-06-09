// app/groups/_layout.tsx
import { Stack } from 'expo-router';

export default function GroupsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/schedule-ride" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
