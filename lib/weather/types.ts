/**
 * Wire contract between the `weather` Edge Function and the client.
 * Primitives only: no path aliases or RN deps, so the Deno function can
 * import this file directly.
 */
export type WeatherDTO = {
  /** Wind speed, km/h (OpenWeather m/s × 3.6, rounded). */
  windKmh: number;
  /** Wind direction OpenWeather reports it is coming FROM, degrees. */
  windDeg: number;
  /** Temperature, °C, rounded. */
  tempC: number;
  /** Feels-like temperature, °C, rounded. */
  feelsLikeC: number;
  /** True when the current condition group is wet (Rain/Drizzle/Snow/Thunderstorm). */
  isRaining: boolean;
  /** Rain volume in the last hour, mm (0 when absent). */
  rainMmLastHour: number;
  /** Epoch ms when this reading was fetched from OpenWeather. */
  observedAt: number;
};
