import type { RideRecord } from '@/lib/ride';

import { isHealthAvailable } from './availability';

import type {
  saveWorkoutSample as SaveWorkoutSample,
  WorkoutActivityType as WorkoutActivityTypeEnum,
  QuantitySampleForSaving,
  WorkoutTotals,
} from '@kingstinct/react-native-healthkit';

/** Save a finished ride to Apple Health as a cycling workout, including
 *  total distance (meters) and active calories (kcal) when available.
 *  No-op when HealthKit is unavailable; swallows any native error. */
export async function saveRideToHealth(ride: RideRecord): Promise<void> {
  if (!(await isHealthAvailable())) return;
  try {
    const {
      saveWorkoutSample,
      WorkoutActivityType,
    } = require('@kingstinct/react-native-healthkit') as {
      saveWorkoutSample: typeof SaveWorkoutSample;
      WorkoutActivityType: typeof WorkoutActivityTypeEnum;
    };

    const startDate = new Date(ride.startedAt);
    const endDate = new Date(ride.endedAt);
    const kcal = ride.health?.activeCalories ?? null;

    const quantities: QuantitySampleForSaving[] = [
      {
        startDate,
        endDate,
        quantityType: 'HKQuantityTypeIdentifierDistanceCycling',
        quantity: ride.distanceMeters,
        unit: 'm',
      },
    ];
    if (kcal != null) {
      quantities.push({
        startDate,
        endDate,
        quantityType: 'HKQuantityTypeIdentifierActiveEnergyBurned',
        quantity: kcal,
        unit: 'kcal',
      });
    }

    const totals: WorkoutTotals = {
      distance: ride.distanceMeters,
      ...(kcal != null ? { energyBurned: kcal } : {}),
    };

    await saveWorkoutSample(
      WorkoutActivityType.cycling,
      quantities,
      startDate,
      endDate,
      totals,
    );
  } catch {
    // Non-fatal: saving to Health is best-effort.
  }
}
