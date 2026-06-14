import AsyncStorage from '@react-native-async-storage/async-storage';
import type { requestAuthorization as RequestAuthorization } from '@kingstinct/react-native-healthkit';

import { isHealthAvailable } from './availability';

const ASKED_FLAG = '@draft/health/asked/v1';

/** Request HealthKit read/write authorization and record that we asked.
 *  Returns false when HealthKit is unavailable or the native call throws.
 *  Lazy require keeps the native module off the import path. */
export async function requestHealthAuth(): Promise<boolean> {
  if (!(await isHealthAvailable())) return false;
  try {
    const { requestAuthorization } =
      require('@kingstinct/react-native-healthkit') as {
        requestAuthorization: typeof RequestAuthorization;
      };
    await requestAuthorization({
      toRead: [
        'HKQuantityTypeIdentifierHeartRate',
        'HKQuantityTypeIdentifierActiveEnergyBurned',
      ],
      toShare: [
        'HKWorkoutTypeIdentifier',
        'HKQuantityTypeIdentifierDistanceCycling',
        'HKQuantityTypeIdentifierActiveEnergyBurned',
      ],
    });
    await AsyncStorage.setItem(ASKED_FLAG, '1');
    return true;
  } catch {
    return false;
  }
}

/** Whether we have previously prompted the user for HealthKit access. */
export async function hasAskedHealthAuth(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ASKED_FLAG)) === '1';
  } catch {
    return false;
  }
}
