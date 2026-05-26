import { decodePolyline, type LatLng } from './polyline';

/**
 * Thin client around the three Google Maps web APIs we need on-device:
 *   - Places Autocomplete (search-as-you-type)
 *   - Place Details        (resolve a placeId to coordinates)
 *   - Directions           (route + traffic-aware duration)
 *
 * Keys live in EXPO_PUBLIC_GOOGLE_MAPS_API_KEY so they're inlined into the
 * JS bundle. In production, restrict the key by bundle ID and consider
 * proxying through a server to avoid exposing it to clients.
 */

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
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
      'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set. Add it to .env.',
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
  const cycling = await fetchDirections(origin, destination, 'bicycling', signal);
  if (cycling) return cycling;

  const driving = await fetchDirections(origin, destination, 'driving', signal);
  if (driving) return driving;

  const walking = await fetchDirections(origin, destination, 'walking', signal);
  if (walking) return walking;

  throw new MapsApiError(
    'ZERO_RESULTS',
    describeStatus('ZERO_RESULTS'),
  );
}
