import type { Weather } from '@/lib/weather/derive';

export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

const DIRECTIONS: CompassDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export type Conditions = {
  windKmh: number;
  windFrom: CompassDirection;
  draftAdvice: string;
  draftIndex: number;
  draftLabel: 'OPTIMAL' | 'GOOD' | 'FAIR' | 'POOR';
  /** Temperature, °C. */
  tempC: number;
  /** Feels-like, °C. */
  feelsLikeC: number;
  /** Whether it is currently raining/snowing. */
  isRaining: boolean;
  /** Rain volume last hour, mm. */
  rainMmLastHour: number;
};

/** Derive drafting conditions from a real weather reading. Pure. */
export function deriveConditions(weather: Weather): Conditions {
  const { windKmh, windFrom } = weather;

  let draftIndex: number;
  if (windKmh < 8) draftIndex = 62;
  else if (windKmh < 14) draftIndex = 92;
  else if (windKmh < 20) draftIndex = 80;
  else draftIndex = 60;

  let draftLabel: Conditions['draftLabel'];
  if (draftIndex >= 90) draftLabel = 'OPTIMAL';
  else if (draftIndex >= 75) draftLabel = 'GOOD';
  else if (draftIndex >= 60) draftLabel = 'FAIR';
  else draftLabel = 'POOR';

  const draftAdvice =
    windKmh >= 14
      ? `Wind from ${windFrom} · best drafting heading ${oppositeOf(windFrom)}.`
      : 'Light wind · most directions draft well.';

  return {
    windKmh,
    windFrom,
    draftAdvice,
    draftIndex,
    draftLabel,
    tempC: weather.tempC,
    feelsLikeC: weather.feelsLikeC,
    isRaining: weather.isRaining,
    rainMmLastHour: weather.rainMmLastHour,
  };
}

function oppositeOf(d: CompassDirection): CompassDirection {
  const i = DIRECTIONS.indexOf(d);
  return DIRECTIONS[(i + 4) % DIRECTIONS.length];
}
