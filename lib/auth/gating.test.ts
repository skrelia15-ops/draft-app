import { resolveRoute } from './gating';
import { DEFAULT_PROFILE } from '@/lib/profile';

test('no session -> auth', () => {
  expect(resolveRoute({ hasSession: false, profile: null })).toBe('/auth');
});

test('session but no profile loaded yet -> null (wait)', () => {
  expect(resolveRoute({ hasSession: true, profile: null })).toBeNull();
});

test('session + empty-name profile -> profile wizard', () => {
  expect(resolveRoute({ hasSession: true, profile: { ...DEFAULT_PROFILE, name: '' } }))
    .toBe('/onboarding/profile/basics');
});

test('session + named profile -> tabs', () => {
  expect(resolveRoute({ hasSession: true, profile: { ...DEFAULT_PROFILE, name: 'Sam' } }))
    .toBe('/(tabs)');
});
