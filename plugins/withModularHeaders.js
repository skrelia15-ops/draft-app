// Expo config plugin: inject `use_modular_headers!` into the iOS Podfile.
//
// Google Sign-In's transitive pods (AppCheckCore / GoogleUtilities /
// RecaptchaInterop) ship without module maps, which breaks Swift static
// linking and fails `pod install`. Adding `use_modular_headers!` globally
// generates the needed module maps. Done via a config plugin (not a manual
// Podfile edit) so it survives every `expo prebuild`.
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        'Podfile',
      );
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes('use_modular_headers!')) {
        contents = contents.replace(
          /use_expo_modules!/,
          'use_expo_modules!\n  use_modular_headers!',
        );
        fs.writeFileSync(podfilePath, contents);
      }
      return cfg;
    },
  ]);
};
