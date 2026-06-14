// Expo config plugin: iOS Podfile tweaks that Expo prebuild can't express
// declaratively. Applied on every `expo prebuild` so manual edits never
// get lost.
//
// 1. `use_modular_headers!` — Google Sign-In's transitive pods
//    (AppCheckCore / GoogleUtilities / RecaptchaInterop) ship without
//    module maps, which breaks Swift static linking and fails `pod install`.
//
// 2. `react-native-google-maps` pod — react-native-maps only links Apple
//    Maps on iOS by default. To use `provider={PROVIDER_GOOGLE}` we must
//    add its Google subspec (pulls the GoogleMaps SDK). The library ships
//    no Expo plugin, so we inject the pod here.
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const GOOGLE_MAPS_POD =
  "pod 'react-native-google-maps', :path => '../node_modules/react-native-maps'";

module.exports = function withIosPodfileTweaks(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        'Podfile',
      );
      let contents = fs.readFileSync(podfilePath, 'utf8');

      // 1. modular headers
      if (!contents.includes('use_modular_headers!')) {
        contents = contents.replace(
          /use_expo_modules!/,
          'use_expo_modules!\n  use_modular_headers!',
        );
      }

      // 2. Google Maps iOS SDK for react-native-maps
      if (!contents.includes('react-native-google-maps')) {
        contents = contents.replace(
          /use_modular_headers!/,
          `use_modular_headers!\n  ${GOOGLE_MAPS_POD}`,
        );
      }

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};
