import Constants from 'expo-constants';
import { PROVIDER_GOOGLE } from 'react-native-maps';

const hasGoogleMapsKey = !!(
  Constants.expoConfig?.extra?.googleMapsApiKey as string | undefined
);

/**
 * Provider to pass to every <MapView>.
 *
 * Google when a Maps API key is configured (the goal); otherwise
 * `undefined` → the platform default (Apple Maps on iOS). Forcing
 * `PROVIDER_GOOGLE` on iOS with no key crashes the native Google Maps
 * SDK, so this degrades gracefully instead of hard-crashing the app.
 */
export const MAP_PROVIDER = hasGoogleMapsKey ? PROVIDER_GOOGLE : undefined;
