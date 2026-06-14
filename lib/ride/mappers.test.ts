import { rowToRide, rideToRow } from './mappers';
import type { RideRecord } from './types';

const ride: RideRecord = {
  id: 'ride-1',
  startedAt: 1000,
  endedAt: 5000,
  durationSec: 4,
  distanceMeters: 1200,
  avgSpeedKmh: 30,
  maxSpeedKmh: 42,
  samples: [{ t: 0, capturedAt: 1000, latitude: 1, longitude: 2, speedMs: 5, drafting: false }],
  segments: [{ index: 0, startKm: 0, endKm: 1, avgSpeedKmh: 30, drafting: false, draftEfficiency: 0, label: 'x' }],
  draftingFraction: 0.4,
  energySavedPercent: 12,
  energySavedWatts: 30,
  potentialExtraEnergyPercent: 8,
  routeName: 'Loop',
  origin: { latitude: 1, longitude: 2 },
  destination: { latitude: 3, longitude: 4 },
};

test('rideToRow then rowToRide round-trips the record', () => {
  const row = rideToRow(ride, 'user-1');
  expect(row.user_id).toBe('user-1');
  expect(row.id).toBe('ride-1');
  expect(row.distance_meters).toBe(1200);
  const back = rowToRide(row);
  expect(back).toEqual(ride);
});

test('rowToRide coerces null timestamps and numerics to 0 (no NaN)', () => {
  const row = rideToRow(ride, 'u');
  const back = rowToRide({
    ...row,
    started_at: null as never,
    ended_at: 'garbage',
    distance_meters: null as never,
    avg_speed_kmh: null as never,
  });
  expect(back.startedAt).toBe(0);
  expect(back.endedAt).toBe(0);
  expect(back.distanceMeters).toBe(0);
  expect(back.avgSpeedKmh).toBe(0);
});

test('rowToRide tolerates missing optional route fields', () => {
  const row = rideToRow({ ...ride, routeName: undefined, origin: undefined, destination: undefined }, 'u');
  const back = rowToRide(row);
  expect(back.routeName).toBeUndefined();
  expect(back.origin).toBeUndefined();
  expect(back.destination).toBeUndefined();
});

test('round-trips health metrics through the row', () => {
  const withHealth = {
    ...ride,
    health: { avgHeartRate: 142, maxHeartRate: 171, activeCalories: 540 },
  };
  const row = rideToRow(withHealth, 'user-1');
  expect(row.avg_heart_rate).toBe(142);
  expect(row.max_heart_rate).toBe(171);
  expect(row.active_calories).toBe(540);
  expect(rowToRide(row).health).toEqual(withHealth.health);
});

test('omits health when all metrics are null/absent', () => {
  const row = rideToRow(ride, 'user-1');
  expect(row.avg_heart_rate).toBe(null);
  expect(rowToRide(row).health).toBeUndefined();
});
