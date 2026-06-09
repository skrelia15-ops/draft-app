import Constants from 'expo-constants';
import { decodePolyline, type LatLng } from './polyline';

/**
 * Thin client around the three Google Maps web APIs we need on-device:
 *   - Places Autocomplete (search-as-you-type)
 *   - Place Details        (resolve a placeId to coordinates)
 *   - Directions           (route + traffic-aware duration)
 *
 * The key comes from a single source — the `GOOGLE_MAPS_API_KEY` env var,
 * surfaced via `app.config.ts`'s `extra.googleMapsApiKey` (the same value
 * also wired into the native iOS/Android map config). Reading it from
 * `extra` keeps one source of truth; note it is still inlined into the JS
 * bundle, so in production restrict the key by bundle ID and consider
 * proxying these calls through a server to avoid exposing it to clients.
 */

const API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey as
  | string
  | undefined;
const BASE = 'https://maps.googleapis.com/maps/api';

export class MapsApiError extends Error {
  status: string;
  constructor(status: string, message?: string) {
    super(message ?? `Google Maps API error: ${status}`);
    this.status = status;
  }
}

function ensureKey(): string {
  if (!API_KEY) {
    throw new MapsApiError(
      'MISSING_KEY',
      'GOOGLE_MAPS_API_KEY is not set. Add it to .env.',
    );
  }
  return API_KEY;
}

/**
 * Strip the API key from a URL before logging — keeps secrets out of dev
 * consoles and crash reports.
 */
function redactKey(url: string): string {
  return url.replace(/([?&])key=[^&]+/, '$1key=***');
}

/** Pretty error message for non-OK Google API status codes. */
function describeStatus(status: string, errorMessage?: string): string {
  const base = (() => {
    switch (status) {
      case 'ZERO_RESULTS':
        return 'No route found between these points.';
      case 'REQUEST_DENIED':
        return 'Google denied the request — check that the Directions/Places API is enabled for this key.';
      case 'OVER_QUERY_LIMIT':
        return 'API quota exceeded. Try again later.';
      case 'INVALID_REQUEST':
        return 'Invalid request — check origin/destination coordinates.';
      case 'NOT_FOUND':
        return 'One of the locations could not be found.';
      case 'UNKNOWN_ERROR':
        return 'Temporary Google Maps error. Please retry.';
      default:
        return `Google Maps error (${status}).`;
    }
  })();
  return errorMessage ? `${base} ${errorMessage}` : base;
}

/** Wrap a `fetch` so we always log the request/response shape in dev. */
async function fetchJson<T>(
  endpoint: string,
  params: URLSearchParams,
  signal?: AbortSignal,
): Promise<T> {
  const url = `${BASE}${endpoint}?${params}`;
  if (__DEV__) {
    console.log('[maps] →', endpoint, redactKey(url));
  }
  const res = await fetch(url, { signal });
  const data = (await res.json()) as T & {
    status?: string;
    error_message?: string;
  };
  if (__DEV__) {
    console.log(
      '[maps] ←',
      endpoint,
      'status=',
      data.status,
      data.error_message ? `msg=${data.error_message}` : '',
    );
  }
  return data;
}

// ---------- Places autocomplete ----------

export type PlacePrediction = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  description: string;
};

type AutocompleteResponse = {
  status: string;
  error_message?: string;
  predictions?: {
    place_id: string;
    description: string;
    structured_formatting?: {
      main_text: string;
      secondary_text?: string;
    };
  }[];
};

export async function autocompletePlaces(
  input: string,
  bias?: { latitude: number; longitude: number; radiusMeters?: number },
  signal?: AbortSignal,
): Promise<PlacePrediction[]> {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const key = ensureKey();
  const params = new URLSearchParams({ input: trimmed, key });
  if (bias) {
    params.set(
      'location',
      `${bias.latitude.toFixed(6)},${bias.longitude.toFixed(6)}`,
    );
    params.set('radius', String(bias.radiusMeters ?? 50_000));
  }

  const data = await fetchJson<AutocompleteResponse>(
    '/place/autocomplete/json',
    params,
    signal,
  );

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new MapsApiError(
      data.status,
      describeStatus(data.status, data.error_message),
    );
  }

  return (data.predictions ?? []).map((p) => ({
    placeId: p.place_id,
    primaryText: p.structured_formatting?.main_text ?? p.description,
    secondaryText: p.structured_formatting?.secondary_text ?? '',
    description: p.description,
  }));
}

// ---------- Place details ----------

export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string;
  location: LatLng;
};

type PlaceDetailsResponse = {
  status: string;
  error_message?: string;
  result?: {
    place_id: string;
    name?: string;
    formatted_address?: string;
    geometry: { location: { lat: number; lng: number } };
  };
};

export async function getPlaceDetails(
  placeId: string,
  signal?: AbortSignal,
): Promise<PlaceDetails> {
  const key = ensureKey();
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'place_id,name,formatted_address,geometry/location',
    key,
  });

  const data = await fetchJson<PlaceDetailsResponse>(
    '/place/details/json',
    params,
    signal,
  );

  if (data.status !== 'OK' || !data.result) {
    throw new MapsApiError(
      data.status,
      describeStatus(data.status, data.error_message),
    );
  }

  const r = data.result;
  return {
    placeId: r.place_id,
    name: r.name ?? r.formatted_address ?? 'Destination',
    address: r.formatted_address ?? '',
    location: {
      latitude: r.geometry.location.lat,
      longitude: r.geometry.location.lng,
    },
  };
}

// ---------- Directions ----------

export type TravelMode = 'bicycling' | 'driving' | 'walking';

export type RouteResult = {
  mode: TravelMode;
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
  /** Traffic-aware duration when `mode === 'driving'`. */
  durationInTrafficSeconds?: number;
  durationInTrafficText?: string;
  /** Decoded polyline, ready for `<Polyline coordinates={...} />`. */
  coordinates: LatLng[];
  bounds: {
    northeast: LatLng;
    southwest: LatLng;
  };
  endAddress: string;
  startAddress: string;
  trafficLevel: 'CLEAR' | 'MODERATE' | 'HEAVY' | null;
  alternativeCount: number;
};

type DirectionsResponse = {
  status: string;
  error_message?: string;
  routes?: {
    overview_polyline: { points: string };
    bounds: {
      northeast: { lat: number; lng: number };
      southwest: { lat: number; lng: number };
    };
    legs: {
      distance: { value: number; text: string };
      duration: { value: number; text: string };
      duration_in_traffic?: { value: number; text: string };
      end_address: string;
      start_address: string;
    }[];
  }[];
};

/**
 * Validate a coordinate before sending to Google. Catches NaN / wrong-sign /
 * accidentally-string inputs early so we get a useful error in dev.
 */
function assertValidCoord(p: LatLng, name: string): void {
  const lat = Number(p.latitude);
  const lng = Number(p.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new MapsApiError(
      'INVALID_REQUEST',
      `${name} has non-numeric coordinates (lat=${p.latitude}, lng=${p.longitude}).`,
    );
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new MapsApiError(
      'INVALID_REQUEST',
      `${name} is out of range (lat=${lat}, lng=${lng}).`,
    );
  }
}

async function fetchDirections(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode,
  signal?: AbortSignal,
): Promise<RouteResult | null> {
  const key = ensureKey();
  assertValidCoord(origin, 'origin');
  assertValidCoord(destination, 'destination');

  const params = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    mode,
    alternatives: 'true',
    key,
  });
  // duration_in_traffic is only returned for driving + departure_time.
  if (mode === 'driving') {
    params.set('departure_time', 'now');
    params.set('traffic_model', 'best_guess');
  }

  const data = await fetchJson<DirectionsResponse>(
    '/directions/json',
    params,
    signal,
  );

  if (data.status === 'ZERO_RESULTS') return null;
  if (data.status !== 'OK' || !data.routes?.length) {
    throw new MapsApiError(
      data.status,
      describeStatus(data.status, data.error_message),
    );
  }

  const route = data.routes[0];
  const leg = route.legs[0];
  const trafficLevel = classifyTraffic(
    leg.duration.value,
    leg.duration_in_traffic?.value,
  );
  return {
    mode,
    distanceMeters: leg.distance.value,
    distanceText: leg.distance.text,
    durationSeconds: leg.duration.value,
    durationText: leg.duration.text,
    durationInTrafficSeconds: leg.duration_in_traffic?.value,
    durationInTrafficText: leg.duration_in_traffic?.text,
    coordinates: decodePolyline(route.overview_polyline.points),
    bounds: {
      northeast: {
        latitude: route.bounds.northeast.lat,
        longitude: route.bounds.northeast.lng,
      },
      southwest: {
        latitude: route.bounds.southwest.lat,
        longitude: route.bounds.southwest.lng,
      },
    },
    endAddress: leg.end_address,
    startAddress: leg.start_address,
    trafficLevel,
    alternativeCount: Math.max(0, (data.routes?.length ?? 1) - 1),
  };
}

function classifyTraffic(
  durationSeconds: number,
  durationInTrafficSeconds?: number,
): RouteResult['trafficLevel'] {
  if (!durationInTrafficSeconds || durationSeconds <= 0) return null;
  const ratio = durationInTrafficSeconds / durationSeconds;
  if (ratio < 1.1) return 'CLEAR';
  if (ratio < 1.4) return 'MODERATE';
  return 'HEAVY';
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/**
 * Build a Manhattan-style fallback polyline between two coordinates when
 * the Directions API is unavailable. The path is composed of two
 * grid-aligned (lat/lng axis) segments with a couple of jogs in the
 * middle so it reads as "following streets" rather than a smooth bezier
 * dropped across the city.
 *
 * The route is purely cosmetic — distance is approximated by the
 * great-circle haversine of the two endpoints. We never try to fake a
 * road network: it's a visual placeholder until the API key is wired up.
 */
function buildSyntheticRoute(origin: LatLng, destination: LatLng): RouteResult {
  const distanceMeters = Math.max(100, haversineMeters(origin, destination));
  const distanceKm = distanceMeters / 1000;
  const seed =
    Math.imul(Math.round(origin.latitude * 1e4), 997) ^
    Math.imul(Math.round(origin.longitude * 1e4), 991) ^
    Math.imul(Math.round(destination.latitude * 1e4), 983) ^
    Math.imul(Math.round(destination.longitude * 1e4), 977);

  const coordinates = buildGridPath(origin, destination, seed >>> 0);
  const lats = coordinates.map((c) => c.latitude);
  const lngs = coordinates.map((c) => c.longitude);
  // 18 km/h is roughly a relaxed urban cycling pace.
  const durationSeconds = Math.round((distanceKm / 18) * 3600);
  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
  return {
    mode: 'bicycling',
    distanceMeters: Math.round(distanceMeters),
    distanceText: `${distanceKm.toFixed(1)} km`,
    durationSeconds,
    durationText: `${durationMinutes} min`,
    coordinates,
    bounds: {
      northeast: {
        latitude: Math.max(...lats),
        longitude: Math.max(...lngs),
      },
      southwest: {
        latitude: Math.min(...lats),
        longitude: Math.min(...lngs),
      },
    },
    endAddress: 'Destination',
    startAddress: 'Origin',
    trafficLevel: null,
    alternativeCount: 0,
  };
}

/**
 * Construct a stair-stepped polyline from origin to destination that uses
 * only horizontal (constant-latitude) and vertical (constant-longitude)
 * segments. Two pivot points are introduced so the path doesn't look like
 * a single right-angle elbow.
 */
function buildGridPath(origin: LatLng, destination: LatLng, seed: number): LatLng[] {
  const rng = mulberry32(seed);
  const dLat = destination.latitude - origin.latitude;
  const dLng = destination.longitude - origin.longitude;

  // Pick two break-points along the journey at ~1/3 and ~2/3.
  // Alternate which axis turns first so consecutive routes don't look
  // identical from a given origin.
  const latFirst = rng() > 0.5;
  const t1 = 0.28 + rng() * 0.1;
  const t2 = 0.62 + rng() * 0.1;

  const p1: LatLng = latFirst
    ? { latitude: origin.latitude + dLat * t1, longitude: origin.longitude }
    : { latitude: origin.latitude, longitude: origin.longitude + dLng * t1 };

  const p2: LatLng = latFirst
    ? {
        latitude: origin.latitude + dLat * t1,
        longitude: origin.longitude + dLng * t2,
      }
    : {
        latitude: origin.latitude + dLat * t2,
        longitude: origin.longitude + dLng * t1,
      };

  const p3: LatLng = latFirst
    ? {
        latitude: origin.latitude + dLat * t2,
        longitude: origin.longitude + dLng * t2,
      }
    : {
        latitude: origin.latitude + dLat * t2,
        longitude: origin.longitude + dLng * t2,
      };

  // Densify each leg so the dark-map polyline looks crisp without
  // needing line smoothing.
  const path: LatLng[] = [];
  const legs: [LatLng, LatLng][] = [
    [origin, p1],
    [p1, p2],
    [p2, p3],
    [p3, destination],
  ];
  legs.forEach(([a, b], idx) => {
    const steps = 8;
    for (let i = idx === 0 ? 0 : 1; i <= steps; i++) {
      const t = i / steps;
      path.push({
        latitude: a.latitude + (b.latitude - a.latitude) * t,
        longitude: a.longitude + (b.longitude - a.longitude) * t,
      });
    }
  });
  return path;
}

function mulberry32(seed: number): () => number {
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
 * Cycling-first directions. Falls back to driving (with traffic) when
 * cycling isn't supported in the region — Directions API returns
 * ZERO_RESULTS in that case. Walking is the last fallback for very short
 * inner-city legs (< ~1 km) where neither cycling nor driving has a route.
 */
export async function getCyclingDirections(
  origin: LatLng,
  destination: LatLng,
  signal?: AbortSignal,
): Promise<RouteResult> {
  if (!API_KEY) {
    if (__DEV__) console.warn('[maps] No API key — using synthetic route fallback.');
    return buildSyntheticRoute(origin, destination);
  }

  const cycling = await fetchDirections(origin, destination, 'bicycling', signal);
  if (cycling) {
    try {
      const road = await fetchDirections(origin, destination, 'driving', signal);
      if (road) {
        return {
          ...cycling,
          trafficLevel: road.trafficLevel,
          alternativeCount: road.alternativeCount,
        };
      }
    } catch {
      // Cycling route remains valid even when the traffic probe fails.
    }
    return cycling;
  }

  const driving = await fetchDirections(origin, destination, 'driving', signal);
  if (driving) return driving;

  const walking = await fetchDirections(origin, destination, 'walking', signal);
  if (walking) return walking;

  throw new MapsApiError(
    'ZERO_RESULTS',
    describeStatus('ZERO_RESULTS'),
  );
}
