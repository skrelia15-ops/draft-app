import { Platform } from 'react-native';
import type { isHealthDataAvailable as IsHealthDataAvailable } from '@kingstinct/react-native-healthkit';

/** Whether Apple HealthKit is usable on this device.
 *  Always false off-iOS; degrades to false on any native error.
 *  Uses a lazy require so the native module never loads at import time
 *  (keeps the barrel safe to import from non-iOS / test contexts). */
export async function isHealthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const { isHealthDataAvailable } =
      require('@kingstinct/react-native-healthkit') as {
        isHealthDataAvailable: typeof IsHealthDataAvailable;
      };
    return isHealthDataAvailable();
  } catch {
    return false;
  }
}
