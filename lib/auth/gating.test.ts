import { resolveRedirect, type GateState } from './gating';

const base: GateState = {
  authLoading: false,
  hasSession: false,
  profileLoaded: false,
  profileComplete: false,
  group: undefined,
  subgroup: undefined,
};

test('holds position while auth is loading', () => {
  expect(resolveRedirect({ ...base, authLoading: true })).toBeNull();
});

test('holds position when signed in but profile not loaded yet', () => {
  expect(
    resolveRedirect({ ...base, hasSession: true, profileLoaded: false }),
  ).toBeNull();
});

test('signed out at root -> slides', () => {
  expect(resolveRedirect({ ...base, group: undefined })).toBe('/onboarding');
});

test('signed out on slides -> stay', () => {
  expect(resolveRedirect({ ...base, group: 'onboarding' })).toBeNull();
});

test('signed out on auth -> stay', () => {
  expect(resolveRedirect({ ...base, group: 'auth' })).toBeNull();
});

test('signed out on tabs -> slides', () => {
  expect(resolveRedirect({ ...base, group: '(tabs)' })).toBe('/onboarding');
});

test('signed out cannot sit in the profile wizard -> slides', () => {
  expect(
    resolveRedirect({ ...base, group: 'onboarding', subgroup: 'profile' }),
  ).toBe('/onboarding');
});

test('signed in, profile incomplete, not in wizard -> wizard', () => {
  expect(
    resolveRedirect({
      ...base,
      hasSession: true,
      profileLoaded: true,
      profileComplete: false,
      group: '(tabs)',
    }),
  ).toBe('/onboarding/profile/basics');
});

test('signed in, profile incomplete, already in wizard -> stay', () => {
  expect(
    resolveRedirect({
      ...base,
      hasSession: true,
      profileLoaded: true,
      profileComplete: false,
      group: 'onboarding',
      subgroup: 'profile',
    }),
  ).toBeNull();
});

test('signed in + complete on auth -> tabs', () => {
  expect(
    resolveRedirect({
      ...base,
      hasSession: true,
      profileLoaded: true,
      profileComplete: true,
      group: 'auth',
    }),
  ).toBe('/(tabs)');
});

test('signed in + complete on slides -> tabs', () => {
  expect(
    resolveRedirect({
      ...base,
      hasSession: true,
      profileLoaded: true,
      profileComplete: true,
      group: 'onboarding',
    }),
  ).toBe('/(tabs)');
});

test('signed in + complete inside tabs -> stay', () => {
  expect(
    resolveRedirect({
      ...base,
      hasSession: true,
      profileLoaded: true,
      profileComplete: true,
      group: '(tabs)',
    }),
  ).toBeNull();
});

test('signed in + complete on a ride screen -> stay', () => {
  expect(
    resolveRedirect({
      ...base,
      hasSession: true,
      profileLoaded: true,
      profileComplete: true,
      group: 'ride',
    }),
  ).toBeNull();
});
