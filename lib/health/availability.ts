import { Platform } from 'react-native';
import { isHealthDataAvailable } from '@kingstinct/react-native-healthkit';

/** Whether Apple HealthKit is usable on this device.
 *  Always false off-iOS; degrades to false on any native error. */
export async function isHealthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return isHealthDataAvailable();
  } catch {
    return false;
  }
}
