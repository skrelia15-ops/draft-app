/**
 * Nearby rider simulation.
 *
 * In a finished product, this would come from a presence service that
 * pushes other riders' anonymized positions, headings and pace. Here we
 * synthesise a small, plausible pool around the user's current GPS fix so
 * the home screen can show *something* meaningful — distance, direction,
 * pace gap, and a draft-potential rating — instead of abstract dots.
 *
 * Everything is deterministic per (lat, lng, hour) bucket so values are
 * stable enough for the same view to render the same list twice in a row.
 */
import type { LatLng } from '@/lib/maps';
import { getCurrentConditions, type CompassDirection } from './conditions';

export type DraftPotential = 'LOW' | 'MEDIUM' | 'HIGH';

export type NearbyRider = {
  id: string;
  /** Display name (anonymised handle). */
  name: string;
  /** Distance from the user, in meters. */
  distanceMeters: number;
  /** Where this rider is relative to the user (e.g. "AHEAD", "BEHIND"). */
  bearingLabel: 'AHEAD' | 'BEHIND' | 'CROSSING' | 'SAME ROUTE';
  /** Compass direction of the rider relative to the user. */
  compass: CompassDirection;
  /** Their current pace, km/h. */
  paceKmh: number;
  /** Pace delta vs the user's typical pace. + means rider is faster. */
  paceDeltaKmh: number;
  /** Are we heading the same way? */
  sameDirection: boolean;
  /** Draft compatibility — combination of distance + direction + pace gap. */
  potential: DraftPotential;
  /** One-line context. e.g. "120m ahead · matching your pace". */
  hint: string;
};

export type RiderCluster = {
  id: string;
  label: string;
  direction: CompassDirection;
  distanceMeters: number;
  riderCount: number;
  avgSpeedKmh: number;
  potential: DraftPotential;
  riders: NearbyRider[];
};

const DIRECTIONS: CompassDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const HANDLES = [
  'IRIS',
  'KAI',
  'MILO',
  'SAGE',
  'ZOE',
  'REN',
  'NORA',
  'FINN',
  'LUNA',
  'OWEN',
  'ELIO',
  'WREN',
];

function hashCoords(coords: LatLng | null): number {
  if (!coords) return 17;
  const lat = Math.round(coords.latitude * 1000);
  const lng = Math.round(coords.longitude * 1000);
  return ((lat * 397) ^ (lng * 277)) >>> 0;
}

function bucketSeed(coords: LatLng | null): number {
  const fiveMinuteBucket = Math.floor(Date.now() / (1000 * 60 * 5));
  return (hashCoords(coords) ^ fiveMinuteBucket) >>> 0;
}

function rngFrom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Produce a list of nearby riders for the home screen.
 * - `coords`: optional current GPS — used to make distances/bearings sensible.
 * - `userPaceKmh`: optional self-pace — used to compute pace deltas.
 */
export function getNearbyRiders(
  coords: LatLng | null,
  userPaceKmh: number = 28,
): NearbyRider[] {
  const seed = bucketSeed(coords);
  const rng = rngFrom(seed);
  const count = 3 + Math.floor(rng() * 3); // 3–5 riders

  const conditions = getCurrentConditions();
  const out: NearbyRider[] = [];

  for (let i = 0; i < count; i++) {
    const handle = HANDLES[Math.floor(rng() * HANDLES.length)];
    const distanceMeters = Math.round(40 + rng() * 460); // 40–500 m
    const compass = DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)];
    const sameDirection = rng() > 0.35; // bias toward same direction
    const paceDelta = Math.round((rng() * 8 - 4) * 10) / 10; // -4..+4 km/h
    const paceKmh = Math.max(12, Math.round((userPaceKmh + paceDelta) * 10) / 10);

    const bearingLabel: NearbyRider['bearingLabel'] = !sameDirection
      ? 'CROSSING'
      : distanceMeters < 120
        ? 'AHEAD'
        : rng() > 0.5
          ? 'SAME ROUTE'
          : 'BEHIND';

    // Draft potential heuristic:
    // - Same direction + pace within ±2 km/h + < 250m apart → HIGH
    // - Same direction + pace within ±4 km/h + < 400m apart → MEDIUM
    // - else LOW
    let potential: DraftPotential = 'LOW';
    if (sameDirection && Math.abs(paceDelta) <= 2 && distanceMeters < 250) {
      potential = 'HIGH';
    } else if (sameDirection && Math.abs(paceDelta) <= 4 && distanceMeters < 400) {
      potential = 'MEDIUM';
    }

    // Conditions nudge: poor wind drops the headline rating one notch
    if (conditions.draftLabel === 'POOR' && potential === 'HIGH') {
      potential = 'MEDIUM';
    }

    const hint = buildHint({
      bearingLabel,
      distanceMeters,
      paceDelta,
      sameDirection,
      compass,
    });

    out.push({
      id: `${seed}-${i}`,
      name: handle,
      distanceMeters,
      bearingLabel,
      compass,
      paceKmh,
      paceDeltaKmh: paceDelta,
      sameDirection,
      potential,
      hint,
    });
  }

  // Sort by draft potential (HIGH first), then by distance.
  const rank: Record<DraftPotential, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  out.sort(
    (a, b) =>
      rank[a.potential] - rank[b.potential] || a.distanceMeters - b.distanceMeters,
  );

  return out;
}

export function clusterNearbyRiders(riders: NearbyRider[]): RiderCluster[] {
  const buckets = new Map<string, NearbyRider[]>();
  for (const rider of riders) {
    const directionBucket = rider.sameDirection ? rider.compass : 'CROSSING';
    const distanceBucket =
      rider.distanceMeters < 150
        ? 'near'
        : rider.distanceMeters < 350
          ? 'mid'
          : 'far';
    const key = `${directionBucket}-${distanceBucket}`;
    buckets.set(key, [...(buckets.get(key) ?? []), rider]);
  }

  const clusters = Array.from(buckets.entries()).map(([id, group]) => {
    const avgDistance =
      group.reduce((sum, rider) => sum + rider.distanceMeters, 0) / group.length;
    const avgSpeed =
      group.reduce((sum, rider) => sum + rider.paceKmh, 0) / group.length;
    const bestPotential = group.reduce<DraftPotential>((best, rider) => {
      return potentialRank(rider.potential) < potentialRank(best)
        ? rider.potential
        : best;
    }, 'LOW');
    const lead = group[0];
    return {
      id,
      label:
        group.length === 1
          ? `${lead.name} ${lead.bearingLabel.toLowerCase()}`
          : `${group.length} riders ${lead.bearingLabel.toLowerCase()}`,
      direction: lead.compass,
      distanceMeters: Math.round(avgDistance),
      riderCount: group.length,
      avgSpeedKmh: Math.round(avgSpeed * 10) / 10,
      potential: bestPotential,
      riders: group,
    };
  });

  return clusters.sort(
    (a, b) =>
      potentialRank(a.potential) - potentialRank(b.potential) ||
      a.distanceMeters - b.distanceMeters,
  );
}

function potentialRank(potential: DraftPotential): number {
  if (potential === 'HIGH') return 0;
  if (potential === 'MEDIUM') return 1;
  return 2;
}

function buildHint({
  bearingLabel,
  distanceMeters,
  paceDelta,
  sameDirection,
  compass,
}: {
  bearingLabel: NearbyRider['bearingLabel'];
  distanceMeters: number;
  paceDelta: number;
  sameDirection: boolean;
  compass: CompassDirection;
}): string {
  const distLabel =
    distanceMeters < 1000
      ? `${distanceMeters}m`
      : `${(distanceMeters / 1000).toFixed(1)}km`;

  if (!sameDirection) return `${distLabel} ${compass} · opposite direction`;

  const paceText =
    Math.abs(paceDelta) < 0.5
      ? 'matching your pace'
      : paceDelta > 0
        ? `+${paceDelta.toFixed(1)} km/h faster`
        : `${paceDelta.toFixed(1)} km/h slower`;

  return `${distLabel} ${bearingLabel.toLowerCase()} · ${paceText}`;
}
