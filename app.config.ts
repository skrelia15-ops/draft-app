import type { ExpoConfig } from 'expo/config';

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';

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
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    googleMapsApiKey,
  },
};

export default config;
