import type { RideHealth } from './types';

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
