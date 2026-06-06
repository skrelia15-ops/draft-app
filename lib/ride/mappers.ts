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

export function rowToRide(row: RideRow): RideRecord {
  const record: RideRecord = {
    id: row.id,
    startedAt: Date.parse(row.started_at),
    endedAt: Date.parse(row.ended_at),
    durationSec: row.duration_sec,
    distanceMeters: row.distance_meters,
    avgSpeedKmh: row.avg_speed_kmh,
    maxSpeedKmh: row.max_speed_kmh,
    samples: row.samples ?? [],
    segments: row.segments ?? [],
    draftingFraction: row.drafting_fraction,
    energySavedPercent: row.energy_saved_percent,
    energySavedWatts: row.energy_saved_watts,
    potentialExtraEnergyPercent: row.potential_extra_energy_percent,
  };
  if (row.route_name != null) record.routeName = row.route_name;
  if (row.origin != null) record.origin = row.origin;
  if (row.destination != null) record.destination = row.destination;
  return record;
}
