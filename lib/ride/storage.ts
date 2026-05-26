/**
 * AsyncStorage-backed ride history persistence.
 *
 * We only keep the most recent N rides (and downsample their GPS traces
 * on save) so the JSON we store stays small and parse is fast.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { downsample, MAX_PERSISTED_SAMPLES } from './telemetry';
import type { RideRecord } from './types';

const KEY = 'draft.rides.v1';
const MAX_RIDES = 12;

export async function loadHistory(): Promise<RideRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RideRecord[];
    if (!Array.isArray(parsed)) return [];
    // Sort newest-first to be defensive about pre-existing data.
    return parsed.slice(-MAX_RIDES).sort((a, b) => b.endedAt - a.endedAt);
  } catch (e) {
    if (__DEV__) console.warn('[ride/storage] loadHistory failed', e);
    return [];
  }
}

export async function saveHistory(history: RideRecord[]): Promise<void> {
  try {
    const trimmed = history
      .slice(0, MAX_RIDES)
      .map((r) => ({
        ...r,
        samples: downsample(r.samples, MAX_PERSISTED_SAMPLES),
      }));
    await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch (e) {
    if (__DEV__) console.warn('[ride/storage] saveHistory failed', e);
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (e) {
    if (__DEV__) console.warn('[ride/storage] clearHistory failed', e);
  }
}
