import type { ExpoConfig } from 'expo/config';

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';

// Reversed iOS OAuth client id (e.g. "com.googleusercontent.apps.1234-abc").
// Get it from the iOS OAuth client in Google Cloud Console. The google-signin
// config plugin REQUIRES this and throws on prebuild if it's missing or
// malformed — so we only register the plugin once it's actually set. Until
// then Apple Sign In still works and Google falls back to its in-app guard.
const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ?? '';
const googleSignInPlugin: ExpoConfig['plugins'] =
  googleIosUrlScheme.startsWith('com.googleusercontent.apps.')
    ? [['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }]]
    : [];

// Apple Sign In needs a paid Apple Developer membership + the "Sign in with
// Apple" capability. Until that's set up, leave it off so the native
// entitlement isn't added (an entitlement the App ID can't satisfy fails
// code signing on device/EAS builds). Set EXPO_PUBLIC_APPLE_AUTH_ENABLED="true"
// to enable the entitlement + plugin; the choose screen reads the same flag.
const appleAuthEnabled = process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED === 'true';
const appleSignInPlugin: ExpoConfig['plugins'] = appleAuthEnabled
  ? ['expo-apple-authentication']
  : [];

const config: ExpoConfig = {
  name: 'draft-app',
  slug: 'draft-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'draftapp',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.draftapp.app',
    // Adds the "Sign in with Apple" entitlement — only when the flag is on.
    usesAppleSignIn: appleAuthEnabled,
    config: {
      googleMapsApiKey,
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.draftapp.app',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    config: {
      googleMaps: {
        apiKey: googleMapsApiKey,
      },
    },
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    './plugins/withModularHeaders',
    './plugins/withGoogleMapsInit',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          backgroundColor: '#000000',
        },
      },
    ],
    'expo-asset',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Allow DRAFT to use your location to plan rides and show traffic-aware routes.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow DRAFT to access your photos so you can set a profile picture.',
        cameraPermission:
          'Allow DRAFT to use your camera so you can take a profile picture.',
      },
    ],
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription:
          'Allow DRAFT to read your heart rate and calories to enrich your ride stats.',
        NSHealthUpdateUsageDescription:
          'Allow DRAFT to save your rides to Apple Health as cycling workouts.',
      },
    ],
    // Both registered only when their feature flags are on (see top).
    ...appleSignInPlugin,
    ...googleSignInPlugin,
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    googleMapsApiKey,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  },
};

export default config;
