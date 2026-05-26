import { Stack } from 'expo-router';

/**
 * Ride flow stack.
 * Presented as a full-screen modal from the root layout.
 *
 *   map → active → complete → insights
 *
 * The Map screen is the canonical entry point: it owns origin/destination
 * text inputs, Places autocomplete, map-pick, swap, and Google Directions
 * routing. From there the user goes straight into Active, then Complete /
 * Insights once the ride finishes.
 *
 * `route-details` is the secondary entry point for suggested loops (reached
 * from the Explore tab and Groups tab), where the user picks one of a few
 * sample routes instead of typing a destination.
 */
export default function RideLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="map" />
      <Stack.Screen name="plan" />
      <Stack.Screen name="route-details" />
      <Stack.Screen
        name="active"
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="complete"
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="insights" />
    </Stack>
  );
}
