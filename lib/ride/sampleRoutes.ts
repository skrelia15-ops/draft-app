/**
 * Generates plausible route polylines anchored to a user-provided start
 * coordinate, so the route picker can show real MapView previews even
 * before the backend can provide actual saved routes.
 *
 * The shapes are pure-geometric (loop, out-and-back, point-to-point)
 * rather than abstract SVG art — the user sees an actual path on a real
 * map, with a start pin, a direction arrow, and an end / join pin.
 */
import type { LatLng } from '@/lib/maps';

export type RouteShape = 'loop' | 'out-and-back' | 'point-to-point';

const KM_PER_LAT_DEG = 111.32;

function kmPerLngDeg(lat: number): number {
  return 111.32 * Math.cos((lat * Math.PI) / 180);
}

function shift(coord: LatLng, dxKm: number, dyKm: number): LatLng {
  return {
    latitude: coord.latitude + dyKm / KM_PER_LAT_DEG,
    longitude: coord.longitude + dxKm / kmPerLngDeg(coord.latitude),
  };
}

/**
 * Build a route polyline shaped to match the picker's expectations.
 *
 * - `seed` keeps a given route stable between renders so the user always
 *   sees the same shape for the same ID.
 * - Returns origin, polyline, and destination so the calling screen can
 *   render proper start/end pins.
 */
export function buildRoutePreview(args: {
  origin: LatLng;
  shape: RouteShape;
  /** Approximate full length, kilometres. */
  distanceKm: number;
  seed: number;
}): {
  origin: LatLng;
  destination: LatLng;
  joinPoint: LatLng | null;
  coordinates: LatLng[];
  shape: RouteShape;
} {
  const { origin, shape, distanceKm, seed } = args;
  const rng = mulberry32(seed);
  const heading = rng() * Math.PI * 2; // overall direction in radians

  if (shape === 'loop') {
    return buildLoop(origin, distanceKm, heading, rng);
  }
  if (shape === 'out-and-back') {
    return buildOutAndBack(origin, distanceKm, heading);
  }
  return buildPointToPoint(origin, distanceKm, heading, rng);
}

function buildLoop(
  origin: LatLng,
  distanceKm: number,
  heading: number,
  rng: () => number,
) {
  // A loop ~ circle. Circumference = distance → radius = d / 2π.
  const radiusKm = Math.max(0.5, distanceKm / (2 * Math.PI));
  const center = shift(
    origin,
    radiusKm * Math.cos(heading),
    radiusKm * Math.sin(heading),
  );
  const steps = 64;
  const wobble = 0.08;
  const coordinates: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2 + heading + Math.PI;
    const r = radiusKm * (1 + (rng() - 0.5) * wobble);
    coordinates.push(shift(center, r * Math.cos(angle), r * Math.sin(angle)));
  }
  // Snap the loop closed: first & last coincide with origin.
  coordinates[0] = origin;
  coordinates[coordinates.length - 1] = origin;
  return {
    origin,
    destination: origin,
    joinPoint: coordinates[Math.floor(steps * 0.18)],
    coordinates,
    shape: 'loop' as RouteShape,
  };
}

function buildOutAndBack(origin: LatLng, distanceKm: number, heading: number) {
  const turnaround = shift(
    origin,
    (distanceKm / 2) * Math.cos(heading),
    (distanceKm / 2) * Math.sin(heading),
  );
  const steps = 24;
  const coords: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    coords.push(lerp(origin, turnaround, t));
  }
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    coords.push(lerp(turnaround, origin, t));
  }
  return {
    origin,
    destination: origin,
    joinPoint: turnaround,
    coordinates: coords,
    shape: 'out-and-back' as RouteShape,
  };
}

function buildPointToPoint(
  origin: LatLng,
  distanceKm: number,
  heading: number,
  rng: () => number,
) {
  const dest = shift(
    origin,
    distanceKm * Math.cos(heading),
    distanceKm * Math.sin(heading),
  );
  // Use a quadratic bezier with a perpendicular control point so the
  // line isn't dead straight.
  const perp = heading + Math.PI / 2;
  const bend = (distanceKm * (rng() - 0.5) * 0.3);
  const control = shift(
    midpoint(origin, dest),
    bend * Math.cos(perp),
    bend * Math.sin(perp),
  );
  const steps = 48;
  const coords: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    coords.push(quadraticBezier(origin, control, dest, t));
  }
  return {
    origin,
    destination: dest,
    joinPoint: control,
    coordinates: coords,
    shape: 'point-to-point' as RouteShape,
  };
}

function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

function midpoint(a: LatLng, b: LatLng): LatLng {
  return lerp(a, b, 0.5);
}

function quadraticBezier(a: LatLng, c: LatLng, b: LatLng, t: number): LatLng {
  const oneMinusT = 1 - t;
  return {
    latitude:
      oneMinusT * oneMinusT * a.latitude +
      2 * oneMinusT * t * c.latitude +
      t * t * b.latitude,
    longitude:
      oneMinusT * oneMinusT * a.longitude +
      2 * oneMinusT * t * c.longitude +
      t * t * b.longitude,
  };
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
