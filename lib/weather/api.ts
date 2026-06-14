import { supabase } from '@/lib/supabase';
import type { LatLng } from '@/lib/maps';
import { toWeather, type Weather } from './derive';
import type { WeatherDTO } from './types';

/** Fetch current weather for a coordinate via the `weather` Edge Function. */
export async function fetchWeather(coords: LatLng): Promise<Weather> {
  const { data, error } = await supabase.functions.invoke('weather', {
    body: { lat: coords.latitude, lng: coords.longitude },
  });
  if (error) throw new Error(error.message);
  return toWeather(data as WeatherDTO);
}
