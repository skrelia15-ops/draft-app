import type { LatLng } from '@/lib/maps';
import type { RideRecord, RideSample, RideSegment } from './types';

export type RideRow = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_sec: number;
  distance_meters: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  drafting_fraction: number;
  energy_saved_percent: number;
  energy_saved_watts: number;
  potential_extra_energy_percent: number;
  route_name: string | null;
  origin: LatLng | null;
  destination: LatLng | null;
  samples: RideSample[];
  segments: RideSegment[];
};

export function rideToRow(r: RideRecord, userId: string): RideRow {
  return {
    id: r.id,
    user_id: userId,
    started_at: new Date(r.startedAt).toISOString(),
    ended_at: new Date(r.endedAt).toISOString(),
    duration_sec: r.durationSec,
    distance_meters: r.distanceMeters,
    avg_speed_kmh: r.avgSpeedKmh,
    max_speed_kmh: r.maxSpeedKmh,
    drafting_fraction: r.draftingFraction,
    energy_saved_percent: r.energySavedPercent,
    energy_saved_watts: r.energySavedWatts,
    potential_extra_energy_percent: r.potentialExtraEnergyPercent,
    route_name: r.routeName ?? null,
    origin: r.origin ?? null,
    destination: r.destination ?? null,
    samples: r.samples,
    segments: r.segments,
  };
}

/** Parse an ISO timestamp, falling back to 0 for null/garbage values so
 *  date math (relative-time, week bucketing) never propagates NaN. */
function parseTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

/** Coerce a possibly-null numeric column to a finite number. */
function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function rowToRide(row: RideRow): RideRecord {
  const record: RideRecord = {
    id: row.id,
    startedAt: parseTimestamp(row.started_at),
    endedAt: parseTimestamp(row.ended_at),
    durationSec: num(row.duration_sec),
    distanceMeters: num(row.distance_meters),
    avgSpeedKmh: num(row.avg_speed_kmh),
    maxSpeedKmh: num(row.max_speed_kmh),
    samples: row.samples ?? [],
    segments: row.segments ?? [],
    draftingFraction: num(row.drafting_fraction),
    energySavedPercent: num(row.energy_saved_percent),
    energySavedWatts: num(row.energy_saved_watts),
    potentialExtraEnergyPercent: num(row.potential_extra_energy_percent),
  };
  if (row.route_name != null) record.routeName = row.route_name;
  if (row.origin != null) record.origin = row.origin;
  if (row.destination != null) record.destination = row.destination;
  return record;
}
