/**
 * Post-ride insights computation.
 *
 * Takes a finished RideRecord and produces the structured payload the
 * Insights screen needs to render: best/worst segments, missed
 * opportunities, prioritised recommendations, and a comparison with the
 * previous ride.
 */
import type { RideRecord, RideSample, RideSegment } from './types';
import { haversineMeters, msToKmh } from './telemetry';
import { wattsSavedFromEfficiency, soloBaselineWatts } from './drafting';

export type RideInsights = {
  energySavedPercent: number;
  energySavedWatts: number;
  potentialExtraEnergyPercent: number;
  draftingPercent: number;
  soloPercent: number;
  bestSegment: RideSegment | null;
  worstSegment: RideSegment | null;
  recommendations: string[];
  missedOpportunities: string[];
  comparison: RideComparison | null;
};

export type RideComparison = {
  direction: 'up' | 'down' | 'flat';
  /** Signed percent change in energy saved vs the previous ride. */
  energySavedDeltaPercent: number;
  /** Signed percent change in drafting share vs the previous ride. */
  draftingDeltaPercent: number;
  summary: string;
};

/**
 * Compute segments from a raw sample buffer.
 *
 * A "segment" is an evenly-spaced kilometer chunk for short rides, or
 * 2km chunk for longer rides — capped at 8 segments so the Insights UI
 * stays scannable.
 */
export function buildSegments(samples: RideSample[]): RideSegment[] {
  if (samples.length < 2) return [];
  let totalMeters = 0;
  const cumulative: number[] = [0];
  for (let i = 1; i < samples.length; i++) {
    totalMeters += haversineMeters(samples[i - 1], samples[i]);
    cumulative.push(totalMeters);
  }
  if (totalMeters < 200) return [];

  const targetSegments = Math.min(8, Math.max(3, Math.round(totalMeters / 1500)));
  const stepMeters = totalMeters / targetSegments;
  const segments: RideSegment[] = [];

  let cursor = 0;
  for (let s = 0; s < targetSegments; s++) {
    const startMeters = s * stepMeters;
    const endMeters = (s + 1) * stepMeters;
    let speedSum = 0;
    let speedCount = 0;
    let draftSamples = 0;
    let firstIdx = cursor;
    while (cursor < samples.length && cumulative[cursor] < endMeters) {
      if (samples[cursor].speedMs > 0) {
        speedSum += msToKmh(samples[cursor].speedMs);
        speedCount += 1;
      }
      if (samples[cursor].drafting) draftSamples += 1;
      cursor += 1;
    }
    const lastIdx = Math.max(firstIdx, cursor - 1);
    const samplesInSeg = lastIdx - firstIdx + 1;
    const draftingFrac = samplesInSeg > 0 ? draftSamples / samplesInSeg : 0;
    const drafting = draftingFrac > 0.5;
    const avgSpeedKmh = speedCount > 0 ? speedSum / speedCount : 0;

    // efficiency: drafting frac scaled into a 0–100 range with a small
    // boost for being mostly-drafting (peloton-tier holds the line).
    const draftEfficiency = Math.round(draftingFrac * 100);

    segments.push({
      index: s,
      startKm: startMeters / 1000,
      endKm: endMeters / 1000,
      avgSpeedKmh,
      drafting,
      draftEfficiency,
      label: labelForSegment(drafting, draftingFrac, avgSpeedKmh),
    });
  }

  return segments;
}

function labelForSegment(
  drafting: boolean,
  draftingFrac: number,
  avgSpeedKmh: number,
): string {
  if (drafting && draftingFrac > 0.8) return 'Locked in the slipstream';
  if (drafting) return 'Mostly drafting';
  if (draftingFrac > 0.3) return 'Mixed drafting';
  if (avgSpeedKmh > 30) return 'Solo push';
  return 'Riding solo';
}

/** Top-level insights computed from a finished ride + optional comparison. */
export function computeInsights(
  ride: RideRecord,
  previous: RideRecord | null,
): RideInsights {
  const segments = ride.segments;
  const draftingPercent = Math.round(ride.draftingFraction * 100);
  const soloPercent = 100 - draftingPercent;

  const ranked = [...segments].sort((a, b) => b.draftEfficiency - a.draftEfficiency);
  const bestSegment = ranked[0] ?? null;
  const worstSegment = ranked[ranked.length - 1] ?? null;

  const recommendations = buildRecommendations(ride, previous);
  const missedOpportunities = buildMissedOpportunities(ride);
  const comparison = previous ? compareTo(previous, ride) : null;

  return {
    energySavedPercent: Math.round(ride.energySavedPercent),
    energySavedWatts: Math.round(ride.energySavedWatts),
    potentialExtraEnergyPercent: Math.round(ride.potentialExtraEnergyPercent),
    draftingPercent,
    soloPercent,
    bestSegment,
    worstSegment,
    recommendations,
    missedOpportunities,
    comparison,
  };
}

function buildRecommendations(
  ride: RideRecord,
  previous: RideRecord | null,
): string[] {
  const tips: string[] = [];

  if (ride.draftingFraction < 0.4) {
    tips.push('Look for a group earlier — the first 5 minutes set the tone.');
  }
  if (ride.potentialExtraEnergyPercent >= 5) {
    tips.push(
      `You could save +${Math.round(ride.potentialExtraEnergyPercent)}% more energy on this route.`,
    );
  }
  if (ride.avgSpeedKmh > 34) {
    tips.push('High pace ride — drop to a slower train to recover next time.');
  }
  if (previous && ride.energySavedPercent < previous.energySavedPercent) {
    tips.push('Last ride was more efficient. Try matching its cadence.');
  }
  if (tips.length === 0) {
    tips.push('Strong drafting throughout — keep this group rotation.');
  }
  return tips;
}

function buildMissedOpportunities(ride: RideRecord): string[] {
  const out: string[] = [];
  const soloPct = Math.round((1 - ride.draftingFraction) * 100);
  if (soloPct >= 30) {
    out.push(`You rode solo for ${soloPct}% of the ride.`);
  }
  const longSoloRun = longestSoloRunSec(ride.samples);
  if (longSoloRun > 180) {
    out.push(
      `Longest solo stretch: ${Math.round(longSoloRun / 60)} min — try joining the next train.`,
    );
  }
  return out;
}

function longestSoloRunSec(samples: RideSample[]): number {
  let longest = 0;
  let current = 0;
  let lastT = 0;
  for (const s of samples) {
    if (!s.drafting) {
      current += Math.max(0, s.t - lastT) / 1000;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
    lastT = s.t;
  }
  return longest;
}

function compareTo(previous: RideRecord, current: RideRecord): RideComparison {
  const energyDelta = current.energySavedPercent - previous.energySavedPercent;
  const draftDelta =
    (current.draftingFraction - previous.draftingFraction) * 100;

  let direction: RideComparison['direction'];
  if (Math.abs(energyDelta) < 1.5) direction = 'flat';
  else if (energyDelta > 0) direction = 'up';
  else direction = 'down';

  const summary =
    direction === 'up'
      ? `Up ${energyDelta.toFixed(1)}% in energy saved versus your last ride.`
      : direction === 'down'
        ? `Down ${Math.abs(energyDelta).toFixed(1)}% versus your last ride.`
        : 'On par with your last ride.';

  return {
    direction,
    energySavedDeltaPercent: Math.round(energyDelta * 10) / 10,
    draftingDeltaPercent: Math.round(draftDelta * 10) / 10,
    summary,
  };
}

/**
 * Roll-up of a finished sample buffer into the persisted RideRecord shape.
 * Centralises the math so the Provider, the Complete screen and the
 * Insights screen all read identical numbers.
 */
export function summarizeRide(args: {
  id: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  samples: RideSample[];
  routeName?: string;
  origin?: RideRecord['origin'];
  destination?: RideRecord['destination'];
}): RideRecord {
  const { id, startedAt, endedAt, durationSec, samples } = args;

  let distanceMeters = 0;
  let speedSum = 0;
  let speedCount = 0;
  let maxSpeedMs = 0;
  let draftMs = 0;
  let totalMs = 0;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (i > 0) {
      const prev = samples[i - 1];
      distanceMeters += haversineMeters(prev, s);
      const dt = Math.max(0, s.t - prev.t);
      totalMs += dt;
      if (s.drafting) draftMs += dt;
    }
    if (s.speedMs > 0) {
      speedSum += s.speedMs;
      speedCount += 1;
      if (s.speedMs > maxSpeedMs) maxSpeedMs = s.speedMs;
    }
  }

  const avgSpeedMs = speedCount > 0 ? speedSum / speedCount : 0;
  const draftingFraction = totalMs > 0 ? draftMs / totalMs : 0;

  // Energy maths — drafting saves ~30% of effort vs solo. Weight by how
  // much of the ride was spent in the slipstream.
  const energySavedPercent = Math.round(draftingFraction * 30);
  const energySavedWatts = Math.round(
    soloBaselineWatts() * (energySavedPercent / 100),
  );
  // Potential extra savings if the rider had drafted 100% of the route.
  const potentialExtraEnergyPercent = Math.round((1 - draftingFraction) * 30);

  const segments = buildSegments(samples);

  return {
    id,
    startedAt,
    endedAt,
    durationSec,
    distanceMeters,
    avgSpeedKmh: msToKmh(avgSpeedMs),
    maxSpeedKmh: msToKmh(maxSpeedMs),
    samples,
    segments,
    draftingFraction,
    energySavedPercent,
    energySavedWatts,
    potentialExtraEnergyPercent,
    routeName: args.routeName,
    origin: args.origin,
    destination: args.destination,
  };
}

/** Convenience: estimate live watts saved given a smoothed efficiency %. */
export function liveWattsSaved(efficiencyPercent: number): number {
  return wattsSavedFromEfficiency(efficiencyPercent);
}
