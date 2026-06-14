import type { WeatherDTO } from './types';

const WET_GROUPS = new Set(['Rain', 'Drizzle', 'Snow', 'Thunderstorm']);

/**
 * Convert an OpenWeather "Current Weather 2.5" payload into our DTO.
 * `observedAt` is passed in so this stays pure (no clock access).
 */
export function normalizeOpenWeather(raw: any, observedAt: number): WeatherDTO {
  const group = raw?.weather?.[0]?.main ?? 'Clear';
  return {
    windKmh: Math.round((raw?.wind?.speed ?? 0) * 3.6),
    windDeg: Math.round(raw?.wind?.deg ?? 0),
    tempC: Math.round(raw?.main?.temp ?? 0),
    feelsLikeC: Math.round(raw?.main?.feels_like ?? 0),
    isRaining: WET_GROUPS.has(group),
    rainMmLastHour: Math.round((raw?.rain?.['1h'] ?? 0) * 10) / 10,
    observedAt,
  };
}
