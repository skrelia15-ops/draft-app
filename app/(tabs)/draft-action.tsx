import { Redirect } from 'expo-router';

/**
 * Placeholder route for the center "Draft" action button.
 * This screen is never actually rendered — the custom tab bar button in
 * `app/(tabs)/_layout.tsx` intercepts the press and navigates to
 * `/ride/map` (the canonical ride-planning entry point) instead.
 *
 * If somehow reached directly (e.g. deep link), redirect to home.
 */
export default function DraftActionScreen() {
  return <Redirect href="/" />;
}
