/**
 * Pure navigation gate.
 *
 * Given the auth/profile state and where the user currently is (the first
 * two route segments), decide whether they're in the wrong place and where
 * to send them. Returns null to stay put.
 *
 * The pre-auth funnel is: onboarding slides -> auth (sign in / sign up) ->
 * profile wizard -> tabs. So a signed-out user is allowed to roam the
 * slides and the auth screens; anything else bounces them back to the
 * slides. A signed-in user with no profile is forced into the wizard. A
 * fully set-up user is kept out of the pre-auth funnel.
 */

export type NavGroup = string | undefined;

export type GateState = {
  /** True until the auth session check resolves. */
  authLoading: boolean;
  hasSession: boolean;
  /** True once the profile row has been read for the current session. */
  profileLoaded: boolean;
  /** Whether the loaded profile has a non-empty name (setup complete). */
  profileComplete: boolean;
  /** First path segment: 'onboarding' | 'auth' | '(tabs)' | 'ride' | 'goals' | undefined. */
  group: NavGroup;
  /** Second path segment, e.g. 'profile' inside onboarding. */
  subgroup: NavGroup;
};

export type RedirectTarget =
  | '/onboarding'
  | '/onboarding/profile/basics'
  | '/(tabs)'
  | null;

export function resolveRedirect(s: GateState): RedirectTarget {
  // Hold position (caller keeps the splash up) until we know the session,
  // and — if signed in — until the profile row has loaded.
  if (s.authLoading) return null;
  if (s.hasSession && !s.profileLoaded) return null;

  const inOnboarding = s.group === 'onboarding';
  const inAuth = s.group === 'auth';
  const inProfileWizard = inOnboarding && s.subgroup === 'profile';

  if (!s.hasSession) {
    if (inOnboarding && !inProfileWizard) return null; // slides
    if (inAuth) return null; // sign in / sign up
    return '/onboarding'; // bounce everything else to the slides
  }

  if (!s.profileComplete) {
    return inProfileWizard ? null : '/onboarding/profile/basics';
  }

  // Fully set up — keep out of the pre-auth funnel (slides/auth/root).
  if (inAuth || inOnboarding || s.group == null) return '/(tabs)';
  return null;
}
