import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import type { subscribeToQuantitySamples as SubscribeToQuantitySamples } from '@kingstinct/react-native-healthkit';

/** Live heart rate in bpm while `active`. Subscribes to HealthKit
 *  heart-rate samples on iOS and returns the most recent rounded value.
 *  Returns null off-iOS, before the first sample, or on any native error. */
export function useLiveHeartRate(active: boolean): number | null {
  const [bpm, setBpm] = useState<number | null>(null);

  useEffect(() => {
    if (!active || Platform.OS !== 'ios') {
      setBpm(null);
      return;
    }

    let subscription: { remove: () => boolean } | null = null;
    try {
      const { subscribeToQuantitySamples } =
        require('@kingstinct/react-native-healthkit') as {
          subscribeToQuantitySamples: typeof SubscribeToQuantitySamples;
        };
      subscription = subscribeToQuantitySamples(
        'HKQuantityTypeIdentifierHeartRate',
        (args) => {
          if (!('samples' in args) || args.samples.length === 0) return;
          // Heart-rate samples arrive in the default unit count/s; convert
          // to beats-per-minute. Use the latest sample in the batch.
          const latest = args.samples[args.samples.length - 1];
          setBpm(Math.round(latest.quantity * 60));
        },
      );
    } catch {
      setBpm(null);
    }

    return () => {
      try {
        subscription?.remove();
      } catch {
        // ignore teardown failures
      }
    };
  }, [active]);

  return bpm;
}
