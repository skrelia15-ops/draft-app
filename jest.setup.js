// Silence Expo winter runtime noise in unit tests.
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { supabaseUrl: 'http://localhost', supabasePublishableKey: 'test-key' } },
}));
