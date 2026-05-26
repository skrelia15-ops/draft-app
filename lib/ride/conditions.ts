/**
 * Lightweight wind / conditions simulation.
 *
 * Real weather would be a server call. For the prototype, we generate
 * a deterministic but plausible "current" reading from the wall clock,
 * so the rest of the UI can use it as real data (and so the values
 * change naturally over the day instead of being baked-in placeholders).
 */

export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

const DIRECTIONS: CompassDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export type Conditions = {
  /** Wind speed in km/h. */
  windKmh: number;
  /** Where the wind is coming from. */
  windFrom: CompassDirection;
  /** Plain-English summary of how the wind affects drafting. */
  draftAdvice: string;
  /** 0–100. How good conditions are for drafting right now. */
  draftIndex: number;
  /** "OPTIMAL" / "GOOD" / "FAIR" / "POOR". */
  draftLabel: 'OPTIMAL' | 'GOOD' | 'FAIR' | 'POOR';
};

function hourBucket(): number {
  return Math.floor(Date.now() / (1000 * 60 * 30)); // 30-minute buckets
}

/** Deterministic conditions for the current half-hour window. */
export function getCurrentConditions(): Conditions {
  const bucket = hourBucket();
  const windKmh = 6 + (bucket % 18); // 6–23 km/h
  const windFrom = DIRECTIONS[(bucket >> 1) % DIRECTIONS.length];

  // Draft is "best" when wind isn't gusting too hard — over 20 km/h drafting
  // is still useful but riskier; under 8 km/h there's less aero benefit.
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

  return { windKmh, windFrom, draftAdvice, draftIndex, draftLabel };
}

function oppositeOf(d: CompassDirection): CompassDirection {
  const i = DIRECTIONS.indexOf(d);
  return DIRECTIONS[(i + 4) % DIRECTIONS.length];
}
