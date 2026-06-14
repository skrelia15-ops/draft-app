import type { isHealthAvailable as IsHealthAvailable } from './availability';
import type { RideHealth } from './types';

import type { queryQuantitySamples as QueryQuantitySamples } from '@kingstinct/react-native-healthkit';

/** Reduce raw heart-rate (bpm) and active-energy (kcal) sample values into
 *  a RideHealth summary. Pure — no HealthKit access. */
export function summarizeSamples(
  heartRates: number[],
  energies: number[],
): RideHealth {
  const avgHeartRate =
    heartRates.length > 0
      ? Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length)
      : null;
  const maxHeartRate =
    heartRates.length > 0 ? Math.round(Math.max(...heartRates)) : null;
  const activeCalories =
    energies.length > 0
      ? Math.round(energies.reduce((a, b) => a + b, 0))
      : null;
  return { avgHeartRate, maxHeartRate, activeCalories };
}

const ALL_NULL: RideHealth = {
  avgHeartRate: null,
  maxHeartRate: null,
  activeCalories: null,
};

/** Query Apple Health for the heart-rate (bpm) and active-energy (kcal)
 *  samples recorded during [startMs, endMs] and reduce them into a
 *  RideHealth. Returns all-null when HealthKit is unavailable or any
 *  native query throws. */
export async function summarizeRideHealth(
  startMs: number,
  endMs: number,
): Promise<RideHealth> {
  // Lazy-require native modules so the pure summarizeSamples (and its test)
  // never load HealthKit's native bindings.
  const { isHealthAvailable } =
    require('./availability') as { isHealthAvailable: typeof IsHealthAvailable };
  if (!(await isHealthAvailable())) return ALL_NULL;
  try {
    const { queryQuantitySamples } =
      require('@kingstinct/react-native-healthkit') as {
        queryQuantitySamples: typeof QueryQuantitySamples;
      };
    const date = { startDate: new Date(startMs), endDate: new Date(endMs) };
    const [heartRateSamples, energySamples] = await Promise.all([
      queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
        limit: 0,
        filter: { date },
        unit: 'count/min',
      }),
      queryQuantitySamples('HKQuantityTypeIdentifierActiveEnergyBurned', {
        limit: 0,
        filter: { date },
        unit: 'kcal',
      }),
    ]);
    const heartRates = heartRateSamples.map((s) => s.quantity);
    const energies = energySamples.map((s) => s.quantity);
    return summarizeSamples(heartRates, energies);
  } catch {
    return ALL_NULL;
  }
}
