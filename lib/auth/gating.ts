import type { Profile } from '@/lib/profile';

export type GateInput = { hasSession: boolean; profile: Profile | null };
export type Route = '/auth' | '/onboarding/profile/basics' | '/(tabs)';

/**
 * Pure decision for the start route. Returns null when we must wait
 * (logged in but the profile row hasn't loaded yet) so the caller can
 * keep the splash up instead of flashing the wrong screen.
 */
export function resolveRoute(input: GateInput): Route | null {
  if (!input.hasSession) return '/auth';
  if (input.profile == null) return null;
  if (input.profile.name.trim().length === 0) return '/onboarding/profile/basics';
  return '/(tabs)';
}
