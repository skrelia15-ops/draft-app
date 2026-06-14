// Expo config plugin: initialize the Google Maps iOS SDK at launch.
//
// react-native-maps' PROVIDER_GOOGLE on iOS requires the GoogleMaps SDK to
// be initialized with `GMSServices.provideAPIKey(...)` in the AppDelegate.
// Expo writes the key to Info.plist (GMSApiKey via ios.config.googleMapsApiKey)
// but never calls provideAPIKey, so the SDK aborts. This plugin patches the
// Swift AppDelegate to read GMSApiKey from Info.plist and initialize the SDK,
// surviving every `expo prebuild`.
const { withAppDelegate } = require('@expo/config-plugins');

const IMPORT_LINE = 'import GoogleMaps';
const INIT_BLOCK =
  '    if let googleMapsApiKey = Bundle.main.object(forInfoDictionaryKey: "GMSApiKey") as? String, !googleMapsApiKey.isEmpty {\n' +
  '      GMSServices.provideAPIKey(googleMapsApiKey)\n' +
  '    }\n\n';

module.exports = function withGoogleMapsInit(config) {
  return withAppDelegate(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (!contents.includes(IMPORT_LINE)) {
      contents = contents.replace(
        'import Expo\n',
        'import Expo\n' + IMPORT_LINE + '\n',
      );
    }

    if (!contents.includes('GMSServices.provideAPIKey')) {
      contents = contents.replace(
        '    let delegate = ReactNativeDelegate()',
        INIT_BLOCK + '    let delegate = ReactNativeDelegate()',
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
};
