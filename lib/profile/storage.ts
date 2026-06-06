/**
 * Persistence shim for the user profile. AsyncStorage today; a
 * Supabase row tomorrow. Keep the surface (`loadProfile`, `saveProfile`)
 * narrow so the swap is a one-file change.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PROFILE, type Profile } from './types';

const KEY = '@draft/profile/v1';

export async function loadProfile(): Promise<Profile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    // Merge against defaults so missing keys don't crash the UI when we
    // add new fields between releases.
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      bike: parsed.bike
        ? { ...DEFAULT_PROFILE.bike!, ...parsed.bike }
        : DEFAULT_PROFILE.bike,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function saveProfile(profile: Profile): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Failures are non-fatal — the UI keeps the in-memory copy. We
    // surface a toast at the call site for visibility.
  }
}

export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
