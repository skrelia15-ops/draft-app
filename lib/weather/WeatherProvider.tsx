import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { useUserLocation } from '@/hooks/useUserLocation';
import { ODESSA, type LatLng } from '@/lib/maps';
import { fetchWeather } from './api';
import { pickCoords } from './resolveCoords';
import { loadLastCoords, saveLastCoords, loadLastWeather, saveLastWeather } from './storage';
import type { Weather } from './derive';

const REFRESH_MS = 15 * 60 * 1000;

type WeatherContextValue = {
  weather: Weather | null;
  observedAt: number | null;
  refresh: () => void;
};

const WeatherContext = createContext<WeatherContextValue | null>(null);

export function WeatherProvider({ children }: { children: ReactNode }) {
  const { coords } = useUserLocation();
  const [lastKnown, setLastKnown] = useState<LatLng | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);

  // Hydrate last-known coords + last good weather once.
  useEffect(() => {
    loadLastCoords().then(setLastKnown);
    loadLastWeather().then((w) => { if (w) setWeather(w); });
  }, []);

  // Persist live coords as they arrive.
  useEffect(() => {
    if (coords) { setLastKnown(coords); saveLastCoords(coords); }
  }, [coords]);

  const target = useMemo(() => pickCoords(coords, lastKnown, ODESSA), [coords, lastKnown]);

  // Round the cell so tiny GPS jitter doesn't refetch.
  const cellKey = `${target.latitude.toFixed(2)},${target.longitude.toFixed(2)}`;

  const load = useCallback(async () => {
    try {
      const w = await fetchWeather(target);
      setWeather(w);
      saveLastWeather(w);
    } catch {
      // Keep the last good value; card never goes blank.
    }
  }, [target]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellKey]);

  const value = useMemo(
    () => ({ weather, observedAt: weather?.observedAt ?? null, refresh: load }),
    [weather, load],
  );

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather(): WeatherContextValue {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error('useWeather must be used inside <WeatherProvider>.');
  return ctx;
}
