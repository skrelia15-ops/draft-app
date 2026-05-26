/**
 * Ride telemetry types.
 *
 * A ride is recorded as a sequence of GPS-derived samples plus a derived
 * segment summary. The segment summary is what the post-ride Insights
 * screen renders ("best segment", "worst segment", drafting share, etc.)
 * so the post-ride math doesn't have to re-walk the raw samples.
 */
import type { LatLng } from '@/lib/maps';

export type RidePhase = 'idle' | 'active' | 'paused' | 'finished';

/** A single point in a ride's GPS trace. */
export type RideSample = {
  /** Elapsed ms since the ride was started. Monotonic across pauses. */
  t: number;
  /** Wall-clock timestamp the sample was captured at (ms since epoch). */
  capturedAt: number;
  latitude: number;
  longitude: number;
  /** Speed in m/s. May be 0 on Android (device doesn't always report it). */
  speedMs: number;
  /** Whether the rider was in a draft at this moment (simulated locally). */
  drafting: boolean;
};

/** A roughly-equal-distance chunk of the ride, ready for visualisation. */
export type RideSegment = {
  index: number;
  startKm: number;
  endKm: number;
  avgSpeedKmh: number;
  drafting: boolean;
  /** 0–100. How efficient the draft was on this chunk. */
  draftEfficiency: number;
  /**
   * Short human label that explains what happened here in plain English.
   * Used by the Insights screen to render the best/worst callouts.
   */
  label: string;
};

/** A finished, immutable ride. Stored locally for history + comparison. */
export type RideRecord = {
  id: string;
  startedAt: number;
  endedAt: number;
  /** Total active seconds (pauses excluded). */
  durationSec: number;
  distanceMeters: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;

  /** GPS trace. Truncated to a reasonable cap for storage. */
  samples: RideSample[];
  segments: RideSegment[];

  /** Fraction of duration spent drafting, 0–1. */
  draftingFraction: number;
  /**
   * Average % energy saved versus a hypothetical solo ride on the same
   * route. A drafting cyclist saves ~25–35% — we weight by the time spent
   * actually in the slipstream.
   */
  energySavedPercent: number;
  /**
   * Headline number for the Insights screen — average watts saved
   * compared to riding solo at the same pace.
   */
  energySavedWatts: number;
  /**
   * What we could have saved if we'd drafted 100% of the route at the
   * same intensity. Drives the "you could save +X% more" recommendation.
   */
  potentialExtraEnergyPercent: number;

  /** Optional route metadata captured when the ride started. */
  routeName?: string;
  origin?: LatLng;
  destination?: LatLng;
};

/** Live, in-flight stats — derived from the active sample buffer. */
export type RideLiveStats = {
  /** Time since startedAt, minus accumulated paused time. */
  elapsedSec: number;
  /** Current GPS speed in km/h (smoothed across the last few samples). */
  speedKmh: number;
  /** Cumulative GPS distance in meters. */
  distanceMeters: number;
  /** Estimated remaining distance to destination, meters (best-effort). */
  remainingMeters: number | null;
  /** Estimated time-to-destination in seconds (best-effort). */
  etaSec: number | null;
  /** Live draft efficiency, 0–100. Smoothed across the recent window. */
  draftEfficiencyPercent: number;
  /** Whether the rider is currently in a draft. */
  drafting: boolean;
  /** Live watts saved vs solo right now (smoothed). */
  wattsSavedNow: number;
  /** Avg speed across the whole ride so far, km/h. */
  avgSpeedKmh: number;
};
