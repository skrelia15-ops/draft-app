import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LatLng } from '@/lib/maps';
import type { Weather } from './derive';

const COORDS_KEY = '@draft/weather/last-coords/v1';
const WEATHER_KEY = '@draft/weather/last-good/v1';

export async function saveLastCoords(c: LatLng): Promise<void> {
  try { await AsyncStorage.setItem(COORDS_KEY, JSON.stringify(c)); } catch {}
}

export async function loadLastCoords(): Promise<LatLng | null> {
  try {
    const raw = await AsyncStorage.getItem(COORDS_KEY);
    return raw ? (JSON.parse(raw) as LatLng) : null;
  } catch { return null; }
}

export async function saveLastWeather(w: Weather): Promise<void> {
  try { await AsyncStorage.setItem(WEATHER_KEY, JSON.stringify(w)); } catch {}
}

export async function loadLastWeather(): Promise<Weather | null> {
  try {
    const raw = await AsyncStorage.getItem(WEATHER_KEY);
    return raw ? (JSON.parse(raw) as Weather) : null;
  } catch { return null; }
}
