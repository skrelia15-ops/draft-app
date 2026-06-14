/**
 * Riding-style Match model.
 *
 * Clear, multi-factor riding-style model the user can interpret at a glance:
 *
 *   - a riding STYLE label (Endurance / Sprint / Casual) derived from the
 *     rider's own history, and
 *   - a 0–100 MATCH score against nearby riders, weighted by pace,
 *     cadence consistency, and drafting behaviour.
 *
 * For a single-user prototype we derive both from the device, but the
 * same shape works once a real social graph is wired up.
 */
import type { NearbyRider } from './proximity';
import type { RideRecord } from './types';

export type RidingStyle = 'ENDURANCE' | 'SPRINT' | 'CASUAL';

export type Compatibility = {
  /** 0–100 overall style-match score. */
  score: number;
  /** Human label for the score band. */
  tier: 'ELITE' | 'STRONG' | 'GOOD' | 'BUILDING';
  /** Inferred rider style from history. */
  style: RidingStyle;
  /** Plain-English label for the style ("Endurance rider", etc.). */
  styleLabel: string;
  /** Match % with the nearby pool — 0–100. */
  nearbyMatchPercent: number;
  /** How many of the nearby pool share the same riding style. */
  matchingRidersNearby: number;
  paceMatch: number;
  cadenceMatch: number;
  behaviorMatch: number;
  /** Plain-English explanation, suitable for a tooltip / inline body. */
  explanation: string;
};

/**
 * Build a stable Riding-Style Match from the rider's history.
 * With zero rides we return a neutral "Building" score so the UI never
 * shows a confusing "100% match" before the rider has done anything.
 */
export function getCompatibility(
  history: RideRecord[],
  nearby: NearbyRider[] = [],
): Compatibility {
  if (history.length === 0) {
    return {
      score: 0,
      tier: 'BUILDING',
      style: 'CASUAL',
      styleLabel: 'Casual rider',
      nearbyMatchPercent: 0,
      matchingRidersNearby: 0,
      paceMatch: 0,
      cadenceMatch: 0,
      behaviorMatch: 0,
      explanation: 'Complete your first ride to unlock your riding style.',
    };
  }

  const totalDistance = history.reduce((s, r) => s + r.distanceMeters, 0);
  const avgDraftShare =
    history.reduce((s, r) => s + r.draftingFraction, 0) / history.length;
  const avgSpeed =
    history.reduce((s, r) => s + r.avgSpeedKmh, 0) / history.length;
  const avgMaxSpeed =
    history.reduce((s, r) => s + r.maxSpeedKmh, 0) / history.length;
  const avgDuration =
    history.reduce((s, r) => s + r.durationSec, 0) / history.length;
  const efficiency =
    history.reduce((s, r) => s + r.energySavedPercent, 0) / history.length;

  // ── Pace, cadence, behaviour sub-scores ───────────────────────────────

  // Pace match: 22–34 km/h is the sweet spot for group drafting; anchor the
  // score on how close the rider's avg pace sits inside that band.
  const paceMatch = Math.round(
    100 - Math.min(100, Math.abs(avgSpeed - 28) * 6),
  );

  // Cadence match: we don't have cadence sensors, so we infer steadiness
  // from how much the rider's drafting share varied between rides. A rider
  // who consistently sits in the draft has a steadier cadence.
  const draftVariance =
    history.length > 1
      ? history.reduce(
          (s, r) => s + Math.abs(r.draftingFraction - avgDraftShare),
          0,
        ) / history.length
      : 0.15;
  const cadenceMatch = Math.round(Math.max(40, 100 - draftVariance * 200));

  // Behaviour match: how often the rider successfully held a draft.
  const behaviorMatch = Math.round(50 + efficiency * 1.4);

  // ── Riding style inference ────────────────────────────────────────────
  // Heuristic, but stable and explainable:
  //   - Sprint:    short-but-fast — high max speed, average duration < 45m
  //   - Endurance: long duration / distance, steady avg pace 22–32 km/h
  //   - Casual:    everything else (low pace and/or short rides)
  const avgDistanceKm = totalDistance / history.length / 1000;
  const avgDurationMin = avgDuration / 60;

  let style: RidingStyle;
  if (avgMaxSpeed >= 36 && avgDurationMin < 50) {
    style = 'SPRINT';
  } else if (avgDistanceKm >= 12 && avgSpeed >= 22 && avgSpeed <= 34) {
    style = 'ENDURANCE';
  } else if (avgSpeed >= 26 && avgDurationMin >= 30) {
    style = 'ENDURANCE';
  } else {
    style = 'CASUAL';
  }

  // ── Overall score ─────────────────────────────────────────────────────
  const score = Math.round(
    paceMatch * 0.35 + cadenceMatch * 0.3 + behaviorMatch * 0.35,
  );

  let tier: Compatibility['tier'];
  if (score >= 88) tier = 'ELITE';
  else if (score >= 75) tier = 'STRONG';
  else if (score >= 60) tier = 'GOOD';
  else tier = 'BUILDING';

  // ── Match against nearby pool ─────────────────────────────────────────
  const { percent: nearbyMatchPercent, matching: matchingRidersNearby } =
    matchAgainstNearby(style, avgSpeed, nearby);

  const distanceKm = Math.round(totalDistance / 100) / 10;
  const explanation =
    `Based on ${history.length} ride${history.length === 1 ? '' : 's'} · ${distanceKm} km.`;

  return {
    score: clamp01(score),
    tier,
    style,
    styleLabel: styleLabelFor(style),
    nearbyMatchPercent,
    matchingRidersNearby,
    paceMatch: clamp01(paceMatch),
    cadenceMatch: clamp01(cadenceMatch),
    behaviorMatch: clamp01(behaviorMatch),
    explanation,
  };
}

function styleLabelFor(style: RidingStyle): string {
  switch (style) {
    case 'SPRINT':
      return 'Sprint rider';
    case 'ENDURANCE':
      return 'Endurance rider';
    case 'CASUAL':
      return 'Casual rider';
  }
}

/**
 * Infer the style a nearby rider is likely riding in right now from their
 * pace. We compare that with the user's own style and same-direction status
 * to produce a 0–100 nearby match score.
 */
function matchAgainstNearby(
  userStyle: RidingStyle,
  userAvgKmh: number,
  nearby: NearbyRider[],
): { percent: number; matching: number } {
  if (nearby.length === 0) return { percent: 0, matching: 0 };

  let matching = 0;
  let weightedSum = 0;
  for (const rider of nearby) {
    const inferred = inferStyleFromPace(rider.paceKmh);
    const styleHit = inferred === userStyle ? 1 : 0;
    matching += styleHit;
    // Pace gap → 0–1 closeness.
    const paceCloseness = Math.max(
      0,
      1 - Math.abs(rider.paceKmh - userAvgKmh) / 10,
    );
    const directionBonus = rider.sameDirection ? 1 : 0.4;
    weightedSum += (styleHit * 0.5 + paceCloseness * 0.5) * directionBonus;
  }
  const percent = Math.round((weightedSum / nearby.length) * 100);
  return { percent: clamp01(percent), matching };
}

function inferStyleFromPace(paceKmh: number): RidingStyle {
  if (paceKmh >= 32) return 'SPRINT';
  if (paceKmh >= 22) return 'ENDURANCE';
  return 'CASUAL';
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
