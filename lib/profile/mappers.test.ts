import { rowToProfile, profileToRow } from './mappers';
import { DEFAULT_PROFILE } from './types';

const row = {
  id: 'user-1',
  name: 'Sam Rider',
  skill_level: 'Elite' as const,
  avg_pace_kmh: 31,
  avatar_url: null,
  bike: { name: 'Tarmac', type: 'Road' as const, weightKg: 7.1 },
  weekly_ride_goal: 6,
  updated_at: '2026-06-06T00:00:00.000Z',
};

test('rowToProfile maps snake_case row to camelCase Profile', () => {
  const p = rowToProfile(row);
  expect(p.id).toBe('user-1');
  expect(p.name).toBe('Sam Rider');
  expect(p.skillLevel).toBe('Elite');
  expect(p.avgPaceKmh).toBe(31);
  expect(p.avatarUri).toBeNull();
  expect(p.bike).toEqual({ name: 'Tarmac', type: 'Road', weightKg: 7.1 });
  expect(p.weeklyRideGoal).toBe(6);
  expect(p.updatedAt).toBe(Date.parse('2026-06-06T00:00:00.000Z'));
});

test('rowToProfile handles null bike', () => {
  expect(rowToProfile({ ...row, bike: null }).bike).toBeNull();
});

test('profileToRow maps Profile to an update payload (no id/updated_at)', () => {
  const payload = profileToRow({ ...DEFAULT_PROFILE, id: 'user-1', name: 'A' });
  expect(payload).toEqual({
    name: 'A',
    skill_level: DEFAULT_PROFILE.skillLevel,
    avg_pace_kmh: DEFAULT_PROFILE.avgPaceKmh,
    avatar_url: DEFAULT_PROFILE.avatarUri,
    bike: DEFAULT_PROFILE.bike,
    weekly_ride_goal: DEFAULT_PROFILE.weeklyRideGoal,
  });
});
